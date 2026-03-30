import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { ClinicalNote } from '../entities/clinical-note.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { AuditLog, Medication, Allergy, Vital } from '../entities';
import { Document as MedicoreDocument } from '../entities';
import { CreateNoteDto, CreateDiagnosisDto } from './clinical.dto';

export interface Icd10Entry {
  code: string;
  description: string;
}

@Injectable()
export class ClinicalService {
  private readonly logger = new Logger(ClinicalService.name);
  private icd10Data: Icd10Entry[] = [];

  constructor(
    @InjectRepository(ClinicalNote)
    private readonly noteRepo: Repository<ClinicalNote>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Medication)
    private readonly medicationRepo: Repository<Medication>,
    @InjectRepository(Allergy)
    private readonly allergyRepo: Repository<Allergy>,
    @InjectRepository(Vital)
    private readonly vitalRepo: Repository<Vital>,
    @InjectRepository(MedicoreDocument)
    private readonly documentRepo: Repository<MedicoreDocument>,
  ) {
    // Load ICD-10 data at startup
    try {
      const filePath = path.join(__dirname, 'icd10-codes.json');
      const raw = fs.readFileSync(filePath, 'utf-8');
      this.icd10Data = JSON.parse(raw);
      this.logger.log(`Loaded ${this.icd10Data.length} ICD-10 codes`);
    } catch (err) {
      this.logger.warn('Failed to load ICD-10 codes, search will return empty results');
    }
  }

  // ─── CLINICAL NOTES ───────────────────────────────────────

  async createNote(
    patientId: string,
    dto: CreateNoteDto,
    doctorId: string,
    ip?: string,
  ) {
    const note = this.noteRepo.create({
      patient_id: patientId,
      doctor_id: doctorId,
      subjective: dto.subjective || null,
      objective: dto.objective || null,
      assessment: dto.assessment || null,
      plan: dto.additionalNotes 
        ? `${dto.plan || ''}\n\nAdditional Notes: ${dto.additionalNotes}`.trim()
        : (dto.plan || null),
      visit_date: dto.visitDate,
      amended_note_id: dto.amendedNoteId || null,
    });
    const saved = await this.noteRepo.save(note);

    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'record_edit',
        actor_user_id: doctorId,
        patient_id: patientId,
        ip_address: ip || null,
        resource_type: 'note',
      }),
    );

    this.logger.log(`Clinical note created: ${saved.id} for patient ${patientId}`);
    return saved;
  }

  async getNotes(patientId: string, page = 1, limit = 20) {
    const [notes, total] = await this.noteRepo.findAndCount({
      where: { patient_id: patientId },
      relations: ['doctor'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      notes: notes.map((n) => ({
        id: n.id,
        subjective: n.subjective,
        objective: n.objective,
        assessment: n.assessment,
        plan: n.plan,
        visitDate: n.visit_date,
        amendedNoteId: n.amended_note_id,
        doctorName: n.doctor?.email || 'Unknown',
        createdAt: n.created_at,
      })),
      total,
      page,
      limit,
    };
  }

  // ─── DIAGNOSES ────────────────────────────────────────────

  async createDiagnosis(
    patientId: string,
    dto: CreateDiagnosisDto,
    doctorId: string,
    ip?: string,
  ) {
    const diagnosis = this.diagnosisRepo.create({
      patient_id: patientId,
      doctor_id: doctorId,
      icd10_code: dto.icd10Code,
      icd10_description: dto.icd10Description,
      diagnosis_date: dto.diagnosisDate,
      status: dto.status || 'active' as any,
      notes: dto.notes || null,
    });
    const saved = await this.diagnosisRepo.save(diagnosis);

    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'record_edit',
        actor_user_id: doctorId,
        patient_id: patientId,
        ip_address: ip || null,
        resource_type: 'diagnosis',
      }),
    );

    this.logger.log(`Diagnosis created: ${saved.id} for patient ${patientId}`);
    return saved;
  }

  async getDiagnoses(patientId: string) {
    return this.diagnosisRepo.find({
      where: { patient_id: patientId },
      relations: ['doctor'],
      order: { created_at: 'DESC' },
    });
  }

  // ─── ICD-10 SEARCH ────────────────────────────────────────

  searchIcd10(query: string): Icd10Entry[] {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return this.icd10Data
      .filter(
        (entry) =>
          entry.code.toLowerCase().includes(q) ||
          entry.description.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }

  // ─── TIMELINE ─────────────────────────────────────────────

  async getTimeline(
    patientId: string,
    page = 1,
    limit = 50,
    doctorId?: string,
    ip?: string,
  ) {
    // Fetch all event types in parallel
    const [notes, diagnoses, medications, vitals, allergies, documents] =
      await Promise.all([
        this.noteRepo.find({
          where: { patient_id: patientId },
          relations: ['doctor'],
          order: { created_at: 'DESC' },
        }),
        this.diagnosisRepo.find({
          where: { patient_id: patientId },
          order: { created_at: 'DESC' },
        }),
        this.medicationRepo.find({
          where: { patient_id: patientId },
          order: { created_at: 'DESC' },
        }),
        this.vitalRepo.find({
          where: { patient_id: patientId },
          order: { recorded_at: 'DESC' },
          take: 200, // limit vitals to avoid huge lists
        }),
        this.allergyRepo.find({
          where: { patient_id: patientId },
          order: { created_at: 'DESC' },
        }),
        this.documentRepo.find({
          where: { patient_id: patientId },
          order: { created_at: 'DESC' },
        }),
      ]);

    // Combine into unified timeline
    const events: Array<{
      type: string;
      date: Date;
      summary: string;
      data: any;
    }> = [];

    for (const n of notes) {
      events.push({
        type: 'note',
        date: n.created_at,
        summary: `SOAP note — ${n.assessment?.substring(0, 80) || 'Clinical note'}`,
        data: {
          id: n.id,
          subjective: n.subjective,
          objective: n.objective,
          assessment: n.assessment,
          plan: n.plan,
          visitDate: n.visit_date,
          doctor: n.doctor?.email,
        },
      });
    }

    for (const d of diagnoses) {
      events.push({
        type: 'diagnosis',
        date: d.created_at,
        summary: `${d.icd10_code} — ${d.icd10_description}`,
        data: {
          id: d.id,
          icd10Code: d.icd10_code,
          description: d.icd10_description,
          status: d.status,
          diagnosisDate: d.diagnosis_date,
        },
      });
    }

    for (const m of medications) {
      events.push({
        type: 'medication',
        date: m.created_at,
        summary: `${m.drug_name} ${m.dosage || ''} ${m.frequency || ''}`.trim(),
        data: {
          id: m.id,
          drugName: m.drug_name,
          dosage: m.dosage,
          frequency: m.frequency,
          isActive: m.is_active,
        },
      });
    }

    for (const v of vitals) {
      events.push({
        type: 'vital',
        date: v.recorded_at || v.created_at,
        summary: `${v.metric_type}: ${v.value} ${v.unit}`,
        data: {
          id: v.id,
          metricType: v.metric_type,
          value: v.value,
          unit: v.unit,
          sourceDevice: v.source_device,
        },
      });
    }

    for (const a of allergies) {
      events.push({
        type: 'allergy',
        date: a.created_at,
        summary: `Allergy: ${a.allergen} (${a.severity})`,
        data: {
          id: a.id,
          allergen: a.allergen,
          severity: a.severity,
          reaction: a.reaction_description,
        },
      });
    }

    for (const doc of documents) {
      events.push({
        type: 'document',
        date: doc.created_at,
        summary: `Document: ${doc.original_name}`,
        data: {
          id: doc.id,
          filename: doc.original_name,
          mimeType: doc.mimetype,
          fileSize: doc.size_bytes,
        },
      });
    }

    // Sort by date, newest first
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Paginate
    const start = (page - 1) * limit;
    const paginated = events.slice(start, start + limit);

    // Audit log for timeline access
    if (doctorId) {
      await this.auditRepo.save(
        this.auditRepo.create({
          event_type: 'timeline_view',
          actor_user_id: doctorId,
          patient_id: patientId,
          ip_address: ip || null,
          resource_type: 'timeline',
        }),
      );
    }

    return {
      events: paginated,
      total: events.length,
      page,
      limit,
    };
  }
}
