import {
  Controller,
  Get,
  Patch,
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

  /** GET /api/v1/doctors/my-patients — get patients under doctor care */
  @Get('my-patients')
  @Roles(UserRole.DOCTOR)
  async getMyPatients(@Req() req: any) {
    return this.doctorService.getMyPatients(req.user);
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

