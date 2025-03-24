const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const csv = require('csv-parser');

const basePath = path.join(__dirname, 'Youtube_downloads3');
const csvFilePath = path.join(__dirname, 'LPS_Video.csv'); // Change if needed

// Ensure base directory exists
if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
}
 
// Function to extract video ID from YouTube URL
const getVideoId = (url) => {
    const match = url.match(/v=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
};

const getVideoDuration = (url) => {
    try {
        // Get video info using yt-dlp in JSON format
        const infoCmd = `python -m yt_dlp -J "${url}"`;
        const videoInfo = JSON.parse(execSync(infoCmd).toString());
        return videoInfo.duration;
    } catch (error) {
        console.error(`Error getting video duration: ${error.message}`);
        return null;
    }
};

const downloadVideo = (url) => {
    try {
        const videoId = getVideoId(url);
        if (!videoId) {
            console.error(`Skipping invalid URL: ${url}`);
            return;
        }

        const videoFolder = path.join(basePath, videoId);
        if (!fs.existsSync(videoFolder)) {
            fs.mkdirSync(videoFolder, { recursive: true });
        }

        const keyframePath = path.join(videoFolder, `${videoId}_keyframe.jpg`);
        
        // Check if keyframe already exists
        if (fs.existsSync(keyframePath)) {
            console.log(`Keyframe already exists for: ${url}`);
            return;
        }

        // Get video duration and calculate middle timestamp
        const duration = getVideoDuration(url);
        if (!duration) {
            console.error(`Could not get duration for: ${url}`);
            return;
        }

        const middleTimestamp = Math.floor(duration / 2);
        const startTime = Math.max(0, middleTimestamp - 1);
        const endTime = middleTimestamp + 1;
        
        console.log(`Video duration: ${duration}s, extracting frame at: ${middleTimestamp}s`);

        // First download a small segment of the video
        const tempVideoPath = path.join(videoFolder, `${videoId}_temp.mp4`);
        // Using correct time range format "*start-end"
        const downloadCmd = `python -m yt_dlp -f "bestvideo[height>=1080][ext=mp4]" --download-sections "*${startTime}-${endTime}" -o "${tempVideoPath}" "${url}"`;
        console.log(`Downloading video segment: ${url}`);
        execSync(downloadCmd, { stdio: 'inherit' });

        // Then extract the frame using ffmpeg
        const ffmpegCmd = `ffmpeg -i "${tempVideoPath}" -vf "scale=1920:1080" -vframes 1 "${keyframePath}"`;
        console.log(`Extracting keyframe...`);
        execSync(ffmpegCmd, { stdio: 'inherit' });

        // Clean up temporary file
        if (fs.existsSync(tempVideoPath)) {
            fs.unlinkSync(tempVideoPath);
        }
        console.log(`Extracted high-res keyframe: ${url}\n`);

    } catch (error) {
        console.error(`Error processing ${url}:`, error.message);
        if (error.stderr) {
            console.error('Error details:', error.stderr.toString());
        }
    }
};

// Add error handling for CSV reading
fs.createReadStream(csvFilePath)
    .on('error', (error) => {
        console.error('Error reading CSV file:', error);
    })
    .pipe(csv())
    .on('data', (row) => {
        const columnName = 'Youtube link (Explore_More)';
        const url = row[columnName];
        if (url && url.trim()) {  // Check for empty strings
            downloadVideo(url.trim());
        } else {
            console.log('Skipping row with empty URL');
        }
    })
    .on('end', () => {
        console.log('All downloads completed.');
    });
