import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { AccessToken, AccessType, AuditLog, PatientProfile } from '../entities';

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);
  private readonly consentExpiryDays: number;

  constructor(
    @InjectRepository(AccessToken)
    private readonly tokenRepo: Repository<AccessToken>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.consentExpiryDays = parseInt(
      this.configService.get<string>('CONSENT_EXPIRY_DAYS', '30'),
      10,
    );
  }

  /** Generate a 6-digit OTP consent code */
  async generateConsent(
    patientId: string,
    accessType: AccessType,
    user: { userId: string; role: string },
  ) {
    // Only patients can generate consent for their own profile
    if (user.role !== 'patient') {
      throw new ForbiddenException('Only patients can generate consent tokens');
    }

    const profile = await this.profileRepo.findOne({ where: { user_id: user.userId } });
    if (!profile || profile.id !== patientId) {
      throw new ForbiddenException('You can only generate consent for your own profile');
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.consentExpiryDays);

    try {
      const token = this.tokenRepo.create({
        patient_id: patientId,
        granted_to_user_id: null, // Any doctor can redeem
        token_hash: otpHash,
        access_type: accessType,
        expires_at: expiresAt,
      });
      await this.tokenRepo.save(token);

      // Audit log
      await this.auditRepo.save(
        this.auditRepo.create({
          event_type: 'consent_grant',
          actor_user_id: user.userId,
          patient_id: patientId,
          resource_type: 'consent',
        }),
      );

      this.logger.log(`Consent token generated for patient ${patientId}`);

      return {
        otp,
        tokenId: token.id,
        accessType: token.access_type,
        expiresAt: token.expires_at,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to generate consent token for patient ${patientId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /** Doctor redeems a 6-digit OTP → receives a clinical-access JWT */
  async redeemConsent(otp: string, user: { userId: string; role: string }) {
    if (user.role !== 'doctor') {
      throw new ForbiddenException('Only doctors can redeem consent tokens');
    }

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    const token = await this.tokenRepo.findOne({
      where: {
        token_hash: otpHash,
        revoked_at: IsNull(),
      },
    });

    if (!token) {
      throw new NotFoundException('Invalid or expired consent code');
    }

    // Check expiry
    if (token.expires_at && token.expires_at < new Date()) {
      throw new UnauthorizedException('Consent code has expired');
    }

    // Update token: assign granted_to_user_id to this doctor
    token.granted_to_user_id = user.userId;
    await this.tokenRepo.save(token);

    // Generate a clinical-access JWT scoped to the patient
    const clinicalPayload = {
      sub: user.userId,
      doctorId: user.userId,
      patientId: token.patient_id,
      accessType: token.access_type,
      scope: 'clinical',
      tokenId: token.id,
    };

    const clinicalToken = this.jwtService.sign(clinicalPayload, {
      expiresIn: `${this.consentExpiryDays}d`,
    });

    // Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'consent_redeem',
        actor_user_id: user.userId,
        patient_id: token.patient_id,
        resource_type: 'consent',
      }),
    );

    this.logger.log(`Consent redeemed by doctor ${user.userId} for patient ${token.patient_id}`);

    return {
      clinicalToken,
      patientId: token.patient_id,
      accessType: token.access_type,
      expiresAt: token.expires_at,
    };
  }

  /** Patient revokes a consent token */
  async revokeConsent(tokenId: string, user: { userId: string; role: string }) {
    const token = await this.tokenRepo.findOne({ where: { id: tokenId } });
    if (!token) {
      throw new NotFoundException('Consent token not found');
    }

    // Verify ownership: patient can only revoke their own tokens
    const profile = await this.profileRepo.findOne({ where: { user_id: user.userId } });
    if (!profile || profile.id !== token.patient_id) {
      throw new ForbiddenException('You can only revoke your own consent tokens');
    }

    token.revoked_at = new Date();
    await this.tokenRepo.save(token);

    // Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'consent_revoke',
        actor_user_id: user.userId,
        patient_id: token.patient_id,
        resource_type: 'consent',
      }),
    );

    this.logger.log(`Consent token ${tokenId} revoked by patient ${user.userId}`);

    return { message: 'Consent token revoked successfully' };
  }

  /** List active (non-expired, non-revoked) consent tokens for a patient */
  async listConsents(patientId: string, user: { userId: string; role: string }) {
    if (user.role === 'patient') {
      const profile = await this.profileRepo.findOne({ where: { user_id: user.userId } });
      if (!profile || profile.id !== patientId) {
        throw new ForbiddenException('You can only view your own consent tokens');
      }
    }

    const tokens = await this.tokenRepo.find({
      where: {
        patient_id: patientId,
        revoked_at: IsNull(),
        expires_at: MoreThan(new Date()),
      },
      relations: ['granted_to_user'],
      order: { granted_at: 'DESC' },
    });

    return tokens.map((t) => ({
      id: t.id,
      accessType: t.access_type,
      grantedAt: t.granted_at,
      expiresAt: t.expires_at,
      grantedTo: t.granted_to_user
        ? { id: t.granted_to_user.id, email: t.granted_to_user.email }
        : null,
    }));
  }

  /** Validate a clinical-access JWT (used by ClinicalAccessGuard) */
  async validateClinicalToken(clinicalTokenStr: string): Promise<{
    doctorId: string;
    patientId: string;
    accessType: string;
    tokenId: string;
  }> {
    let payload: any;
    try {
      payload = this.jwtService.verify(clinicalTokenStr);
    } catch {
      throw new UnauthorizedException('Invalid or expired clinical access token');
    }

    if (payload.scope !== 'clinical') {
      throw new UnauthorizedException('Token is not a clinical access token');
    }

    // Check if the underlying consent token has been revoked
    const token = await this.tokenRepo.findOne({ where: { id: payload.tokenId } });
    if (!token) {
      throw new UnauthorizedException('Consent token not found');
    }
    if (token.revoked_at) {
      throw new UnauthorizedException('Consent token has been revoked');
    }
    if (token.expires_at && token.expires_at < new Date()) {
      throw new UnauthorizedException('Consent token has expired');
    }

    return {
      doctorId: payload.doctorId,
      patientId: payload.patientId,
      accessType: payload.accessType,
      tokenId: payload.tokenId,
    };
  }
}
