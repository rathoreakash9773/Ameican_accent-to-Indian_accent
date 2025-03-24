import fs from "fs-extra";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import SrtParser2 from "srt-parser-2"; // ✅ Correct import
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API keys from environment variables
const MURF_API_KEY = process.env.MURF_API_KEY;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

// Murf API details
const MURF_VOICE_ID = "en-IN-isha"; // Voice ID for Indian accent

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SRT file path
const srtFilePath = path.join(__dirname, "output", "ncORPosDrjI", "ncORPosDrjI.srt");
const outputFolder = path.join(__dirname, "output", "ncORPosDrjI");

// Ensure output folder exists
fs.ensureDirSync(outputFolder);

// Create a new instance of the parser
const parser = new SrtParser2();

// Function to format SRT timestamps
const formatSrtTimestamp = (time) => {
    if (!time || typeof time !== "string") {
        console.error("❌ Invalid time format:", time);
        return "00-00-00-000"; // Fallback to prevent 'undefined'
    }

    // Convert "00:00:07,000" → "00-00-07-000" (filename-friendly)
    return time.replace(/[:,]/g, "-");
};

// Validate API keys
if (!MURF_API_KEY || !ASSEMBLYAI_API_KEY) {
    console.error("❌ Error: Missing API keys in .env file");
    process.exit(1);
}

// Function to generate TTS audio
const generateTTS = async (text, fileName) => {
    try {
        const url = "https://api.murf.ai/v1/speech/generate";
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "api-key": MURF_API_KEY,
        };

        const requestData = {
            voiceId: MURF_VOICE_ID,
            style: "Conversational",
            text: text,
            rate: 0,
            pitch: 0,
            sampleRate: 48000,
            format: "WAV",
            channelType: "MONO",
            pronunciationDictionary: {},
            encodeAsBase64: false,
            variation: 1,
            audioDuration: 0,
            modelVersion: "GEN2",
            multiNativeLocale: "en-IN",
        };

        const response = await axios.post(url, requestData, { headers });

        if (response.data && response.data.audioFile) {
            await downloadAudio(response.data.audioFile, fileName);
        } else {
            console.error(`❌ Error: No audio file in response:`, response.data);
        }
    } catch (error) {
        console.error(`❌ API Error:`, error.response ? error.response.data : error.message);
    }
};

// Function to download audio file
const downloadAudio = async (audioUrl, fileName) => {
    try {
        const response = await axios({
            url: audioUrl,
            method: "GET",
            responseType: "stream",
        });

        const filePath = path.join(outputFolder, fileName);
        const writer = fs.createWriteStream(filePath);

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on("finish", () => {
                console.log(`✅ TTS Saved: ${filePath}`);
                resolve();
            });
            writer.on("error", reject);
        });
    } catch (error) {
        console.error(`❌ Failed to download audio: ${error.message}`);
    }
};

// Function to process SRT file
const processSRT = async () => {
    try {
        const srtContent = fs.readFileSync(srtFilePath, "utf-8");
        const subtitles = parser.fromSrt(srtContent);

        console.log("Parsed subtitles:", subtitles); // Debugging

        for (const sub of subtitles) {
            if (!sub.startTime || !sub.endTime) {
                console.error("❌ Skipping subtitle due to missing start or end time:", sub);
                continue;
            }

            const startTime = formatSrtTimestamp(sub.startTime);
            const endTime = formatSrtTimestamp(sub.endTime);
            const text = sub.text.replace(/\n/g, " "); // Merge multiline subtitles

            console.log(`Processing Subtitle: ${startTime} --> ${endTime} | Text: ${text}`);

            if (!startTime || !endTime || !text.trim()) {
                console.error("❌ Skipping subtitle with invalid data:", sub);
                continue;
            }

            const fileName = `tts_${startTime}_${endTime}.wav`;

            await generateTTS(text, fileName);
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Prevent API rate limiting
        }

        console.log(`\n✅ All TTS audio files generated successfully in: ${outputFolder}`);
    } catch (error) {
        console.error("❌ Error processing SRT file:", error.message);
    }
};

// Run the script
processSRT();








