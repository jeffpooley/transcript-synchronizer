/**
 * PDF/TXT Parser Module
 * Extracts text from PDF or TXT files and identifies speaker segments
 */

class PDFParser {
    /**
     * Extract text from a PDF or TXT file
     * @param {File} file - The PDF or TXT file
     * @returns {Promise<Object>} - Extracted text and speaker segments
     */
    async extractText(file) {
        try {
            // Check file type
            const fileName = file.name.toLowerCase();
            const isTxt = fileName.endsWith('.txt');

            let fullText = '';
            let pages = [];

            if (isTxt) {
                // Handle plain text file
                fullText = await file.text();
                pages = [fullText]; // Treat entire file as one "page"
                console.log('Extracted text from TXT file');
            } else {
                // Handle PDF file
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

                // Extract text from each page
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();

                    // Combine text items with proper spacing
                    const pageText = textContent.items
                        .map(item => item.str)
                        .join(' ')
                        .replace(/\s+/g, ' '); // Normalize whitespace

                    pages.push(pageText);
                    fullText += pageText + '\n';
                }
                console.log('Extracted text from PDF file');
            }

            // Parse speaker segments (same for both file types)
            const segments = this.parseSpeakerSegments(fullText);

            return {
                fullText: fullText.trim(),
                pages,
                segments,
                success: true
            };
        } catch (error) {
            console.error('Error extracting text:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Parse text into speaker segments
     * Looks for patterns like "Name:" or "Interviewer:" to identify speakers
     * @param {string} text - The full text from PDF
     * @returns {Array} - Array of speaker segments
     */
    parseSpeakerSegments(text) {
        const segments = [];

        // Split by speaker patterns using a regex that captures the full speaker turn
        // Match patterns like "Q1:" or "FUCHS:" or other single-word caps followed by colon
        const speakerRegex = /\b(Q\d+|FUCHS|[A-Z][A-Z]+)\s*:\s*/g;

        let lastIndex = 0;
        let currentMatch;
        let previousSpeaker = null;
        let previousStart = 0;

        while ((currentMatch = speakerRegex.exec(text)) !== null) {
            const speaker = currentMatch[1];
            const matchStart = currentMatch.index;
            const matchEnd = speakerRegex.lastIndex;

            // If we have a previous speaker, save their segment
            if (previousSpeaker) {
                const segmentText = text.substring(previousStart, matchStart).trim();
                if (segmentText) {
                    segments.push({
                        speaker: previousSpeaker,
                        text: segmentText
                    });
                }
            }

            previousSpeaker = speaker;
            previousStart = matchEnd;
        }

        // Add the final segment
        if (previousSpeaker) {
            const segmentText = text.substring(previousStart).trim();
            if (segmentText) {
                segments.push({
                    speaker: previousSpeaker,
                    text: segmentText
                });
            }
        }

        // If no speaker segments found, return empty (front matter only)
        if (segments.length === 0) {
            console.warn('No speaker segments found in PDF');
        }

        return segments;
    }

    /**
     * Clean and normalize text for better matching
     * @param {string} text - Text to clean
     * @returns {string} - Cleaned text
     */
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/[""]/g, '"') // Normalize quotes
            .replace(/['']/g, "'") // Normalize apostrophes
            .trim();
    }
}

// Export for use in other modules
window.PDFParser = PDFParser;
