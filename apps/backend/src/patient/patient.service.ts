import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  PatientProfile,
  Medication,
  Allergy,
  AccessToken,
} from '../entities';
import {
  UpdateProfileDto,
  CreateMedicationDto,
  CreateAllergyDto,
} from './patient.dto';
import { EmergencyService } from '../emergency/emergency.service';

@Injectable()
export class PatientService {
  private readonly logger = new Logger(PatientService.name);

  constructor(
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
    @InjectRepository(Medication)
    private readonly medicationRepo: Repository<Medication>,
    @InjectRepository(Allergy)
    private readonly allergyRepo: Repository<Allergy>,
    @InjectRepository(AccessToken)
    private readonly accessTokenRepo: Repository<AccessToken>,
    private readonly emergencyService: EmergencyService,
  ) {}

  private async authorizeAccess(patientId: string, user: any) {
    if (user.role === 'patient') {
      const profile = await this.profileRepo.findOne({ where: { user_id: user.userId } });
      if (!profile || profile.id !== patientId) {
        throw new ForbiddenException('You can only access your own profile');
      }
    } else if (user.role === 'doctor') {
      const count = await this.accessTokenRepo
        .createQueryBuilder('token')
        .where('token.patient_id = :patientId', { patientId })
        .andWhere('token.granted_to_user_id = :userId', { userId: user.userId })
        .andWhere('token.revoked_at IS NULL')
        .andWhere('(token.expires_at IS NULL OR token.expires_at > NOW())')
        .getCount();

      if (count === 0) {
        throw new ForbiddenException('You do not have a valid access token for this patient');
      }
    } else {
      throw new ForbiddenException('Role not authorized for this action');
    }
  }

  // ─── PROFILE ───────────────────────────────────────────────
  async getProfile(patientId: string, user: any) {
    await this.authorizeAccess(patientId, user);
    try {
      const profile = await this.profileRepo.findOne({ where: { id: patientId } });
      if (!profile) throw new NotFoundException('Patient profile not found');
      return profile;
    } catch (e) {
      if (e instanceof NotFoundException || e instanceof ForbiddenException) throw e;
      this.logger.error(`getProfile error: ${e.message}`, e.stack);
      throw new InternalServerErrorException('Database error occurred while fetching profile');
    }
  }

  async updateProfile(patientId: string, dto: UpdateProfileDto, user: any) {
    await this.authorizeAccess(patientId, user);
    try {
      const profile = await this.profileRepo.findOne({ where: { id: patientId } });
      if (!profile) throw new NotFoundException('Patient profile not found');

      await this.profileRepo.update({ id: patientId }, dto);
      const updated = await this.profileRepo.findOne({ where: { id: patientId } });

      // Auto-refresh emergency snapshot (fire-and-forget)
      this.emergencyService.refreshSnapshot(patientId).catch((err) =>
        this.logger.warn(`Emergency snapshot refresh failed: ${err.message}`),
      );

      return updated;
    } catch (e) {
      if (e instanceof NotFoundException || e instanceof ForbiddenException) throw e;
      this.logger.error(`updateProfile error: ${e.message}`, e.stack);
      throw new InternalServerErrorException('Database error occurred while updating profile');
    }
  }

  // ─── MEDICATIONS ───────────────────────────────────────────
  async getMedications(patientId: string, user: any) {
    await this.authorizeAccess(patientId, user);
    try {
      return await this.medicationRepo.find({ where: { patient_id: patientId } });
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      this.logger.error(`getMedications error: ${e.message}`, e.stack);
      throw new InternalServerErrorException('Database error occurred while fetching medications');
    }
  }

  async addMedication(patientId: string, dto: CreateMedicationDto, user: any) {
    await this.authorizeAccess(patientId, user);
    try {
      const medication = this.medicationRepo.create({
        ...dto,
        patient_id: patientId,
        prescribed_by: user.role === 'doctor' ? user.userId : null,
      });
      const saved = await this.medicationRepo.save(medication);

      // Auto-refresh emergency snapshot (fire-and-forget)
      this.emergencyService.refreshSnapshot(patientId).catch((err) =>
        this.logger.warn(`Emergency snapshot refresh failed: ${err.message}`),
      );

      return saved;
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      this.logger.error(`addMedication error: ${e.message}`, e.stack);
      throw new InternalServerErrorException('Database error occurred while creating medication');
    }
  }

  // ─── ALLERGIES ─────────────────────────────────────────────
  async getAllergies(patientId: string, user: any) {
    await this.authorizeAccess(patientId, user);
    try {
      return await this.allergyRepo.find({ where: { patient_id: patientId } });
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      this.logger.error(`getAllergies error: ${e.message}`, e.stack);
      throw new InternalServerErrorException('Database error occurred while fetching allergies');
    }
  }

  async addAllergy(patientId: string, dto: CreateAllergyDto, user: any) {
    await this.authorizeAccess(patientId, user);
    try {
      const allergy = this.allergyRepo.create({
        ...dto,
        patient_id: patientId,
      });
      const saved = await this.allergyRepo.save(allergy);

      // Auto-refresh emergency snapshot (fire-and-forget)
      this.emergencyService.refreshSnapshot(patientId).catch((err) =>
        this.logger.warn(`Emergency snapshot refresh failed: ${err.message}`),
      );

      return saved;
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      this.logger.error(`addAllergy error: ${e.message}`, e.stack);
      throw new InternalServerErrorException('Database error occurred while creating allergy');
    }
  }
}
