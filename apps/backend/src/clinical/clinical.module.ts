import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalNote } from '../entities/clinical-note.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { AuditLog, Medication, Allergy, Vital } from '../entities';
import { Document as MedicoreDocument } from '../entities';
import { PatientProfile } from '../entities/patient-profile.entity';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { User } from '../entities/user.entity';
import { ClinicalController } from './clinical.controller';
import { ClinicalService } from './clinical.service';
import { PrescriptionService } from './prescription.service';
import { ConsentModule } from '../consent/consent.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClinicalNote,
      Diagnosis,
      AuditLog,
      Medication,
      Allergy,
      Vital,
      MedicoreDocument,
      PatientProfile,
      DoctorProfile,
      User,
    ]),
    ConsentModule,
    AuthModule,
  ],
  controllers: [ClinicalController],
  providers: [ClinicalService, PrescriptionService],
  exports: [ClinicalService, PrescriptionService],
})
export class ClinicalModule {}
