import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  Ip,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /** POST /api/v1/ai/advisor/chat — AI chat with patient context */
  @Post('ai/advisor/chat')
  async chat(
    @Body() body: { patientId: string; message: string },
    @Req() req: any,
    @Ip() ip: string,
  ) {
    return this.aiService.chat(body.patientId, body.message, req.user.userId, ip);
  }

  /** GET /api/v1/patients/:id/ai/risk-scores — AI risk assessment */
  @Get('patients/:id/ai/risk-scores')
  async getRiskScores(
    @Param('id') patientId: string,
    @Req() req: any,
  ) {
    return this.aiService.getRiskScores(patientId, req.user.userId);
  }

  /** GET /api/v1/patients/:id/ai/alerts — combined AI + rule flags */
  @Get('patients/:id/ai/alerts')
  async getAiAlerts(@Param('id') patientId: string) {
    return this.aiService.getAiAlerts(patientId);
  }

  /** POST /api/v1/patients/:id/ai/preconsult-brief — pre-consultation summary */
  @Post('patients/:id/ai/preconsult-brief')
  async getPreconsultBrief(
    @Param('id') patientId: string,
    @Req() req: any,
  ) {
    return this.aiService.getPreconsultBrief(patientId, req.user.userId);
  }
}
