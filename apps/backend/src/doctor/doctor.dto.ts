import { IsEmail, IsNotEmpty, IsString, MinLength, IsUUID, IsOptional } from 'class-validator';

/** DTO for POST /auth/register/doctor */
export class RegisterDoctorDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsNotEmpty()
  specialty!: string;

  @IsString()
  @IsNotEmpty()
  registrationNumber!: string;

  @IsString()
  @IsOptional()
  hospitalAffiliation?: string;
}

/** DTO for PATCH /doctors/:id/profile */
export class UpdateDoctorProfileDto {
  @IsString()
  @IsOptional()
  specialty?: string;

  @IsString()
  @IsOptional()
  hospitalAffiliation?: string;

  @IsString()
  @IsOptional()
  registrationNumber?: string;
}
