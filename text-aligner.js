/**
 * Text Aligner Module
 * Aligns corrected transcript with timestamped SRT to transfer timestamps
 */

class TextAligner {
    constructor() {
        this.srtParser = new SRTParser();
    }

    /**
     * Main alignment function using two-pass anchor-based approach
     * @param {Array} pdfSegments - Speaker segments from corrected PDF
     * @param {Array} srtSubtitles - Parsed SRT subtitles with timestamps
     * @returns {Array} - All segments with timestamps (anchored or interpolated)
     */
    align(pdfSegments, srtSubtitles) {
        // Smart detection: Find where the actual transcript starts in the PDF
        const startIndex = this.findTranscriptStart(pdfSegments, srtSubtitles);

        if (startIndex > 0) {
            console.log(`Skipping front matter: ignoring first ${startIndex} PDF segments`);
        }

        // PASS 1: Find high-confidence anchor points
        console.log('\n=== PASS 1: Finding anchor points ===');
        const MIN_ANCHOR_CONFIDENCE = 0.45; // Lowered from 0.5 to get more anchors
        const anchors = [];
        let srtIndex = 0;

        for (let i = startIndex; i < pdfSegments.length; i++) {
            if (srtIndex >= srtSubtitles.length - 5) break;

            const pdfSegment = pdfSegments[i];
            const pdfText = this.cleanText(pdfSegment.text);
            const pdfWords = pdfText.split(/\s+/);

            const match = this.findBestMatch(pdfWords, srtSubtitles, srtIndex);

            if (match && match.confidence >= MIN_ANCHOR_CONFIDENCE) {
                anchors.push({
                    pdfIndex: i,
                    speaker: pdfSegment.speaker,
                    startMs: match.startMs,
                    endMs: match.endMs,
                    confidence: match.confidence
                });
                console.log(`  Anchor ${anchors.length}: PDF segment ${i} (${pdfSegment.speaker}) → SRT ${match.startIndex}-${match.endIndex} (confidence: ${match.confidence.toFixed(2)})`);
                srtIndex = match.endIndex + 1;
            } else {
                // Move forward slowly to not skip content
                srtIndex = Math.min(srtIndex + 1, srtSubtitles.length - 1);
            }
        }

        console.log(`\nFound ${anchors.length} anchor points with confidence >= ${MIN_ANCHOR_CONFIDENCE}`);

        // PASS 2: Create timestamps for all segments (anchored or interpolated)
        console.log('\n=== PASS 2: Interpolating timestamps ===');

        // Get total duration from VTT for proper interpolation
        const totalDurationMs = srtSubtitles[srtSubtitles.length - 1].endMs;
        const totalSegments = pdfSegments.length - startIndex;
        console.log(`Total VTT duration: ${this.srtParser.msToTime(totalDurationMs)}`);

        const result = [];
        let interpolatedCount = 0;

        for (let i = startIndex; i < pdfSegments.length; i++) {
            const pdfSegment = pdfSegments[i];
            const anchor = anchors.find(a => a.pdfIndex === i);

            if (anchor) {
                // Use anchor timestamp
                result.push({
                    speaker: pdfSegment.speaker,
                    text: pdfSegment.text,
                    startTime: this.srtParser.msToTime(anchor.startMs),
                    endTime: this.srtParser.msToTime(anchor.endMs),
                    startMs: anchor.startMs,
                    endMs: anchor.endMs
                });
            } else {
                // Interpolate timestamp with total duration context
                const interpolated = this.interpolateTimestamp(i, anchors, totalDurationMs, totalSegments, startIndex);
                result.push({
                    speaker: pdfSegment.speaker,
                    text: pdfSegment.text,
                    startTime: this.srtParser.msToTime(interpolated.startMs),
                    endTime: this.srtParser.msToTime(interpolated.endMs),
                    startMs: interpolated.startMs,
                    endMs: interpolated.endMs
                });
                interpolatedCount++;
            }
        }

        console.log(`\nAlignment complete:`);
        console.log(`  - ${anchors.length} segments with matched timestamps`);
        console.log(`  - ${interpolatedCount} segments with interpolated timestamps`);
        console.log(`  - ${result.length} total segments in output`);

        return result;
    }

    /**
     * Find where the actual transcript starts in the PDF
     * Skips front matter by finding the first segment that aligns well with SRT
     * @param {Array} pdfSegments - Speaker segments from PDF
     * @param {Array} srtSubtitles - Parsed SRT subtitles
     * @returns {number} - Index of first segment that's part of the actual transcript
     */
    findTranscriptStart(pdfSegments, srtSubtitles) {
        const MIN_CONFIDENCE = 0.4; // Threshold for considering a match valid
        const SEARCH_LIMIT = Math.min(20, pdfSegments.length); // Check more segments

        // Get first few words from SRT to use as anchor
        const firstSrtText = srtSubtitles.slice(0, 5).map(s => s.text).join(' ');
        const firstSrtWords = this.cleanText(firstSrtText).split(/\s+/).slice(0, 10);

        for (let i = 0; i < SEARCH_LIMIT; i++) {
            const pdfSegment = pdfSegments[i];
            const pdfText = this.cleanText(pdfSegment.text);
            const pdfWords = pdfText.split(/\s+/);

            // Skip very short segments (likely headers/titles/metadata)
            if (pdfWords.length < 5) {
                console.log(`Skipping short segment ${i}: "${pdfSegment.text.substring(0, 50)}..."`);
                continue;
            }

            // Check if this segment contains words from the start of the SRT
            const match = this.findBestMatch(pdfWords, srtSubtitles, 0);

            if (match && match.confidence >= MIN_CONFIDENCE) {
                console.log(`Found transcript start at PDF segment ${i} (speaker: ${pdfSegment.speaker}) with confidence ${match.confidence.toFixed(2)}`);
                return i;
            } else {
                console.log(`Segment ${i} (speaker: ${pdfSegment.speaker}) confidence too low: ${match ? match.confidence.toFixed(2) : 'N/A'}`);
            }
        }

        // If no good match found, assume transcript starts at beginning
        console.log('No front matter detected, starting from beginning');
        return 0;
    }

    /**
     * Align a single PDF segment with SRT subtitles
     * @param {Object} pdfSegment - PDF segment with speaker and text
     * @param {Array} srtSubtitles - All SRT subtitles
     * @param {number} startIndex - Index to start searching in SRT
     * @returns {Object} - Aligned segment with timestamps
     */
    alignSegment(pdfSegment, srtSubtitles, startIndex) {
        const pdfText = this.cleanText(pdfSegment.text);
        const pdfWords = pdfText.split(/\s+/);

        // Find the best matching range in SRT
        const match = this.findBestMatch(pdfWords, srtSubtitles, startIndex);

        if (!match) {
            console.warn('No match found for segment:', pdfSegment.speaker);
            return null;
        }

        return {
            speaker: pdfSegment.speaker,
            text: pdfSegment.text,
            startTime: match.startTime,
            endTime: match.endTime,
            startMs: match.startMs,
            endMs: match.endMs,
            lastSrtIndex: match.endIndex,
            confidence: match.confidence
        };
    }

    /**
     * Find the best matching SRT range for given PDF words
     * @param {Array} pdfWords - Words from PDF segment
     * @param {Array} srtSubtitles - All SRT subtitles
     * @param {number} startIndex - Index to start searching
     * @returns {Object} - Match information
     */
    findBestMatch(pdfWords, srtSubtitles, startIndex) {
        const MIN_CONFIDENCE = 0.25; // Minimum threshold for accepting a match
        const windowSize = Math.min(30, srtSubtitles.length - startIndex); // Search next 30 positions
        const maxRangeSize = 30; // Maximum SRT subtitles per PDF segment (allows for longer speaker turns)
        let bestMatch = null;
        let bestScore = 0;

        // Try different window sizes to find best match
        for (let i = startIndex; i < Math.min(startIndex + windowSize, srtSubtitles.length); i++) {
            for (let j = i; j < Math.min(i + maxRangeSize, srtSubtitles.length); j++) {
                const srtRange = srtSubtitles.slice(i, j + 1);
                const srtText = srtRange.map(s => s.text).join(' ');
                const srtWords = this.cleanText(srtText).split(/\s+/);

                const rawScore = this.calculateSimilarity(pdfWords, srtWords);

                // Penalty for large ranges - prefer compact matches
                // Average should be ~3.5 SRT subtitles per PDF segment (986/278)
                // But allow for longer speaker turns (some can be 20-30 subtitles)
                const rangeSize = j - i + 1;
                const sizePenalty = rangeSize > 15 ? (1 - (rangeSize - 15) * 0.02) : 1;
                const score = rawScore * sizePenalty;

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = {
                        startIndex: i,
                        endIndex: j,
                        startTime: srtRange[0].startTime,
                        endTime: srtRange[srtRange.length - 1].endTime,
                        startMs: srtRange[0].startMs,
                        endMs: srtRange[srtRange.length - 1].endMs,
                        confidence: rawScore, // Store original score
                        rangeSize: rangeSize
                    };
                }

                // If we found a very good match with reasonable size, stop searching
                if (score > 0.75 && rangeSize <= 20) break;
            }

            // If we found a very good match, stop searching
            if (bestScore > 0.75) break;
        }

        // Only return match if it meets minimum confidence threshold
        if (bestMatch && bestMatch.confidence >= MIN_CONFIDENCE) {
            console.log(`  → Matched to SRT ${bestMatch.startIndex}-${bestMatch.endIndex} (${bestMatch.rangeSize} subtitles, confidence: ${bestMatch.confidence.toFixed(2)})`);
            return bestMatch;
        }

        return null; // No good match found
    }

    /**
     * Calculate similarity between two word arrays
     * Uses Jaccard similarity with position weighting
     * @param {Array} words1 - First word array
     * @param {Array} words2 - Second word array
     * @returns {number} - Similarity score (0-1)
     */
    calculateSimilarity(words1, words2) {
        const set1 = new Set(words1);
        const set2 = new Set(words2);

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        const jaccardScore = intersection.size / union.size;

        // Also consider word order and length similarity
        const lengthRatio = Math.min(words1.length, words2.length) / Math.max(words1.length, words2.length);

        // Calculate sequential match score (how many words appear in order)
        let sequentialMatches = 0;
        let j = 0;
        for (let i = 0; i < words1.length && j < words2.length; i++) {
            if (words1[i] === words2[j]) {
                sequentialMatches++;
                j++;
            }
        }
        const sequentialScore = sequentialMatches / Math.max(words1.length, words2.length);

        // Combine scores
        return (jaccardScore * 0.5) + (lengthRatio * 0.2) + (sequentialScore * 0.3);
    }

    /**
     * Split long segments (>2 minutes) into smaller ones
     * @param {Array} segments - Aligned segments
     * @returns {Array} - Segments with long ones split
     */
    splitLongSegments(segments) {
        const result = [];
        const maxDuration = 120000; // 2 minutes in milliseconds

        for (const segment of segments) {
            const duration = segment.endMs - segment.startMs;

            if (duration <= maxDuration) {
                result.push(segment);
            } else {
                // Split into smaller chunks
                const chunks = this.srtParser.splitTextIntoChunks(segment.text);
                const timePerChunk = duration / chunks.length;

                chunks.forEach((chunkText, index) => {
                    const startMs = Math.round(segment.startMs + (timePerChunk * index));
                    const endMs = index === chunks.length - 1
                        ? segment.endMs
                        : Math.round(segment.startMs + (timePerChunk * (index + 1)));

                    result.push({
                        speaker: segment.speaker,
                        text: chunkText,
                        startTime: this.srtParser.msToTime(startMs),
                        endTime: this.srtParser.msToTime(endMs),
                        startMs,
                        endMs
                    });
                });
            }
        }

        return result;
    }

    /**
     * Filter segments to only include speaker changes
     * Merges consecutive segments from the same speaker
     * @param {Array} segments - All segments
     * @returns {Array} - Filtered segments
     */
    filterSpeakerChanges(segments) {
        const result = [];
        let currentSegment = null;

        for (const segment of segments) {
            if (!currentSegment || currentSegment.speaker !== segment.speaker) {
                // Speaker changed, save previous and start new
                if (currentSegment) {
                    result.push(currentSegment);
                }
                currentSegment = { ...segment };
            } else {
                // Same speaker, merge text and extend time
                currentSegment.text += ' ' + segment.text;
                currentSegment.endTime = segment.endTime;
                currentSegment.endMs = segment.endMs;
            }
        }

        // Add final segment
        if (currentSegment) {
            result.push(currentSegment);
        }

        return result;
    }

    /**
     * Clean text for comparison
     * @param {string} text - Text to clean
     * @returns {string} - Cleaned text
     */
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/[""]/g, '"')
            .replace(/['']/g, "'")
            .replace(/[^\w\s'"]/g, '')
            .toLowerCase()
            .trim();
    }

    /**
     * Interpolate timestamp for a segment between anchor points
     * @param {number} pdfIndex - Index of PDF segment to interpolate
     * @param {Array} anchors - Array of anchor points {pdfIndex, startMs, endMs}
     * @param {number} totalDurationMs - Total duration of VTT file
     * @param {number} totalSegments - Total number of PDF segments
     * @param {number} startIndex - Index where transcript starts
     * @returns {Object} - {startMs, endMs}
     */
    interpolateTimestamp(pdfIndex, anchors, totalDurationMs, totalSegments, startIndex) {
        if (anchors.length === 0) {
            // No anchors at all - distribute evenly across total duration
            const avgDuration = totalDurationMs / totalSegments;
            const relativeIndex = pdfIndex - startIndex;
            const startMs = Math.round(relativeIndex * avgDuration);
            const endMs = Math.round(startMs + Math.min(3000, avgDuration * 0.8));
            return { startMs, endMs };
        }

        // Find previous and next anchors
        let prevAnchor = null;
        let nextAnchor = null;

        for (const anchor of anchors) {
            if (anchor.pdfIndex < pdfIndex) {
                prevAnchor = anchor;
            } else if (anchor.pdfIndex > pdfIndex && !nextAnchor) {
                nextAnchor = anchor;
                break;
            }
        }

        // Case 1: Between two anchors - linear interpolation
        if (prevAnchor && nextAnchor) {
            const segmentsBetween = nextAnchor.pdfIndex - prevAnchor.pdfIndex;
            const position = pdfIndex - prevAnchor.pdfIndex;
            const ratio = position / segmentsBetween;

            const timeDiff = nextAnchor.startMs - prevAnchor.endMs;
            const startMs = Math.round(prevAnchor.endMs + (timeDiff * ratio));
            const duration = Math.min(3000, timeDiff / segmentsBetween * 0.8); // Don't overlap
            const endMs = Math.round(startMs + duration);

            return { startMs, endMs };
        }

        // Case 2: Before first anchor - extrapolate backward
        if (!prevAnchor && nextAnchor) {
            const segmentsBefore = nextAnchor.pdfIndex - pdfIndex;
            const timeAvailable = nextAnchor.startMs;
            const avgDuration = timeAvailable / (nextAnchor.pdfIndex - startIndex);
            const relativeIndex = pdfIndex - startIndex;
            const startMs = Math.round(Math.max(0, relativeIndex * avgDuration));
            const endMs = Math.round(startMs + Math.min(3000, avgDuration * 0.8));

            return { startMs, endMs };
        }

        // Case 3: After last anchor - distribute remaining time
        if (prevAnchor && !nextAnchor) {
            const segmentsAfter = (startIndex + totalSegments - 1) - prevAnchor.pdfIndex;
            const timeRemaining = totalDurationMs - prevAnchor.endMs;
            const avgDuration = timeRemaining / segmentsAfter;
            const position = pdfIndex - prevAnchor.pdfIndex;
            const startMs = Math.round(prevAnchor.endMs + (position * avgDuration));
            const endMs = Math.round(startMs + Math.min(3000, avgDuration * 0.8));

            return { startMs, endMs };
        }

        // Fallback (shouldn't reach here)
        const avgDuration = totalDurationMs / totalSegments;
        const relativeIndex = pdfIndex - startIndex;
        const startMs = Math.round(relativeIndex * avgDuration);
        const endMs = Math.round(startMs + 3000);
        return { startMs, endMs };
    }

    /**
     * Process segments according to user requirements
     * @param {Array} segments - Aligned segments
     * @param {Object} options - Processing options
     * @returns {Array} - Processed segments
     */
    processSegments(segments, options = {}) {
        let processed = segments;

        // Keep individual segments - each PDF speaker segment stays separate
        // This ensures speaker changes are preserved

        // Split any segments longer than 2 minutes
        processed = this.splitLongSegments(processed);

        return processed;
    }
}

// Export for use in other modules
window.TextAligner = TextAligner;
