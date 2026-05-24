import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { UpdateDoctorProfileDto } from './doctor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities';

@Controller('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  /** GET /api/v1/doctors/me/profile — get logged-in doctor's own profile */
  @Get('me/profile')
  @Roles(UserRole.DOCTOR)
  async getMyProfile(@Req() req: any) {
    return this.doctorService.getProfileByUserId(req.user.userId);
  }

  /** PATCH /api/v1/doctors/me/profile — update logged-in doctor's own profile */
  @Patch('me/profile')
  @Roles(UserRole.DOCTOR)
  async updateMyProfile(
    @Body() dto: UpdateDoctorProfileDto,
    @Req() req: any,
  ) {
    const profile = await this.doctorService.getProfileByUserId(req.user.userId);
    if (!profile) {
      throw new Error('Doctor profile not found');
    }
    return this.doctorService.updateProfile(profile.id, dto, req.user);
  }

  /** GET /api/v1/doctors/my-patients — get patients under doctor care */
  @Get('my-patients')
  @Roles(UserRole.DOCTOR)
  async getMyPatients(@Req() req: any) {
    return this.doctorService.getMyPatients(req.user);
  }

  /** DELETE /api/v1/doctors/consent/:patientId — doctor revokes own access to a patient */
  @Delete('consent/:patientId')
  @Roles(UserRole.DOCTOR)
  async revokePatientAccess(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ) {
    return this.doctorService.revokePatientAccess(patientId, req.user);
  }

  /** GET /api/v1/doctors/:id/profile — doctor's own profile */
  @Get(':id/profile')
  @Roles(UserRole.DOCTOR)
  async getProfile(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.doctorService.getProfile(id, req.user);
  }

  /** PATCH /api/v1/doctors/:id/profile — update own profile */
  @Patch(':id/profile')
  @Roles(UserRole.DOCTOR)
  async updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateDoctorProfileDto,
    @Req() req: any,
  ) {
    return this.doctorService.updateProfile(id, dto, req.user);
  }
}
