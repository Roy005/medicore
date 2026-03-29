import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AccessType } from '../entities';

/** POST /patients/:id/consent/generate */
export class GenerateConsentDto {
  @IsEnum(AccessType)
  @IsOptional()
  accessType?: AccessType = AccessType.CLINICAL_READ;
}

/** POST /consent/redeem */
export class RedeemConsentDto {
  @IsString()
  otp!: string;
}
