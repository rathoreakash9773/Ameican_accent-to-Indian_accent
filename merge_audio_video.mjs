import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Step 1: Check for audio files and setup paths
async function checkAudioFiles(folderPath) {
    try {
        console.log("📂 Checking audio files in folder...");
        const files = await fs.readdir(folderPath);
        const wavFiles = files.filter(f => f.endsWith('.wav'));
        
        if (wavFiles.length === 0) {
            console.error("❌ No .wav files found in the folder!");
            return false;
        }
        
        console.log(`✅ Found ${wavFiles.length} .wav files`);
        return wavFiles;
    } catch (error) {
        console.error("❌ Error checking audio files:", error);
        return false;
    }
}

// Step 2: Setup paths and ensure directories exist
async function setupPaths(videoId) {
    const paths = {
        mutedVideo: path.join(__dirname, 'output', videoId, `${videoId}.mp4`),
        ttsFolder: path.join(__dirname, 'output', videoId),
        outputVideo: path.join(__dirname, 'output', videoId, `${videoId}_output.mp4`)
    };

    // Ensure output directory exists
    await fs.ensureDir(path.dirname(paths.outputVideo));
    
    // Verify muted video exists
    if (!await fs.pathExists(paths.mutedVideo)) {
        throw new Error(`❌ Muted video not found at: ${paths.mutedVideo}`);
    }

    return paths;
}

// Step 3 & 4: Parse timestamps from filenames
function timestampToSeconds(timestamp) {
    const [hours, minutes, seconds] = timestamp.split('-').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
}

async function getAudioFilesWithTimestamps(ttsFolder, videoId) {
    const files = await fs.readdir(ttsFolder);
    const ttsFiles = [];

    for (const file of files) {
        if (file.endsWith('.wav')) {
            const match = file.match(/tts_(\d{2}-\d{2}-\d{2}-\d{3})_(\d{2}-\d{2}-\d{2}-\d{3})\.wav/);
            if (match) {
                const startTime = timestampToSeconds(match[1]);
                ttsFiles.push({
                    startTime,
                    filePath: path.join(ttsFolder, file)
                });
            }
        }
    }

    // Sort files by start time
    ttsFiles.sort((a, b) => a.startTime - b.startTime);
    
    // Debug: Show first few files
    console.log(`📂 Found ${ttsFiles.length} TTS files to process`);
    ttsFiles.slice(0, 5).forEach(file => {
        console.log(`⏳ Start: ${file.startTime}s ➝ 🎵 ${path.basename(file.filePath)}`);
    });

    return ttsFiles;
}

// Step 5 & 6: Merge audio files with video
async function mergeAudioWithVideo(paths, ttsFiles) {
    try {
        // Construct FFmpeg command
        let ffmpegCommand = `ffmpeg -i "${paths.mutedVideo}" `;

        // Add input files
        ttsFiles.forEach((file, i) => {
            ffmpegCommand += `-itsoffset ${file.startTime} -i "${file.filePath}" `;
        });

        // Start filter complex
        ffmpegCommand += '-filter_complex "';

        // Add delay for each audio file
        ttsFiles.forEach((file, i) => {
            const delayMs = file.startTime * 1000;
            ffmpegCommand += `[${i + 1}:a]adelay=${delayMs}|${delayMs},apad[a${i}];`;
        });

        // Mix all audio files
        const mixInputs = ttsFiles.map((_, i) => `[a${i}]`).join('');
        ffmpegCommand += `${mixInputs}amix=inputs=${ttsFiles.length}:duration=longest[a];`;

        // Adjust volume
        ffmpegCommand += '[a]volume=20.0[a_final]" ';

        // Output mapping
        ffmpegCommand += `-map 0:v -map "[a_final]" -c:v copy -c:a aac -strict experimental `;
        ffmpegCommand += '-shortest ';  // Ensure output matches video length
        ffmpegCommand += `"${paths.outputVideo}"`;

        console.log("🔄 Running FFmpeg command...");
        const { stdout, stderr } = await execAsync(ffmpegCommand);
        
        // Verify output file exists
        if (await fs.pathExists(paths.outputVideo)) {
            console.log(`✅ Process complete! Output saved to: ${paths.outputVideo}`);
            return true;
        } else {
            throw new Error("Output file not created");
        }
    } catch (error) {
        console.error("❌ Error merging audio with video:", error);
        return false;
    }
}

// Main function to orchestrate the process
async function main() {
    try {
        // Get video ID from command line or set it directly
        const videoId = process.argv[2] || "YGSgPra8jn4"; // Replace with your video ID

        // Setup paths
        const paths = await setupPaths(videoId);
        
        // Check for audio files
        const hasAudioFiles = await checkAudioFiles(paths.ttsFolder);
        if (!hasAudioFiles) {
            throw new Error("No audio files found to process");
        }

        // Get audio files with timestamps
        const ttsFiles = await getAudioFilesWithTimestamps(paths.ttsFolder, videoId);
        if (ttsFiles.length === 0) {
            throw new Error("No valid TTS files found");
        }

        // Merge audio with video
        await mergeAudioWithVideo(paths, ttsFiles);

    } catch (error) {
        console.error("❌ Fatal error:", error);
        process.exit(1);
    }
}

// Run the program
main();