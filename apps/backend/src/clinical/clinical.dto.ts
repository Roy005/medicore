import { IsString, IsOptional, IsDateString, IsEnum, IsUUID } from 'class-validator';
import { DiagnosisStatus } from '../entities/diagnosis.entity';

/** POST /patients/:id/notes */
export class CreateNoteDto {
  @IsString()
  @IsOptional()
  subjective?: string;

  @IsString()
  @IsOptional()
  objective?: string;

  @IsString()
  @IsOptional()
  assessment?: string;

  @IsString()
  @IsOptional()
  plan?: string;

  @IsDateString()
  visitDate!: string;

  @IsUUID()
  @IsOptional()
  amendedNoteId?: string;
}

/** POST /patients/:id/diagnoses */
export class CreateDiagnosisDto {
  @IsString()
  icd10Code!: string;

  @IsString()
  icd10Description!: string;

  @IsDateString()
  diagnosisDate!: string;

  @IsEnum(DiagnosisStatus)
  @IsOptional()
  status?: DiagnosisStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
