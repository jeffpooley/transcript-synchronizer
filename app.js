/**
 * Main Application
 * Handles UI interactions and coordinates the transcript synchronization process
 */

class TranscriptSynchronizer {
    constructor() {
        this.pdfFile = null;
        this.srtFile = null;
        this.resultSRT = null;
        this.stats = {};

        // Initialize parsers
        this.pdfParser = new PDFParser();
        this.srtParser = new SRTParser();
        this.textAligner = new TextAligner();

        this.initializeUI();
    }

    initializeUI() {
        // Get DOM elements
        this.pdfUploadBox = document.getElementById('pdfUpload');
        this.srtUploadBox = document.getElementById('srtUpload');
        this.pdfFileInput = document.getElementById('pdfFile');
        this.srtFileInput = document.getElementById('srtFile');
        this.pdfFileName = document.getElementById('pdfFileName');
        this.srtFileName = document.getElementById('srtFileName');
        this.processBtn = document.getElementById('processBtn');
        this.progressBar = document.getElementById('progressBar');
        this.resultSection = document.getElementById('resultSection');
        this.errorSection = document.getElementById('errorSection');
        this.errorText = document.getElementById('errorText');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.statsDiv = document.getElementById('stats');

        // Set up event listeners
        this.setupFileUpload(
            this.pdfUploadBox,
            this.pdfFileInput,
            this.pdfFileName,
            ['pdf', 'txt'],
            file => this.pdfFile = file
        );

        this.setupFileUpload(
            this.srtUploadBox,
            this.srtFileInput,
            this.srtFileName,
            'srt',
            file => this.srtFile = file
        );

        this.processBtn.addEventListener('click', () => this.process());
        this.downloadBtn.addEventListener('click', () => this.download());
    }

    setupFileUpload(uploadBox, fileInput, fileNameDisplay, fileType, callback) {
        // Click to upload
        uploadBox.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileSelected(file, uploadBox, fileNameDisplay, fileType, callback);
            }
        });

        // Drag and drop
        uploadBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadBox.style.borderColor = '#667eea';
        });

        uploadBox.addEventListener('dragleave', () => {
            uploadBox.style.borderColor = '#ddd';
        });

        uploadBox.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadBox.style.borderColor = '#ddd';

            const file = e.dataTransfer.files[0];
            if (file) {
                this.handleFileSelected(file, uploadBox, fileNameDisplay, fileType, callback);
            }
        });
    }

    handleFileSelected(file, uploadBox, fileNameDisplay, fileType, callback) {
        const extension = file.name.split('.').pop().toLowerCase();

        // Handle both single file type and array of file types
        const allowedTypes = Array.isArray(fileType) ? fileType : [fileType];

        if (!allowedTypes.includes(extension)) {
            const typeList = allowedTypes.map(t => `.${t}`).join(' or ');
            this.showError(`Please select a ${typeList} file`);
            return;
        }

        callback(file);
        fileNameDisplay.textContent = file.name;
        uploadBox.classList.add('active');

        // Enable process button if both files are selected
        if (this.pdfFile && this.srtFile) {
            this.processBtn.disabled = false;
        }

        // Hide any previous results
        this.resultSection.classList.add('hidden');
        this.errorSection.classList.add('hidden');
    }

    async process() {
        try {
            this.showProgress();
            this.hideError();
            this.hideResult();

            // Step 1: Extract text from transcript file
            const fileType = this.pdfFile.name.split('.').pop().toUpperCase();
            console.log(`Extracting text from ${fileType}...`);
            const pdfResult = await this.pdfParser.extractText(this.pdfFile);

            if (!pdfResult.success) {
                throw new Error(`Transcript parsing failed: ${pdfResult.error}`);
            }

            console.log(`Found ${pdfResult.segments.length} speaker segments in transcript`);

            // Step 2: Parse SRT file
            console.log('Parsing SRT file...');
            const srtResult = await this.srtParser.parse(this.srtFile);

            if (!srtResult.success) {
                throw new Error(`SRT parsing failed: ${srtResult.error}`);
            }

            console.log(`Found ${srtResult.subtitles.length} subtitles in SRT`);

            // Step 3: Align texts and transfer timestamps
            console.log('Aligning texts and transferring timestamps...');
            const alignedSegments = this.textAligner.align(
                pdfResult.segments,
                srtResult.subtitles
            );

            if (alignedSegments.length === 0) {
                throw new Error('Could not align the texts. Please ensure the PDF and SRT files are from the same interview.');
            }

            console.log(`Aligned ${alignedSegments.length} segments`);

            // Step 4: Process segments (merge by speaker, split long ones)
            console.log('Processing segments...');
            const processedSegments = this.textAligner.processSegments(alignedSegments);

            console.log(`Final segments: ${processedSegments.length}`);

            // Step 5: Generate SRT
            console.log('Generating SRT file...');
            this.resultSRT = this.srtParser.generate(processedSegments);

            // Store stats
            this.stats = {
                originalSubtitles: srtResult.subtitles.length,
                pdfSegments: pdfResult.segments.length,
                alignedSegments: alignedSegments.length,
                finalSegments: processedSegments.length,
                duration: this.formatDuration(
                    processedSegments[processedSegments.length - 1].endMs
                )
            };

            // Show result
            this.hideProgress();
            this.showResult();

        } catch (error) {
            console.error('Processing error:', error);
            this.hideProgress();
            this.showError(error.message);
        }
    }

    download() {
        if (!this.resultSRT) {
            this.showError('No result to download');
            return;
        }

        const blob = new Blob([this.resultSRT], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        // Generate filename based on original SRT name
        const originalName = this.srtFile.name.replace('.srt', '');
        a.href = url;
        a.download = `${originalName}_corrected.srt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showProgress() {
        this.processBtn.disabled = true;
        this.progressBar.classList.remove('hidden');
    }

    hideProgress() {
        this.progressBar.classList.add('hidden');
        this.processBtn.disabled = false;
    }

    showResult() {
        this.resultSection.classList.remove('hidden');
        this.statsDiv.innerHTML = `
            <p><strong>Original SRT subtitles:</strong> ${this.stats.originalSubtitles}</p>
            <p><strong>PDF speaker segments:</strong> ${this.stats.pdfSegments}</p>
            <p><strong>Final segments:</strong> ${this.stats.finalSegments}</p>
            <p><strong>Total duration:</strong> ${this.stats.duration}</p>
        `;
    }

    hideResult() {
        this.resultSection.classList.add('hidden');
    }

    showError(message) {
        this.errorSection.classList.remove('hidden');
        this.errorText.textContent = message;
    }

    hideError() {
        this.errorSection.classList.add('hidden');
    }

    formatDuration(ms) {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TranscriptSynchronizer();
});
