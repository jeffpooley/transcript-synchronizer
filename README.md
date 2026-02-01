# Transcript Synchronizer

A web application for merging timestamped SRT files with corrected PDF transcripts to produce accurate, timestamped transcriptions.

## Problem Statement

When transcribing oral history interviews:
- Automated transcription (e.g., MacWhisper) produces SRT files with timestamps but uncorrected text
- Manual corrections are made in PDF format without timestamps
- Need to combine corrected text with original timestamps

## Solution

This tool aligns the corrected transcript with the timestamped version and generates a new SRT file with:
- Corrected text from the PDF
- Accurate timestamps from the original SRT
- Timestamps only at speaker changes
- Automatic splitting of segments longer than 2 minutes

## Features

- **Client-side processing**: All processing happens in your browser - no server needed, completely private
- **Smart text alignment**: Uses intelligent algorithms to match corrected text with timestamped versions
- **Speaker detection**: Automatically identifies and tracks speaker changes using labels (e.g., "John:", "Interviewer:")
- **Smart segmentation**: Timestamps only at speaker changes, with automatic splitting of segments longer than 2 minutes
- **Drag-and-drop interface**: Easy-to-use web interface

## How to Use

1. **Open the app**: Simply open `index.html` in a modern web browser (Chrome, Firefox, Safari, Edge)

2. **Upload your files**:
   - **Corrected Transcript (PDF)**: Your manually corrected transcript with speaker labels
   - **Timestamped SRT**: The original SRT file from MacWhisper (or similar tool) with timestamps

3. **Process**: Click the "Process Files" button

4. **Download**: Download your new, corrected SRT file with accurate timestamps

## Requirements

- Modern web browser with JavaScript enabled
- PDF with speaker labels in format: "Speaker Name:" or "INTERVIEWER:"
- SRT file with standard subtitle format

## Technical Details

### Architecture

- **Frontend**: Pure HTML/CSS/JavaScript (no build process required)
- **PDF Processing**: PDF.js library for text extraction
- **Text Alignment**: Custom algorithm using similarity scoring and sequence matching
- **Client-side only**: No data leaves your computer

### How It Works

1. Extracts text from the corrected PDF, identifying speaker segments
2. Parses the timestamped SRT file into structured data
3. Aligns the corrected text with the uncorrected text using similarity matching
4. Transfers timestamps from the original SRT to the corrected text
5. Merges consecutive segments from the same speaker
6. Splits segments longer than 2 minutes at natural boundaries
7. Generates a new SRT file ready for use

## Development

To modify or extend the application:

```bash
# Clone the repository
git clone https://github.com/jeffpooley/transcript-synchronizer.git
cd transcript-synchronizer

# Open index.html in your browser
open index.html
```

### File Structure

- `index.html` - Main application interface
- `styles.css` - Application styling
- `app.js` - Main application logic and UI handling
- `pdf-parser.js` - PDF text extraction and speaker detection
- `srt-parser.js` - SRT file parsing and generation
- `text-aligner.js` - Text alignment and timestamp transfer algorithms

## License

MIT License - feel free to use and modify for your projects.
