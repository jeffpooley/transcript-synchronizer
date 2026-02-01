/**
 * SRT Parser Module
 * Parses SRT subtitle files and generates new SRT files
 */

class SRTParser {
    /**
     * Parse an SRT file into structured data
     * @param {File} file - The SRT file
     * @returns {Promise<Object>} - Parsed SRT data
     */
    async parse(file) {
        try {
            const text = await file.text();
            const subtitles = this.parseSRT(text);

            return {
                subtitles,
                fullText: this.extractFullText(subtitles),
                success: true
            };
        } catch (error) {
            console.error('Error parsing SRT file:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Parse SRT text format into structured array
     * @param {string} srtText - Raw SRT text
     * @returns {Array} - Array of subtitle objects
     */
    parseSRT(srtText) {
        const subtitles = [];
        const blocks = srtText.trim().split(/\n\s*\n/);

        for (const block of blocks) {
            const lines = block.trim().split('\n');
            if (lines.length < 3) continue;

            const index = parseInt(lines[0]);
            const timeLine = lines[1];
            const text = lines.slice(2).join(' ');

            // Parse timestamp line (format: 00:00:00,000 --> 00:00:05,000)
            const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);

            if (timeMatch) {
                subtitles.push({
                    index,
                    startTime: timeMatch[1],
                    endTime: timeMatch[2],
                    startMs: this.timeToMs(timeMatch[1]),
                    endMs: this.timeToMs(timeMatch[2]),
                    text: text.trim()
                });
            }
        }

        return subtitles;
    }

    /**
     * Convert SRT timestamp to milliseconds
     * @param {string} time - Time in format HH:MM:SS,mmm
     * @returns {number} - Time in milliseconds
     */
    timeToMs(time) {
        const [hms, ms] = time.split(',');
        const [hours, minutes, seconds] = hms.split(':').map(Number);
        return (hours * 3600000) + (minutes * 60000) + (seconds * 1000) + Number(ms);
    }

    /**
     * Convert milliseconds to SRT timestamp format
     * @param {number} ms - Time in milliseconds
     * @returns {string} - Time in format HH:MM:SS,mmm
     */
    msToTime(ms) {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const milliseconds = ms % 1000;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
    }

    /**
     * Extract full text from subtitle array (without timestamps)
     * @param {Array} subtitles - Array of subtitle objects
     * @returns {string} - Combined text
     */
    extractFullText(subtitles) {
        return subtitles.map(sub => sub.text).join(' ');
    }

    /**
     * Generate SRT file content from segments
     * @param {Array} segments - Array of segments with text, startTime, endTime
     * @returns {string} - SRT formatted text
     */
    generate(segments) {
        let srtContent = '';

        segments.forEach((segment, index) => {
            srtContent += `${index + 1}\n`;
            srtContent += `${segment.startTime} --> ${segment.endTime}\n`;

            // Format the text with proper speaker label formatting
            const formattedText = this.formatSpeakerLabel(segment.speaker, segment.text);
            srtContent += `${formattedText}\n\n`;
        });

        return srtContent.trim();
    }

    /**
     * Format text with speaker label on its own line
     * @param {string} speaker - Speaker name
     * @param {string} text - Text content
     * @returns {string} - Properly formatted text
     */
    formatSpeakerLabel(speaker, text) {
        // Remove any existing speaker label from the beginning of text
        // Pattern matches "Name:" or "NAME:" at start, possibly with extra spaces
        const speakerPattern = new RegExp(`^${speaker}\\s*:\\s*`, 'i');
        let cleanText = text.replace(speakerPattern, '').trim();

        // Also try to match any speaker label pattern at the start
        cleanText = cleanText.replace(/^[A-Z][A-Za-z\s\.]*?\s*:\s*/, '').trim();

        // Return speaker label on its own line (no space before colon), followed by text
        return `${speaker}:\n${cleanText}`;
    }

    /**
     * Split a long text segment into smaller chunks at sentence boundaries
     * @param {string} text - Text to split
     * @param {number} maxLength - Maximum length per chunk
     * @returns {Array} - Array of text chunks
     */
    splitTextIntoChunks(text, maxLength = 200) {
        const chunks = [];
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

        let currentChunk = '';

        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > maxLength && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += sentence;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }

        // If no chunks created, split by words
        if (chunks.length === 0) {
            const words = text.split(' ');
            currentChunk = '';

            for (const word of words) {
                if ((currentChunk + ' ' + word).length > maxLength && currentChunk) {
                    chunks.push(currentChunk.trim());
                    currentChunk = word;
                } else {
                    currentChunk += (currentChunk ? ' ' : '') + word;
                }
            }

            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
        }

        return chunks.length > 0 ? chunks : [text];
    }

    /**
     * Clean and normalize text for better matching
     * @param {string} text - Text to clean
     * @returns {string} - Cleaned text
     */
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/[""]/g, '"')
            .replace(/['']/g, "'")
            .toLowerCase()
            .trim();
    }
}

// Export for use in other modules
window.SRTParser = SRTParser;
