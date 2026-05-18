import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentType } from '../entities/document.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { AccessToken } from '../entities/access-token.entity';
import { DocumentExtractionService } from './document-extraction.service';
import { readFileSync, unlinkSync, existsSync } from 'fs';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
    @InjectRepository(AccessToken)
    private readonly accessTokenRepo: Repository<AccessToken>,
    private readonly extractionService: DocumentExtractionService,
  ) {}

  private async authorizeAccess(patientId: string, user: any) {
    if (user.role === 'patient') {
      const profile = await this.profileRepo.findOne({ where: { user_id: user.userId } });
      if (!profile || profile.id !== patientId) {
        throw new ForbiddenException('You can only access your own profile docs');
      }
    } else if (user.role === 'doctor') {
      const count = await this.accessTokenRepo
        .createQueryBuilder('token')
        .where('token.patient_id = :patientId', { patientId })
        .andWhere('token.granted_to_user_id = :userId', { userId: user.userId })
        .andWhere('token.revoked_at IS NULL')
        .andWhere('(token.expires_at IS NULL OR token.expires_at > NOW())')
        .getCount();

      if (count === 0) {
        throw new ForbiddenException('You do not have a valid access token for this patient docs');
      }
    } else {
      throw new ForbiddenException('Role not authorized for this action');
    }
  }

  async processUpload(patientId: string, file: Express.Multer.File, user: any) {
    await this.authorizeAccess(patientId, user);

    // Read file data from disk (written by multer) and store in DB
    let fileData: Buffer | null = null;
    try {
      fileData = readFileSync(file.path);
    } catch (err) {
      this.logger.warn(`Could not read uploaded file from disk: ${(err as Error).message}`);
      // Fallback: use file.buffer if available (memory storage)
      fileData = file.buffer || null;
    }

    const document = this.documentRepo.create({
      patient_id: patientId,
      filename: file.filename,
      original_name: file.originalname,
      mimetype: file.mimetype,
      size_bytes: file.size,
      uploaded_by: user.userId,
      document_type: DocumentType.OTHER,
      file_data: fileData,
    });

    const savedDocument = await this.documentRepo.save(document);

    // Clean up disk file since we stored in DB
    try {
      if (file.path && existsSync(file.path)) {
        unlinkSync(file.path);
      }
    } catch {
      // Non-critical: disk cleanup failed
    }

    await this.auditLogRepo.insert({
      event_type: 'document_uploaded',
      actor_user_id: user.userId,
      patient_id: patientId,
      resource_type: 'document',
      ip_address: '127.0.0.1', 
    });

    // Fire-and-forget text extraction (don't block the upload response)
    this.extractionService.extractAndSave(savedDocument.id).catch(err =>
      this.logger.warn(`Text extraction failed for doc ${savedDocument.id}: ${err.message}`),
    );

    // Return metadata only (exclude file_data and extracted_text from response)
    const { file_data, extracted_text, ...metadata } = savedDocument;
    return metadata;
  }

  async listDocuments(patientId: string, user: any) {
    await this.authorizeAccess(patientId, user);

    // Exclude file_data from list queries (it's large binary data)
    return this.documentRepo.find({
      where: { patient_id: patientId },
      order: { upload_date: 'DESC' },
      select: ['id', 'patient_id', 'filename', 'original_name', 'mimetype', 'size_bytes', 'uploaded_by', 'upload_date', 'document_type', 'created_at'],
    });
  }

  async getDocument(docId: string, patientId: string, user: any) {
    await this.authorizeAccess(patientId, user);

    const document = await this.documentRepo.findOne({
      where: { id: docId, patient_id: patientId }
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.auditLogRepo.insert({
      event_type: 'document_accessed',
      actor_user_id: user.userId,
      patient_id: patientId,
      resource_type: 'document',
      ip_address: '127.0.0.1',
    });

    return document;
  }

  async deleteDocument(docId: string, patientId: string, user: any) {
    await this.authorizeAccess(patientId, user);

    const document = await this.documentRepo.findOne({
      where: { id: docId, patient_id: patientId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.documentRepo.remove(document);

    await this.auditLogRepo.insert({
      event_type: 'document_deleted',
      actor_user_id: user.userId,
      patient_id: patientId,
      resource_type: 'document',
      ip_address: '127.0.0.1',
    });

    return { message: 'Document deleted successfully' };
  }
}
