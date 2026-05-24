import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';

import { Document as MedicoreDocument, DocumentType } from '../entities/document.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { User } from '../entities/user.entity';
import { Medication } from '../entities/medication.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { AuditLog } from '../entities/audit-log.entity';

export interface PrescriptionMedication {
  drug_name: string;
  rxnorm_code?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface PrescriptionTest {
  test_name: string;
  code?: string;
  urgency?: string;
  patient_instructions?: string;
}

export interface GeneratePrescriptionDto {
  visitType?: string;
  chiefComplaint?: string;
  diagnosisText?: string;
  diagnosisCode?: string;
  medications?: PrescriptionMedication[];
  tests?: PrescriptionTest[];
  clinicalNotes?: string;
  followUpDate?: string;
  followUpInstructions?: string;
  validityDays?: number;
}

@Injectable()
export class PrescriptionService {
  private readonly logger = new Logger(PrescriptionService.name);

  constructor(
    @InjectRepository(MedicoreDocument)
    private readonly documentRepo: Repository<MedicoreDocument>,
    @InjectRepository(PatientProfile)
    private readonly patientProfileRepo: Repository<PatientProfile>,
    @InjectRepository(DoctorProfile)
    private readonly doctorProfileRepo: Repository<DoctorProfile>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Medication)
    private readonly medicationRepo: Repository<Medication>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async generatePrescription(
    patientId: string,
    doctorUserId: string,
    dto: GeneratePrescriptionDto,
    ip?: string,
  ) {
    // 1. Fetch doctor profile + user
    const doctorProfile = await this.doctorProfileRepo.findOne({ where: { user_id: doctorUserId } });
    if (!doctorProfile) throw new NotFoundException('Doctor profile not found');
    const doctorUser = await this.userRepo.findOne({ where: { id: doctorUserId } });

    // 2. Fetch patient profile + user
    const patientProfile = await this.patientProfileRepo.findOne({ where: { id: patientId } });
    if (!patientProfile) throw new NotFoundException('Patient profile not found');
    const patientUser = await this.userRepo.findOne({ where: { id: patientProfile.user_id } });

    // 3. Gather medications — use provided list or fallback to existing active medications
    let medications: PrescriptionMedication[] = dto.medications || [];
    if (medications.length === 0) {
      const existingMeds = await this.medicationRepo.find({
        where: { patient_id: patientId, is_active: true },
      });
      medications = existingMeds.map(m => ({
        drug_name: m.drug_name,
        rxnorm_code: m.rxnorm_code,
        dosage: m.dosage,
        frequency: m.frequency,
      }));
    }

    // 3.5. Persist medications to the medications table
    for (const med of medications) {
      if (!med.drug_name?.trim()) continue;
      // Check if this exact med already exists (active) for the patient
      const existing = await this.medicationRepo.findOne({
        where: { patient_id: patientId, drug_name: med.drug_name, is_active: true },
      });
      if (!existing) {
        const newMed = new Medication();
        newMed.patient_id = patientId;
        newMed.drug_name = med.drug_name;
        newMed.rxnorm_code = med.rxnorm_code || '';
        newMed.dosage = med.dosage || '';
        newMed.frequency = med.frequency || '';
        newMed.source = 'Provider Prescription';
        newMed.is_active = true;
        await this.medicationRepo.save(newMed);
      }
    }

    // 4. Gather diagnosis info
    let diagnosisText = dto.diagnosisText || '';
    let diagnosisCode = dto.diagnosisCode || '';
    if (!diagnosisText) {
      const latestDiag = await this.diagnosisRepo.findOne({
        where: { patient_id: patientId },
        order: { created_at: 'DESC' },
      });
      if (latestDiag) {
        diagnosisText = latestDiag.icd10_description;
        diagnosisCode = latestDiag.icd10_code;
      }
    }

    // 5. Build prescription data
    const rxId = `RX-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const prescriptionDate = new Date();
    const demographics = patientProfile.demographics as any || {};
    const patientName = [demographics.firstName, demographics.lastName].filter(Boolean).join(' ') || 'N/A';
    const patientGender = demographics.gender || 'N/A';
    const patientPhone = demographics.phone || 'N/A';
    const patientDOB = patientProfile.date_of_birth
      ? new Date(patientProfile.date_of_birth).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'N/A';
    const patientAge = patientProfile.date_of_birth
      ? `${Math.floor((Date.now() - new Date(patientProfile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} yrs`
      : 'N/A';
    const bloodGroup = patientProfile.blood_group || 'N/A';

    const doctorName = doctorProfile.full_name || doctorUser?.email || 'Doctor';
    const doctorQualifications = doctorProfile.qualifications || doctorProfile.specialty || '';
    const doctorRegNo = doctorProfile.registration_number;
    const doctorPhone = doctorProfile.phone || '';
    const doctorEmail = doctorUser?.email || '';
    const hospitalName = doctorProfile.hospital_affiliation || 'MediCore Healthcare';
    const hospitalAddress = doctorProfile.hospital_address || '';
    const hospitalPhone = doctorProfile.hospital_phone || '';
    const hospitalEmail = doctorProfile.hospital_email || '';

    const validityDays = dto.validityDays || 30;

    // 6. Generate PDF
    const pdfBuffer = await this.buildPrescriptionPDF({
      rxId,
      prescriptionDate,
      visitType: dto.visitType || 'Consultation',
      hospitalName,
      hospitalAddress,
      hospitalPhone,
      hospitalEmail,
      doctorName,
      doctorQualifications,
      doctorRegNo,
      doctorPhone,
      doctorEmail,
      patientName,
      patientId: patientId.slice(0, 12),
      patientGender,
      patientAge,
      patientDOB,
      bloodGroup,
      patientPhone,
      chiefComplaint: dto.chiefComplaint || '',
      diagnosisText,
      diagnosisCode,
      medications,
      tests: dto.tests || [],
      clinicalNotes: dto.clinicalNotes || '',
      followUpDate: dto.followUpDate || '',
      followUpInstructions: dto.followUpInstructions || '',
      validityDays,
    });

    // 7. Save as document
    const fileName = `Prescription_${rxId}.pdf`;
    const doc = this.documentRepo.create({
      patient_id: patientId,
      filename: `${rxId}.pdf`,
      original_name: fileName,
      mimetype: 'application/pdf',
      size_bytes: pdfBuffer.length,
      uploaded_by: doctorUserId,
      document_type: DocumentType.PRESCRIPTION,
      file_data: pdfBuffer,
      extraction_status: 'completed',
      extracted_text: `Prescription ${rxId} for ${patientName}. Medications: ${medications.map(m => m.drug_name).join(', ')}`,
    });
    const savedDoc = await this.documentRepo.save(doc);

    // 8. Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'prescription_generated',
        actor_user_id: doctorUserId,
        patient_id: patientId,
        ip_address: ip || null,
        resource_type: 'prescription',
      }),
    );

    this.logger.log(`Prescription ${rxId} generated for patient ${patientId} by doctor ${doctorUserId}`);

    const { file_data, ...metadata } = savedDoc;
    return { ...metadata, rxId };
  }

  private async buildPrescriptionPDF(data: {
    rxId: string;
    prescriptionDate: Date;
    visitType: string;
    hospitalName: string;
    hospitalAddress: string;
    hospitalPhone: string;
    hospitalEmail: string;
    doctorName: string;
    doctorQualifications: string;
    doctorRegNo: string;
    doctorPhone: string;
    doctorEmail: string;
    patientName: string;
    patientId: string;
    patientGender: string;
    patientAge: string;
    patientDOB: string;
    bloodGroup: string;
    patientPhone: string;
    chiefComplaint: string;
    diagnosisText: string;
    diagnosisCode: string;
    medications: PrescriptionMedication[];
    tests: PrescriptionTest[];
    clinicalNotes: string;
    followUpDate: string;
    followUpInstructions: string;
    validityDays: number;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // bottom: 0 prevents PDFKit from auto-adding pages when drawing footer text near page bottom
      const doc = new PDFDocument({ size: 'A4', margins: { top: 40, left: 40, right: 40, bottom: 0 }, bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 80; // 40px margin each side
      const leftMargin = 40;
      const teal = '#005454';
      const darkText = '#191c1d';
      const grayText = '#6e7979';
      const accentRed = '#E8533A';
      const lightBg = '#f2f4f5';
      const footerH = 25;
      const maxY = doc.page.height - footerH - 10; // usable area above footer

      const ensureSpace = (needed: number) => {
        if (y + needed > maxY) {
          doc.addPage();
          y = 40;
        }
      };

      let y = 0;

      // ─── HEADER BACKGROUND ──────────────────────────────────
      doc.rect(0, 0, doc.page.width, 90).fill(teal);

      // Hospital info (left)
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#ffffff');
      doc.text(data.hospitalName, leftMargin, 20, { width: pageWidth / 2 });
      doc.font('Helvetica').fontSize(8).fillColor('#cce0e0');
      if (data.hospitalAddress) {
        doc.text(data.hospitalAddress, leftMargin, 38, { width: pageWidth / 2 });
      }
      const hospitalContactParts = [data.hospitalPhone, data.hospitalEmail].filter(Boolean);
      if (hospitalContactParts.length > 0) {
        doc.text(hospitalContactParts.join('  |  '), leftMargin, data.hospitalAddress ? 50 : 38, { width: pageWidth / 2 });
      }

      // Doctor info (right)
      const rightCol = leftMargin + pageWidth / 2 + 20;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff');
      doc.text(data.doctorName, rightCol, 20, { width: pageWidth / 2 - 20, align: 'right' });
      doc.font('Helvetica').fontSize(8).fillColor('#cce0e0');
      if (data.doctorQualifications) {
        doc.text(data.doctorQualifications, rightCol, 35, { width: pageWidth / 2 - 20, align: 'right' });
      }
      doc.text(`Reg. No: ${data.doctorRegNo}`, rightCol, 47, { width: pageWidth / 2 - 20, align: 'right' });
      const doctorContactParts = [data.doctorPhone, data.doctorEmail].filter(Boolean);
      if (doctorContactParts.length > 0) {
        doc.text(doctorContactParts.join('  |  '), rightCol, 59, { width: pageWidth / 2 - 20, align: 'right' });
      }

      // ─── PRESCRIPTION TITLE BAR ─────────────────────────────
      y = 100;
      doc.rect(leftMargin, y, pageWidth, 28).fill(lightBg);
      doc.font('Helvetica-Bold').fontSize(13).fillColor(teal);
      doc.text('Prescription', leftMargin + 10, y + 7, { width: pageWidth / 2 });
      doc.font('Helvetica').fontSize(9).fillColor(grayText);
      doc.text(`Rx ID: ${data.rxId}`, leftMargin + 10, y + 9, { width: pageWidth - 20, align: 'right' });

      // Date line
      y += 34;
      doc.font('Helvetica').fontSize(9).fillColor(grayText);
      const dateStr = data.prescriptionDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.text(`Date: ${dateStr}  ·  ${data.visitType}`, leftMargin, y);

      // ─── PATIENT INFORMATION ────────────────────────────────
      y += 22;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(teal);
      doc.text('PATIENT INFORMATION', leftMargin, y);
      y += 16;

      // Patient info grid
      const colW = pageWidth / 3;
      const drawInfoCell = (label: string, value: string, x: number, cy: number) => {
        doc.font('Helvetica').fontSize(7).fillColor(grayText);
        doc.text(label, x, cy);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(darkText);
        doc.text(value, x, cy + 10);
      };

      drawInfoCell('Full Name', data.patientName, leftMargin, y);
      drawInfoCell('Patient ID', data.patientId, leftMargin + colW, y);
      drawInfoCell('Gender', data.patientGender, leftMargin + colW * 2, y);

      y += 30;
      drawInfoCell('Age / DOB', `${data.patientAge} / ${data.patientDOB}`, leftMargin, y);
      drawInfoCell('Blood Group', data.bloodGroup, leftMargin + colW, y);
      drawInfoCell('Contact', data.patientPhone, leftMargin + colW * 2, y);

      // Divider
      y += 30;
      doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).lineWidth(0.5).strokeColor('#e6e8e9').stroke();

      // ─── CHIEF COMPLAINT & DIAGNOSIS ────────────────────────
      if (data.chiefComplaint || data.diagnosisText) {
        y += 10;
        const halfW = pageWidth / 2 - 5;
        if (data.chiefComplaint) {
          doc.font('Helvetica').fontSize(7).fillColor(grayText);
          doc.text('Chief Complaint', leftMargin, y);
          doc.font('Helvetica-Bold').fontSize(9).fillColor(darkText);
          doc.text(data.chiefComplaint, leftMargin, y + 10, { width: halfW });
        }
        if (data.diagnosisText) {
          doc.font('Helvetica').fontSize(7).fillColor(grayText);
          doc.text('Diagnosis', leftMargin + halfW + 10, y);
          doc.font('Helvetica-Bold').fontSize(9).fillColor(darkText);
          const diagLabel = data.diagnosisCode ? `${data.diagnosisText} (ICD-10: ${data.diagnosisCode})` : data.diagnosisText;
          doc.text(diagLabel, leftMargin + halfW + 10, y + 10, { width: halfW });
        }
        y += 35;
        doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).lineWidth(0.5).strokeColor('#e6e8e9').stroke();
      }

      // ─── MEDICATIONS TABLE ──────────────────────────────────
      if (data.medications.length > 0) {
        y += 12;
        doc.font('Helvetica-Bold').fontSize(10).fillColor(accentRed);
        doc.text('Medications', leftMargin, y);
        y += 16;

        // Table header
        const medCols = [30, 140, 60, 80, 55, pageWidth - 365];
        const medHeaders = ['#', 'Drug Name', 'Dosage', 'Frequency', 'Duration', 'Instructions'];
        doc.rect(leftMargin, y, pageWidth, 18).fill(lightBg);
        doc.font('Helvetica-Bold').fontSize(7).fillColor(grayText);
        let xPos = leftMargin + 5;
        medHeaders.forEach((h, i) => {
          doc.text(h, xPos, y + 5, { width: medCols[i] - 5 });
          xPos += medCols[i];
        });
        y += 20;

        // Table rows
        data.medications.forEach((med, idx) => {
          ensureSpace(18);
          doc.font('Helvetica').fontSize(8).fillColor(darkText);
          xPos = leftMargin + 5;
          const row = [
            String(idx + 1),
            med.rxnorm_code ? `${med.drug_name} (${med.rxnorm_code})` : med.drug_name,
            med.dosage || '—',
            med.frequency || '—',
            med.duration || '—',
            med.instructions || '—',
          ];
          let maxH = 0;
          row.forEach((cell, i) => {
            const h = doc.heightOfString(cell, { width: medCols[i] - 8 });
            if (h > maxH) maxH = h;
          });
          row.forEach((cell, i) => {
            doc.text(cell, xPos, y, { width: medCols[i] - 8 });
            xPos += medCols[i];
          });
          y += Math.max(maxH + 8, 18);
          doc.moveTo(leftMargin, y - 2).lineTo(leftMargin + pageWidth, y - 2).lineWidth(0.3).strokeColor('#e6e8e9').stroke();
        });
        y += 5;
      }

      // ─── LAB TESTS TABLE ────────────────────────────────────
      if (data.tests.length > 0) {
        ensureSpace(40);
        y += 5;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#4c5f7e');
        doc.text('Investigations / Lab Tests', leftMargin, y);
        y += 16;

        const testCols = [30, 170, 100, 60, pageWidth - 360];
        const testHeaders = ['#', 'Test Name', 'Code', 'Urgency', 'Patient Instructions'];
        doc.rect(leftMargin, y, pageWidth, 18).fill(lightBg);
        doc.font('Helvetica-Bold').fontSize(7).fillColor(grayText);
        let xPos = leftMargin + 5;
        testHeaders.forEach((h, i) => {
          doc.text(h, xPos, y + 5, { width: testCols[i] - 5 });
          xPos += testCols[i];
        });
        y += 20;

        data.tests.forEach((test, idx) => {
          ensureSpace(18);
          doc.font('Helvetica').fontSize(8).fillColor(darkText);
          xPos = leftMargin + 5;
          const row = [
            String(idx + 1),
            test.test_name,
            test.code || '—',
            test.urgency || '—',
            test.patient_instructions || '—',
          ];
          row.forEach((cell, i) => {
            doc.text(cell, xPos, y, { width: testCols[i] - 8 });
            xPos += testCols[i];
          });
          y += 18;
          doc.moveTo(leftMargin, y - 2).lineTo(leftMargin + pageWidth, y - 2).lineWidth(0.3).strokeColor('#e6e8e9').stroke();
        });
        y += 5;
      }

      // ─── CLINICAL NOTES ─────────────────────────────────────
      if (data.clinicalNotes) {
        ensureSpace(30);
        y += 8;
        doc.font('Helvetica-Bold').fontSize(8).fillColor(teal);
        doc.text('CLINICAL NOTES', leftMargin, y);
        y += 14;
        doc.font('Helvetica').fontSize(8.5).fillColor(darkText);
        doc.text(data.clinicalNotes, leftMargin, y, { width: pageWidth });
        y += doc.heightOfString(data.clinicalNotes, { width: pageWidth }) + 10;
      }

      // ─── FOLLOW-UP ─────────────────────────────────────────
      if (data.followUpDate || data.followUpInstructions) {
        ensureSpace(25);
        y += 5;
        doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).lineWidth(0.5).strokeColor('#e6e8e9').stroke();
        y += 8;
        doc.font('Helvetica-Bold').fontSize(8).fillColor(teal);
        doc.text('FOLLOW-UP', leftMargin, y);
        doc.font('Helvetica').fontSize(8.5).fillColor(darkText);
        const followUpText = [data.followUpDate, data.followUpInstructions].filter(Boolean).join('  |  ');
        doc.text(followUpText, leftMargin + 80, y, { width: pageWidth - 80 });
        y += 20;
      }

      // ─── SIGNATURE & VALIDITY ──────────────────────────────
      ensureSpace(55);
      y += 15;
      doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).lineWidth(0.5).strokeColor('#e6e8e9').stroke();
      y += 15;

      // Validity (left)
      doc.font('Helvetica').fontSize(7).fillColor(grayText);
      doc.text(`Valid for ${data.validityDays} days from date of issue.`, leftMargin, y, { width: pageWidth / 2 });
      doc.text('This prescription is computer-generated and valid without a physical stamp.', leftMargin, y + 10, { width: pageWidth / 2 });

      // Signature (right)
      doc.font('Helvetica-Bold').fontSize(9).fillColor(darkText);
      doc.text('____________________________________', leftMargin + pageWidth / 2 + 20, y, { width: pageWidth / 2 - 20, align: 'right' });
      doc.text(data.doctorName, leftMargin + pageWidth / 2 + 20, y + 14, { width: pageWidth / 2 - 20, align: 'right' });
      doc.font('Helvetica').fontSize(7).fillColor(grayText);
      doc.text(`${data.doctorQualifications}`, leftMargin + pageWidth / 2 + 20, y + 26, { width: pageWidth / 2 - 20, align: 'right' });
      doc.text(`Reg. No: ${data.doctorRegNo}`, leftMargin + pageWidth / 2 + 20, y + 36, { width: pageWidth / 2 - 20, align: 'right' });

      // ─── FOOTER (drawn on all pages at fixed bottom position) ─
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        const fY = doc.page.height - footerH;
        doc.rect(0, fY, doc.page.width, footerH).fill(lightBg);
        doc.font('Helvetica').fontSize(7).fillColor(grayText);
        const footerDate = data.prescriptionDate.toLocaleString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        doc.text(`Generated by MediCore  ·  ${footerDate}`, leftMargin, fY + 8, { width: pageWidth / 2, lineBreak: false });
        const pageLabel = range.count > 1 ? `Page ${i + 1} of ${range.count}` : data.rxId;
        doc.text(pageLabel, leftMargin + pageWidth / 2, fY + 8, { width: pageWidth / 2, align: 'right', lineBreak: false });
      }

      doc.end();
    });
  }
}

