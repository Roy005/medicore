import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Document } from '../entities/document.entity';

/**
 * DocumentExtractionService — Extracts text from uploaded documents.
 *
 * Strategy:
 *   - PDF: Uses `pdf-parse` to extract embedded text (no API calls needed).
 *   - Images (JPEG/PNG):
 *       1. Primary: Gemini Vision API (best quality, handles handwriting)
 *       2. Fallback: Tesseract.js (local OCR, no API calls, good for printed text)
 *
 * Extraction runs asynchronously after document upload (fire-and-forget).
 */
@Injectable()
export class DocumentExtractionService {
  private readonly logger = new Logger(DocumentExtractionService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Extract text from a document and save it to the database.
   * This is designed to be called fire-and-forget after upload.
   */
  async extractAndSave(documentId: string): Promise<void> {
    const doc = await this.documentRepo.findOne({ where: { id: documentId } });
    if (!doc || !doc.file_data) {
      this.logger.warn(`Document ${documentId} not found or has no file data`);
      await this.documentRepo.update(documentId, { extraction_status: 'failed' });
      return;
    }

    try {
      let text = '';

      if (doc.mimetype === 'application/pdf') {
        text = await this.extractFromPdf(doc.file_data);
      } else if (['image/jpeg', 'image/png'].includes(doc.mimetype)) {
        text = await this.extractFromImage(doc.file_data, doc.mimetype);
      } else {
        this.logger.warn(`Unsupported mimetype for extraction: ${doc.mimetype}`);
        await this.documentRepo.update(documentId, { extraction_status: 'failed' });
        return;
      }

      if (text && text.trim().length > 0) {
        await this.documentRepo.update(documentId, {
          extracted_text: text.trim(),
          extraction_status: 'completed',
        });
        this.logger.log(
          `✓ Extracted ${text.trim().length} chars from "${doc.original_name}"`,
        );
      } else {
        await this.documentRepo.update(documentId, { extraction_status: 'failed' });
        this.logger.warn(`No text extracted from "${doc.original_name}"`);
      }
    } catch (err: any) {
      this.logger.error(
        `Extraction failed for "${doc.original_name}": ${err.message}`,
      );
      await this.documentRepo.update(documentId, { extraction_status: 'failed' });
    }
  }

  // ── PDF Extraction ──────────────────────────────────────────────────

  private async extractFromPdf(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (err: any) {
      this.logger.error(`pdf-parse error: ${err.message}`);
      return '';
    }
  }

  // ── Image Extraction (Gemini Vision primary → Tesseract.js fallback) ──

  private async extractFromImage(buffer: Buffer, mimetype: string): Promise<string> {
    // 1. Try Gemini Vision (best quality, handles handwriting)
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      try {
        const text = await this.extractWithGeminiVision(buffer, mimetype, geminiKey);
        if (text && text.trim().length > 0) {
          this.logger.log('Image OCR via Gemini Vision ✓');
          return text;
        }
      } catch (err: any) {
        this.logger.warn(`Gemini Vision failed (${err.message}), falling back to Tesseract.js`);
      }
    }

    // 2. Fallback to Tesseract.js (local OCR, no API needed)
    try {
      const text = await this.extractWithTesseract(buffer);
      if (text && text.trim().length > 0) {
        this.logger.log('Image OCR via Tesseract.js fallback ✓');
        return text;
      }
    } catch (err: any) {
      this.logger.error(`Tesseract.js also failed: ${err.message}`);
    }

    return '';
  }

  // ── Gemini Vision OCR ─────────────────────────────────────────────

  private async extractWithGeminiVision(
    buffer: Buffer,
    mimetype: string,
    apiKey: string,
  ): Promise<string> {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const base64Data = buffer.toString('base64');
    const result = await model.generateContent([
      'Extract ALL text from this medical document. Return only the raw extracted text content, no commentary or formatting instructions.',
      {
        inlineData: {
          mimeType: mimetype,
          data: base64Data,
        },
      },
    ]);

    return result.response.text();
  }

  // ── Tesseract.js OCR (Fallback) ───────────────────────────────────

  private async extractWithTesseract(buffer: Buffer): Promise<string> {
    const Tesseract = require('tesseract.js');
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
      logger: () => {}, // Suppress verbose logging
    });
    return text || '';
  }
}
