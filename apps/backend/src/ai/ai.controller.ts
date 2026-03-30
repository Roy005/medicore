import { Controller, Post, Get, Param, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities';

@Controller('patients/:id/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  @Post('chat')
  async chat(
    @Param('id') patientId: string,
    @Body() body: { message: string; conversationHistory?: {role: string; content: string}[] },
    @Req() req: any,
  ) {
    if (req.user.userId !== patientId && req.user.role !== 'doctor') {
      if (req.user.userId !== patientId) {
        throw new ForbiddenException('You can only access your own data');
      }
    }

    const { message, conversationHistory = [] } = body;
    const result = await this.aiService.chat(patientId, message, conversationHistory);

    try {
      await this.auditRepo.save(this.auditRepo.create({
        event_type: 'ai_chat',
        actor_user_id: req.user.userId || req.user.id,
        patient_id: patientId,
        resource_type: 'ai',
      }));
    } catch (e) {
      console.error('Failed to save audit log for chat:', e.message);
    }

    return result;
  }

  @Get('risk-scores')
  async getRiskScores(
    @Param('id') patientId: string,
    @Req() req: any,
  ) {
    if (req.user.userId !== patientId && req.user.role !== 'doctor') {
      if (req.user.userId !== patientId) {
        throw new ForbiddenException('You can only access your own data');
      }
    }

    const result = await this.aiService.getRiskScores(patientId);

    try {
      await this.auditRepo.save(this.auditRepo.create({
        event_type: 'ai_risk_scores',
        actor_user_id: req.user.userId || req.user.id,
        patient_id: patientId,
        resource_type: 'ai',
      }));
    } catch (e) {
      console.error('Failed to save audit log for risk scores:', e.message);
    }

    return result;
  }
}
