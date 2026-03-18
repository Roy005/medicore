import { Injectable, NestMiddleware, Logger, InternalServerErrorException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditMiddleware.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let actorUserId: string | null = null;
    let patientId: string | null = null;

    // 1. Attempt to extract actor user id from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payloadStr = Buffer.from(token.split('.')[1], 'base64').toString();
        const payload = JSON.parse(payloadStr);
        if (payload?.sub) {
          actorUserId = payload.sub;
        }
      } catch (err) {
        // Assume failure to decode means no valid token;
        // The jwt auth guard will reject the request later anyway.
      }
    }

    // 2. Attempt to extract patientId from route URL 
    // Format is usually /api/v1/patients/:id/...
    const match = req.originalUrl.match(/\/patients\/([0-9a-fA-F-]+)/);
    if (match && match[1]) {
      patientId = match[1];
    }

    const method = req.method;
    const path = req.originalUrl;
    let resourceType = 'profile';
    if (path.includes('/medications')) resourceType = 'medication';
    else if (path.includes('/allergies')) resourceType = 'allergy';

    const eventType = `PHI_${method}_${resourceType.toUpperCase()}`;
    const ipAddress = req.ip || req.socket.remoteAddress || null;

    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          event_type: eventType,
          actor_user_id: actorUserId,
          patient_id: patientId,
          ip_address: ipAddress,
          resource_type: resourceType,
        })
      );
    } catch (error: any) {
      if (error.code === '23503') { // Postgres Foreign Key Violation
        // If the patientId doesn't exist, we log it without linking the FK
        try {
          await this.auditRepo.save(
            this.auditRepo.create({
              event_type: eventType,
              actor_user_id: actorUserId,
              patient_id: null,
              ip_address: ipAddress,
              resource_type: resourceType,
            })
          );
        } catch (fallbackError: any) {
          this.logger.error(`Audit log fallback failed: ${fallbackError.message}`, fallbackError.stack);
          throw new InternalServerErrorException('Critical Security Error: Unable to record audit log.');
        }
      } else {
        this.logger.error(`Failed to write audit log: ${error.message}`, error.stack);
        throw new InternalServerErrorException('Critical Security Error: Unable to record audit log. Access denied.');
      }
    }

    next();
  }
}
