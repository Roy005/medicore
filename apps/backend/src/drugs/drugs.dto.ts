import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';

export enum InteractionSeverity {
  HIGH = 'high',
  MODERATE = 'moderate',
  LOW = 'low',
}

/** POST /drugs/interaction-check */
export class InteractionCheckDto {
  @IsArray()
  @IsString({ each: true })
  rxcuis!: string[];
}

/** POST /patients/:id/prescriptions */
export class CreatePrescriptionDto {
  @IsString()
  drugName!: string;

  @IsString()
  @IsOptional()
  rxcui?: string;

  @IsString()
  @IsOptional()
  dosage?: string;

  @IsString()
  @IsOptional()
  frequency?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  /** If true, save even with HIGH severity interactions */
  @IsOptional()
  acknowledgeInteractions?: boolean;
}
