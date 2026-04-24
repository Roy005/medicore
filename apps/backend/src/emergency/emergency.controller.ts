import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import * as express from 'express';
import { EmergencyService } from './emergency.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  // ─── AUTHENTICATED ENDPOINTS ─────────────────────────────────

  /**
   * POST /api/v1/patients/:id/emergency/refresh
   * Regenerate the static emergency snapshot JSON file.
   */
  @UseGuards(JwtAuthGuard)
  @Post('patients/:id/emergency/refresh')
  @HttpCode(HttpStatus.CREATED)
  async refreshSnapshot(
    @Param('id') patientId: string,
    @Req() req: express.Request & { user: any },
  ) {
    await this.emergencyService.authorizeAccess(patientId, req.user);
    const result = await this.emergencyService.refreshSnapshot(patientId);
    return {
      message: 'Emergency snapshot regenerated successfully',
      token: result.token,
      generatedAt: result.generatedAt,
    };
  }

  /**
   * GET /api/v1/patients/:id/emergency/qr
   * Returns the QR code as a PNG image.
   */
  @UseGuards(JwtAuthGuard)
  @Get('patients/:id/emergency/qr')
  async getQrCode(
    @Param('id') patientId: string,
    @Req() req: express.Request & { user: any },
    @Res() res: express.Response,
  ) {
    await this.emergencyService.authorizeAccess(patientId, req.user);
    const buffer = await this.emergencyService.generateQrCode(patientId);

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'no-cache',
    });
    res.send(buffer);
  }

  // ─── PUBLIC ENDPOINT (no auth) ───────────────────────────────

  /**
   * GET /api/v1/emergency/:token/data
   * Public endpoint — returns emergency snapshot JSON for a given QR token.
   * Called by the frontend emergency page (works on Vercel with no filesystem).
   */
  @Get('emergency/:token/data')
  async getSnapshotByToken(@Param('token') token: string) {
    return this.emergencyService.getSnapshotByToken(token);
  }

  /**
   * POST /api/v1/emergency/:token/log
   * Async access logging — called from the static emergency page.
   * Intentionally unauthenticated. Never blocks, never errors to caller.
   */
  @Post('emergency/:token/log')
  @HttpCode(HttpStatus.CREATED)
  async logAccess(
    @Param('token') token: string,
    @Req() req: express.Request,
    @Body() body: { ip?: string; userAgent?: string },
  ) {
    const ip = body.ip || req.ip || req.socket.remoteAddress || null;
    const userAgent = body.userAgent || req.headers['user-agent'] || null;

    // Fire and forget — don't await (but we do here minimally to return 201)
    // The service itself swallows all errors
    this.emergencyService.logAccess(token, ip, userAgent).catch(() => {});

    return { message: 'Access logged' };
  }
}
