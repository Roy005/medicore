import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { AuditLog } from '../entities';
import { UpdateDoctorProfileDto } from './doctor.dto';

@Injectable()
export class DoctorService {
  private readonly logger = new Logger(DoctorService.name);

  constructor(
    @InjectRepository(DoctorProfile)
    private readonly doctorProfileRepo: Repository<DoctorProfile>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /** Get doctor profile by user ID (doctors can only see their own) */
  async getProfile(doctorProfileId: string, user: { userId: string; role: string }) {
    const profile = await this.doctorProfileRepo.findOne({ where: { id: doctorProfileId } });
    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }
    // Doctors can only access their own profile
    if (user.role === 'doctor' && profile.user_id !== user.userId) {
      throw new ForbiddenException('You can only access your own doctor profile');
    }

    // Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'doctor_profile_view',
        actor_user_id: user.userId,
        resource_type: 'doctor_profile',
      }),
    );

    return profile;
  }

  /** Update doctor profile (own profile only) */
  async updateProfile(
    doctorProfileId: string,
    dto: UpdateDoctorProfileDto,
    user: { userId: string; role: string },
  ) {
    const profile = await this.doctorProfileRepo.findOne({ where: { id: doctorProfileId } });
    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }
    if (profile.user_id !== user.userId) {
      throw new ForbiddenException('You can only update your own doctor profile');
    }

    // Map DTO to entity columns
    const updates: Partial<DoctorProfile> = {};
    if (dto.specialty !== undefined) updates.specialty = dto.specialty;
    if (dto.hospitalAffiliation !== undefined) updates.hospital_affiliation = dto.hospitalAffiliation;
    if (dto.registrationNumber !== undefined) updates.registration_number = dto.registrationNumber;

    await this.doctorProfileRepo.update({ id: doctorProfileId }, updates);
    const updated = await this.doctorProfileRepo.findOne({ where: { id: doctorProfileId } });

    // Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'doctor_profile_update',
        actor_user_id: user.userId,
        resource_type: 'doctor_profile',
      }),
    );

    this.logger.log(`Doctor profile updated: ${doctorProfileId}`);
    return updated;
  }

  /** Get doctor profile by user ID (internal use) */
  async getProfileByUserId(userId: string): Promise<DoctorProfile | null> {
    return this.doctorProfileRepo.findOne({ where: { user_id: userId } });
  }
}
