import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Ip,
} from '@nestjs/common';
import { VitalsService } from './vitals.service';
import { AlertEngineService } from './alert-engine.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class VitalsController {
  constructor(
    private readonly vitalsService: VitalsService,
    private readonly alertEngine: AlertEngineService,
  ) {}

  /** POST /api/v1/patients/:id/vitals — batch insert vitals */
  @Post('patients/:id/vitals')
  async addVitals(
    @Param('id') patientId: string,
    @Body() body: { readings: Array<{ metricType: string; value: number; unit: string; sourceDevice?: string; recordedAt?: string }> },
    @Req() req: any,
    @Ip() ip: string,
  ) {
    return this.vitalsService.addVitals(patientId, body.readings, req.user.userId, ip);
  }

  /** GET /api/v1/patients/:id/vitals — with query filters */
  @Get('patients/:id/vitals')
  async getVitals(
    @Param('id') patientId: string,
    @Query('metric') metricType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vitalsService.getVitals(
      patientId,
      metricType,
      from,
      to,
      parseInt(limit || '100', 10),
    );
  }

  /** GET /api/v1/patients/:id/vitals/latest — one per metric */
  @Get('patients/:id/vitals/latest')
  async getLatestVitals(@Param('id') patientId: string) {
    return this.vitalsService.getLatestVitals(patientId);
  }

  /** GET /api/v1/patients/:id/alerts — get alerts */
  @Get('patients/:id/alerts')
  async getAlerts(
    @Param('id') patientId: string,
    @Query('status') status?: string,
  ) {
    return this.alertEngine.getAlerts(patientId, status);
  }

  /** PATCH /api/v1/patients/:id/alerts/:alertId/resolve — resolve an alert */
  @Patch('patients/:id/alerts/:alertId/resolve')
  async resolveAlert(
    @Param('alertId') alertId: string,
    @Req() req: any,
  ) {
    return this.alertEngine.resolveAlert(alertId, req.user.userId);
  }
}
