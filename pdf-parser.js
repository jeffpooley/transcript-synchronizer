/**
 * PDF Parser Module
 * Extracts text from PDF files and identifies speaker segments
 */

class PDFParser {
    /**
     * Extract text from a PDF file
     * @param {File} file - The PDF file
     * @returns {Promise<Object>} - Extracted text and speaker segments
     */
    async extractText(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            let fullText = '';
            const pages = [];

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

            // Parse speaker segments
            const segments = this.parseSpeakerSegments(fullText);

            return {
                fullText: fullText.trim(),
                pages,
                segments,
                success: true
            };
        } catch (error) {
            console.error('Error extracting PDF text:', error);
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

        // Common patterns for speaker identification:
        // "Name:" or "INTERVIEWER:" or "Q:" or "A:" etc.
        const speakerPattern = /^([A-Z][A-Za-z\s\.]+:|[A-Z]+:|Q:|A:)/gm;

        // Split text by potential speaker markers
        const lines = text.split('\n');
        let currentSpeaker = null;
        let currentText = '';

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            // Check if line starts with a speaker label
            const speakerMatch = trimmedLine.match(/^([A-Z][A-Za-z\s\.]+?:|[A-Z]+?:|Q:|A:)\s*/);

            if (speakerMatch) {
                // Save previous segment if exists
                if (currentSpeaker && currentText.trim()) {
                    segments.push({
                        speaker: currentSpeaker,
                        text: currentText.trim()
                    });
                }

                // Start new segment
                currentSpeaker = speakerMatch[1].replace(':', '').trim();
                currentText = trimmedLine.substring(speakerMatch[0].length);
            } else {
                // Continue current segment
                currentText += ' ' + trimmedLine;
            }
        }

        // Add final segment
        if (currentSpeaker && currentText.trim()) {
            segments.push({
                speaker: currentSpeaker,
                text: currentText.trim()
            });
        }

        // If no speaker segments found, create one segment with all text
        if (segments.length === 0) {
            segments.push({
                speaker: 'Unknown',
                text: text.trim()
            });
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
