import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { parseIdPipe } from '../common/pipes/parse-id.pipe.js';
import { FleetService } from './fleet.service.js';
import { CreateEmergencyVehicleDto } from './dtos/create-emergency-vehicle.dto.js';
import { UpdateEmergencyVehicleDto } from './dtos/update-emergency-vehicle.dto.js';
import { ListEmergencyVehiclesDto } from './dtos/list-emergency-vehicles.dto.js';
import { WriteOffEmergencyVehicleDto } from './dtos/write-off-emergency-vehicle.dto.js';
import { CreateRevisionDto } from './dtos/create-revision.dto.js';
import { ListRevisionsDto } from './dtos/list-revisions.dto.js';

type RequestWithUser = Request & { user?: { userId?: string } };

/**
 * HTTP API for emergency vehicles (`/flota/vehiculos`).
 * Any signed-in user can read; create and update need AUTOMOTORES
 * (ADMIN always passes, see RolesGuard).
 */
@ApiTags('Fleet')
@ApiBearerAuth()
@Controller('flota/vehiculos')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  /** List active vehicles with search, filters, sort and pagination. */
  @Get()
  @ApiOperation({
    summary: 'List active vehicles with search, filters, sort and pagination',
  })
  async list(@Query() query: ListEmergencyVehiclesDto) {
    return this.fleetService.findAll(query);
  }

  /** Count active vehicles by status (dashboard counters). Declared before `:id`. */
  @Get('resumen')
  @ApiOperation({ summary: 'Count active vehicles by status' })
  async summary() {
    return this.fleetService.summary();
  }

  /** Get a single vehicle by id (includes written-off). */
  @Get(':id')
  @ApiOperation({ summary: 'Get emergency vehicle detail' })
  async getById(@Param('id', parseIdPipe()) id: string) {
    return this.fleetService.findById(id);
  }

  /** Inspection history, newest first, paginated (any signed-in user). */
  @Get(':id/revisiones')
  @ApiOperation({ summary: 'List vehicle inspections (newest first)' })
  async listRevisions(
    @Param('id', parseIdPipe()) id: string,
    @Query() query: ListRevisionsDto,
  ) {
    return this.fleetService.findRevisions(id, query);
  }

  /** Latest inspection for a vehicle. Declared before `:revisionId`. */
  @Get(':id/revisiones/ultima')
  @ApiOperation({ summary: 'Get the latest vehicle inspection' })
  async getLatestRevision(@Param('id', parseIdPipe()) id: string) {
    return this.fleetService.findLatestRevision(id);
  }

  /** One inspection of the vehicle. */
  @Get(':id/revisiones/:revisionId')
  @ApiOperation({ summary: 'Get one vehicle inspection' })
  async getRevision(
    @Param('id', parseIdPipe()) id: string,
    @Param('revisionId', parseIdPipe()) revisionId: string,
  ) {
    return this.fleetService.findRevision(id, revisionId);
  }

  /** Create a vehicle in OPERATIVO status (AUTOMOTORES). */
  @Roles('AUTOMOTORES')
  @Post()
  @ApiOperation({ summary: 'Create an emergency vehicle (OPERATIVO)' })
  async create(@Body() dto: CreateEmergencyVehicleDto) {
    return this.fleetService.create(dto);
  }

  /** Register a checklist inspection and update vehicle status (any signed-in user). */
  @Post(':id/revisiones')
  @ApiOperation({
    summary: 'Register a vehicle inspection and update status',
  })
  async createRevision(
    @Param('id', parseIdPipe()) id: string,
    @Body() dto: CreateRevisionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.fleetService.createRevision(id, dto, req.user?.userId ?? null);
  }

  /** Update general data, everything except status (AUTOMOTORES). */
  @Roles('AUTOMOTORES')
  @Patch(':id')
  @ApiOperation({ summary: 'Update general vehicle data' })
  async update(
    @Param('id', parseIdPipe()) id: string,
    @Body() dto: UpdateEmergencyVehicleDto,
  ) {
    return this.fleetService.update(id, dto);
  }

  /** Permanently write off a vehicle (ADMIN only). */
  @Roles('ADMIN')
  @Patch(':id/baja')
  @ApiOperation({ summary: 'Write off a vehicle permanently (ADMIN)' })
  async writeOff(
    @Param('id', parseIdPipe()) id: string,
    @Body() dto: WriteOffEmergencyVehicleDto,
  ) {
    return this.fleetService.writeOff(id, dto);
  }
}
