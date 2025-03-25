const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration
const inputFolder = './outputFolder';  // your folder containing MP4 files
const outputParentFolder = './video_keyframe'; // parent folder for outputs

// Create output directory if it doesn't exist
function createDirectory(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Extract audio to WAV
function extractAudio(inputFile, outputDir, videoId) {
    const outputFile = path.join(outputDir, `${videoId}_audio.wav`);
    const command = `ffmpeg -i "${inputFile}" -vn -acodec pcm_s16le -ar 44100 -ac 2 "${outputFile}"`;

    return new Promise((resolve, reject) => {
        exec(command, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

// Extract video without audio
function extractVideo(inputFile, outputDir, videoId) {
    const outputFile = path.join(outputDir, `${videoId}_video.mp4`);
    const command = `ffmpeg -i "${inputFile}" -an -c:v copy "${outputFile}"`;

    return new Promise((resolve, reject) => {
        exec(command, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

// Process all videos in the input folder
async function processVideos() {
    try {
        // Create main output directory
        createDirectory(outputParentFolder);

        // Read all files from input directory
        const files = fs.readdirSync(inputFolder);
        const mp4Files = files.filter(file => path.extname(file).toLowerCase() === '.mp4');

        console.log(`Found ${mp4Files.length} MP4 files to process`);

        // Process each video
        for (const file of mp4Files) {
            const videoId = path.parse(file).name;
            const inputFile = path.join(inputFolder, file);
            
            // Create individual output directory for this video
            const videoOutputDir = path.join(outputParentFolder, videoId);
            createDirectory(videoOutputDir);

            console.log(`Processing video: ${videoId}`);

            try {
                // Extract audio and video in parallel
                await Promise.all([
                    extractAudio(inputFile, videoOutputDir, videoId),
                    extractVideo(inputFile, videoOutputDir, videoId)
                ]);

                console.log(`Successfully processed ${videoId}`);
            } catch (error) {
                console.error(`Error processing ${videoId}:`, error);
            }
        }

        console.log('All videos processed');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the script
processVideos();