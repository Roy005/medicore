import { IsString, IsOptional, IsObject, IsDateString, IsEnum, IsBoolean } from 'class-validator';
import { AllergySeverity } from '../entities';

export class UpdateProfileDto {
  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @IsOptional()
  @IsString()
  blood_group?: string;

  @IsOptional()
  @IsObject()
  demographics?: Record<string, any>;

  @IsOptional()
  @IsObject()
  insurance?: Record<string, any>;

  @IsOptional()
  emergency_contacts?: any[];
}

export class CreateMedicationDto {
  @IsString()
  drug_name: string;

  @IsOptional()
  @IsString()
  rxnorm_code?: string;

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  source?: string;
}

export class CreateAllergyDto {
  @IsString()
  allergen: string;

  @IsOptional()
  @IsString()
  allergen_type?: string;

  @IsOptional()
  @IsEnum(AllergySeverity)
  severity?: AllergySeverity;

  @IsOptional()
  @IsString()
  reaction_description?: string;
}
