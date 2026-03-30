import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { AuditLog, AccessToken } from '../entities';
import { UpdateDoctorProfileDto } from './doctor.dto';

@Injectable()
export class DoctorService {
  private readonly logger = new Logger(DoctorService.name);

  constructor(
    @InjectRepository(DoctorProfile)
    private readonly doctorProfileRepo: Repository<DoctorProfile>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(AccessToken)
    private readonly accessTokenRepo: Repository<AccessToken>,
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

  /** Get patients the doctor has access to */
  async getMyPatients(user: { userId: string; role: string }) {
    if (user.role !== 'doctor') {
      throw new ForbiddenException('Only doctors can access their patient list');
    }

    const tokens = await this.accessTokenRepo.find({
      where: { granted_to_user_id: user.userId },
      relations: ['patient', 'patient.user'],
      order: { granted_at: 'DESC' }
    });

    // Extract unique patients with brief details
    const patientMap = new Map<string, any>();
    for (const token of tokens) {
      if (!token.patient) continue;
      if (!patientMap.has(token.patient.id)) {
        patientMap.set(token.patient.id, {
          id: token.patient.id,
          firstName: (token.patient.demographics as any)?.firstName || '',
          lastName: (token.patient.demographics as any)?.lastName || '',
          dateOfBirth: token.patient.date_of_birth,
          bloodType: token.patient.blood_group,
          lastAccessGrantedAt: token.granted_at,
          accessType: token.access_type,
        });
      }
    }

    // Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'doctor_patient_list_view',
        actor_user_id: user.userId,
        resource_type: 'access_tokens',
      }),
    );

    return Array.from(patientMap.values());
  }
}
