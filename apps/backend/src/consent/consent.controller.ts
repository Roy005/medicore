import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConsentService } from './consent.service';
import { GenerateConsentDto, RedeemConsentDto } from './consent.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessType } from '../entities';

@Controller()
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  /** POST /api/v1/patients/:id/consent/generate — patient generates OTP */
  @UseGuards(JwtAuthGuard)
  @Post('patients/:id/consent/generate')
  async generate(
    @Param('id') patientId: string,
    @Body() dto: GenerateConsentDto,
    @Req() req: any,
  ) {
    return this.consentService.generateConsent(
      patientId,
      dto.accessType || AccessType.CLINICAL_READ,
      req.user,
    );
  }

  /** POST /api/v1/consent/redeem — doctor redeems OTP */
  @UseGuards(JwtAuthGuard)
  @Post('consent/redeem')
  @HttpCode(HttpStatus.OK)
  async redeem(@Body() dto: RedeemConsentDto, @Req() req: any) {
    return this.consentService.redeemConsent(dto.otp, req.user);
  }

  /** DELETE /api/v1/consent/:tokenId — patient revokes token */
  @UseGuards(JwtAuthGuard)
  @Delete('consent/:tokenId')
  async revoke(@Param('tokenId') tokenId: string, @Req() req: any) {
    return this.consentService.revokeConsent(tokenId, req.user);
  }

  /** GET /api/v1/patients/:id/consent/list — list active consents */
  @UseGuards(JwtAuthGuard)
  @Get('patients/:id/consent/list')
  async list(@Param('id') patientId: string, @Req() req: any) {
    return this.consentService.listConsents(patientId, req.user);
  }
}
