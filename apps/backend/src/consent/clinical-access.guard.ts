import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities';
import { ConsentService } from './consent.service';

/**
 * ClinicalAccessGuard — reads X-Clinical-Token header on doctor→patient requests.
 * Validates the clinical JWT, checks revocation, and checks that the patientId
 * in the token matches the :id route parameter.
 */
@Injectable()
export class ClinicalAccessGuard implements CanActivate {
  private readonly logger = new Logger(ClinicalAccessGuard.name);

  constructor(
    private readonly consentService: ConsentService,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const clinicalToken = request.headers['x-clinical-token'];

    if (!clinicalToken) {
      throw new UnauthorizedException('X-Clinical-Token header is required for clinical access');
    }

    const validated = await this.consentService.validateClinicalToken(clinicalToken);

    // Extract patient ID from route params
    const routePatientId = request.params?.id;
    if (routePatientId && routePatientId !== validated.patientId) {
      throw new UnauthorizedException(
        'Clinical token is not valid for this patient',
      );
    }

    // Attach clinical context to request for downstream use
    request.clinicalAccess = {
      doctorId: validated.doctorId,
      patientId: validated.patientId,
      accessType: validated.accessType,
      tokenId: validated.tokenId,
    };

    // Also set user if not already set
    if (!request.user) {
      request.user = {
        userId: validated.doctorId,
        role: 'doctor',
      };
    }

    // Audit every clinical access request
    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'clinical_access',
        actor_user_id: validated.doctorId,
        patient_id: validated.patientId,
        ip_address: request.ip || request.socket?.remoteAddress || null,
        resource_type: 'clinical_access',
      }),
    );

    return true;
  }
}
