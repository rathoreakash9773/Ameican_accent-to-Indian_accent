const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Define paths
const videoFolder = path.join("C:", "Users", "ratho", "Node2", "audio-to-srt", "Youtube_downloads");
const outputFolder = path.join("C:", "Users", "ratho", "Node2", "audio-to-srt", "outputFolder");

// Function to convert time string (MM:SS) to seconds
function timeToSeconds(timeStr) {
    try {
        const [minutes, seconds] = timeStr.split(':').map(Number);
        if (isNaN(minutes) || isNaN(seconds)) throw new Error();
        return minutes * 60 + seconds;
    } catch {
        throw new Error("Time must be in MM:SS format (e.g., 08:15 or 00:07)");
    }
}

// Promise wrapper for user input
function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

// Promise wrapper for executing ffmpeg command
function executeFFmpeg(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) reject(error);
            resolve();
        });
    });
}

// Function to copy file to output folder
function copyToOutput(sourcePath, videoId) {
    const destinationPath = path.join(outputFolder, `${videoId}.mp4`);
    fs.copyFileSync(sourcePath, destinationPath);
    return destinationPath;
}

// Function to get user inputs for a specific video
async function getVideoPreferences(videoId) {
    try {
        console.log(`\nProcessing video: ${videoId}`);
        const trimChoice = (await askQuestion(`Do you want to trim ${videoId}? (yes/no): `)).toLowerCase();
        const shouldTrim = trimChoice === 'yes' || trimChoice === 'y';

        let startTime = "00:00";
        let endTime = "00:00";

        if (shouldTrim) {
            console.log("\nEnter times in MM:SS format (e.g., 08:15 for 8 minutes 15 seconds, 00:07 for 7 seconds)");
            while (true) {
                try {
                    startTime = await askQuestion("Enter start time (MM:SS): ");
                    endTime = await askQuestion("Enter end time (MM:SS): ");

                    const startSeconds = timeToSeconds(startTime);
                    const endSeconds = timeToSeconds(endTime);

                    if (startSeconds < endSeconds) {
                        break;
                    } else {
                        console.log("Error: Start time must be less than end time. Please try again.");
                    }
                } catch (error) {
                    console.log("Error: Invalid time format. Please use MM:SS format.");
                }
            }
        }

        return { shouldTrim, startTime, endTime };
    } catch (error) {
        console.error("Error getting user inputs:", error);
        return { shouldTrim: false, startTime: "00:00", endTime: "00:00" };
    }
}

// Main async function
async function processVideos() {
    try {
        // Create output folder if it doesn't exist
        if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true });
        }

        // Get all subfolders in the video folder
        const videoFolders = fs.readdirSync(videoFolder)
            .filter(f => fs.statSync(path.join(videoFolder, f)).isDirectory());

        for (const videoId of videoFolders) {
            const videoPath = path.join(videoFolder, videoId, `${videoId}_complete.mp4`);

            if (fs.existsSync(videoPath)) {
                // Get user preferences for this specific video
                const { shouldTrim, startTime, endTime } = await getVideoPreferences(videoId);
                
                if (shouldTrim) {
                    // Trim the video
                    const outputPath = path.join(outputFolder, `${videoId}.mp4`);
                    const startSeconds = timeToSeconds(startTime);
                    const endSeconds = timeToSeconds(endTime);

                    const ffmpegCommand = `ffmpeg -i "${videoPath}" -ss ${startSeconds} -to ${endSeconds} -c copy "${outputPath}" -y`;
                    await executeFFmpeg(ffmpegCommand);
                    console.log(`Trimmed video saved: ${outputPath}`);
                    console.log(`Video trimmed from ${startTime} to ${endTime}`);
                } else {
                    // Copy the video without trimming
                    const destinationPath = copyToOutput(videoPath, videoId);
                    console.log(`Video copied to output: ${destinationPath}`);
                }
            } else {
                console.log(`Video ${videoId}_complete.mp4 not found in ${videoFolder}/${videoId}`);
            }
        }

        console.log("\nAll videos processed!");
        rl.close();
    } catch (error) {
        console.error("An error occurred:", error);
        rl.close();
    }
}

// Start processing
processVideos();