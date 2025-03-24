require('dotenv').config();
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const FormData = require('form-data');

// Your API configuration
const API_KEY = process.env.ASSEMBLYAI_API_KEY;
const API_URL = 'https://api.assemblyai.com/v2';

// Configure axios defaults for AssemblyAI
const client = axios.create({
    baseURL: API_URL,
    headers: {
        'Authorization': API_KEY,
        'Content-Type': 'application/json'
    }
});

// Function to check if file exists
async function checkFileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Function to detect silence using ffmpeg
async function detectSilence(audioFile, silenceThreshold = -40, minSilenceDuration = 2.0) {
    return new Promise((resolve, reject) => {
        const silenceIntervals = [];
        let startTime = null;

        ffmpeg(audioFile)
            .audioFilters(`silencedetect=noise=${silenceThreshold}dB:d=${minSilenceDuration}`)
            .format('null')
            .on('stderr', stderr => {
                const lines = stderr.split('\n');
                lines.forEach(line => {
                    if (line.includes('silence_start')) {
                        startTime = parseFloat(line.split('silence_start: ')[1]);
                    } else if (line.includes('silence_end') && startTime !== null) {
                        const endTime = parseFloat(line.split('silence_end: ')[1].split(' |')[0]);
                        silenceIntervals.push({
                            start: startTime * 1000,
                            end: endTime * 1000,
                            text: '(Music or Silence)'
                        });
                        startTime = null;
                    }
                });
            })
            .on('end', () => resolve(silenceIntervals))
            .on('error', reject)
            .save('pipe:1');
    });
}

// Function to process transcript data
async function processTranscript(transcript) {
    console.log('Processing transcript data...');
    
    // Debug log to see the full transcript data
    console.log('Raw transcript data:', JSON.stringify(transcript.data, null, 2));

    const processedSentences = [];
    
    // Check if we have words in the transcript
    if (!transcript.data.words || transcript.data.words.length === 0) {
        console.log('No words found in transcript');
        return processedSentences;
    }

    // Process words into sentences
    let currentSentence = {
        start: transcript.data.words[0].start,
        text: '',
        words: []
    };

    for (let i = 0; i < transcript.data.words.length; i++) {
        const word = transcript.data.words[i];
        currentSentence.words.push(word);
        currentSentence.text += (currentSentence.text ? ' ' : '') + word.text;

        // End of sentence conditions
        const isEndOfSentence = word.text.match(/[.!?]$/) || i === transcript.data.words.length - 1;
        
        if (isEndOfSentence) {
            currentSentence.end = word.end;
            processedSentences.push({
                start: currentSentence.start,
                end: currentSentence.end,
                text: currentSentence.text.trim()
            });

            // Start new sentence if not at the end
            if (i < transcript.data.words.length - 1) {
                currentSentence = {
                    start: transcript.data.words[i + 1].start,
                    text: '',
                    words: []
                };
            }
        }
    }

    console.log(`Processed ${processedSentences.length} sentences`);
    return processedSentences;
}

// Function to process all audio files in a folder
async function processAudioFolder(inputFolder, outputFolder) {
    try {
        console.log('\n=== Starting Audio Processing ===');
        
        // Ensure folders exist
        await fs.ensureDir(inputFolder);
        await fs.ensureDir(outputFolder);

        // Get audio files
        const files = await fs.readdir(inputFolder);
        const audioFiles = files.filter(file => file.toLowerCase().endsWith('.wav'));

        if (audioFiles.length === 0) {
            console.log('❌ No WAV files found in the folder!');
            return;
        }

        // Process each file
        for (const audioFile of audioFiles) {
            console.log(`\n=== Processing ${audioFile} ===`);
            const audioPath = path.join(inputFolder, audioFile);
            
            try {
                // Upload file
                const audioData = await fs.readFile(audioPath);
                const uploadResponse = await axios.post(`${API_URL}/upload`, audioData, {
                    headers: {
                        'Authorization': API_KEY,
                        'Content-Type': 'application/octet-stream'
                    }
                });

                // Create transcript
                const transcriptResponse = await client.post('/transcript', {
                    audio_url: uploadResponse.data.upload_url,
                    language_code: "en",
                    format_text: true,
                    punctuate: true
                });

                // Poll for completion
                let transcript;
                let attempts = 0;
                const maxAttempts = 60;

                while (attempts < maxAttempts) {
                    transcript = await client.get(`/transcript/${transcriptResponse.data.id}`);
                    console.log('Status:', transcript.data.status);
                    
                    if (transcript.data.status === 'completed') break;
                    if (transcript.data.status === 'error') {
                        throw new Error('Transcription failed: ' + transcript.data.error);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    attempts++;
                }

                // Process transcript
                const processedSentences = await processTranscript(transcript);
                
                // Detect silence
                const silenceIntervals = await detectSilence(audioPath);

                // Combine and sort segments
                const allSegments = [...processedSentences, ...silenceIntervals]
                    .sort((a, b) => a.start - b.start)
                    .map((segment, index) => ({
                        index: index + 1,
                        start: segment.start,
                        end: segment.end,
                        text: segment.text
                    }));

                // Create SRT content
                const srtContent = allSegments
                    .map(segment => (
                        `${segment.index}\n${formatTime(segment.start)} --> ${formatTime(segment.end)}\n${segment.text}\n\n`
                    ))
                    .join('');

                // Save to file
                const srtPath = path.join(outputFolder, audioFile.replace('.wav', '.srt'));
                await fs.writeFile(srtPath, srtContent);
                console.log(`✅ Created SRT file: ${srtPath}`);
                
                // Debug log
                console.log(`SRT file size: ${(await fs.stat(srtPath)).size} bytes`);
                console.log(`Number of segments: ${allSegments.length}`);

            } catch (error) {
                console.error(`Error processing ${audioFile}:`, error.message);
            }
        }

    } catch (error) {
        console.error('Error in processAudioFolder:', error);
    }
}

// Helper function to format time for SRT
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

// Main execution
async function main() {
    try {
        console.log('Starting program...');
        if (!API_KEY) {
            throw new Error('API key not found in environment variables');
        }

        const inputFolder = path.join(__dirname, 'input');
        const outputFolder = path.join(__dirname, 'output');

        await processAudioFolder(inputFolder, outputFolder);
        console.log('\n=== Processing Complete ===');

    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Run the program
main();