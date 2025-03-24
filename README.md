# YouTube Video Audio Processing Pipeline

## 🚀 Usage

### 1. Download YouTube Videos
```bash
node Yt_video_download.js
```
- Reads video URLs from `LPS_Video.csv`
- Downloads video and extracts audio
- Creates a folder for each video ID

### 2. Generate Subtitles
```bash
node srt_file_code.js
```
- Uses AssemblyAI to transcribe audio
- Generates SRT subtitle file
- Includes silence detection

### 3. Create TTS Audio
```bash
node final_code.mjs
```
- Reads the SRT file
- Generates TTS audio for each subtitle line
- Uses Murf.ai for natural-sounding speech
- Maintains timing information

### 4. Merge Audio and Video
```bash
node merge_audio_video.mjs <video_id>
```
- Combines muted video with TTS audio files
- Maintains precise timing synchronization
- Creates final output video

## 📝 File Descriptions

### Yt_video_download.js
- Downloads YouTube videos using yt-dlp
- Extracts high-quality audio
- Creates organized folder structure

### srt_file_code.js
- Handles speech-to-text conversion
- Generates properly formatted SRT files
- Includes silence detection for music/quiet sections

### final_code.mjs
- Processes SRT files
- Generates TTS audio with natural voice
- Maintains timing information in filenames

### merge_audio_video.mjs
- Merges all TTS audio files with video
- Handles precise audio timing
- Uses FFmpeg for professional-quality output

## ⚙️ Configuration

### Environment Variables
```env
ASSEMBLYAI_API_KEY=your_key_here  # For speech-to-text
MURF_API_KEY=your_key_here        # For text-to-speech
```

### Voice Settings
- Default voice: "en-IN-isha" (Indian English)
- Adjustable parameters in `final_code.mjs`:
  - Speech rate
  - Pitch
  - Audio quality
  - Voice selection

## 🔍 Error Handling

- Each script includes comprehensive error checking
- Detailed logging for troubleshooting
- Validation of input files and API responses
- Graceful handling of missing files/folders

## 📊 Output

The final output includes:
- Original video without audio
- Generated subtitle file (SRT)
- Individual TTS audio files
- Final merged video with synthetic speech

## ⚠️ Limitations

- Requires active API keys
- Processing time depends on video length
- API rate limits may apply
- Requires sufficient disk space for processing

## 🤝 Contributing

Feel free to submit issues, fork the repository, and create pull requests for any improvements.

## 📜 License

[Your chosen license]

## 🙏 Acknowledgments

- AssemblyAI for speech-to-text API
- Murf.ai for text-to-speech API
- FFmpeg for audio/video processing
- yt-dlp for YouTube downloads
