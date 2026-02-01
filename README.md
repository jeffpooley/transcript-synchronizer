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

## Status

In development.
