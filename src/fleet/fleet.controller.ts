import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { FleetService } from './fleet.service.js';
import { CreateEmergencyVehicleDto } from './dtos/create-emergency-vehicle.dto.js';
import { UpdateEmergencyVehicleDto } from './dtos/update-emergency-vehicle.dto.js';
import { ListEmergencyVehiclesDto } from './dtos/list-emergency-vehicles.dto.js';
import { WriteOffEmergencyVehicleDto } from './dtos/write-off-emergency-vehicle.dto.js';

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

  /** Get a single vehicle by id (includes written-off). */
  @Get(':id')
  @ApiOperation({ summary: 'Get emergency vehicle detail' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.fleetService.findById(id);
  }

  /** Create a vehicle in OPERATIVO status (AUTOMOTORES). */
  @Roles('AUTOMOTORES')
  @Post()
  @ApiOperation({ summary: 'Create an emergency vehicle (OPERATIVO)' })
  async create(@Body() dto: CreateEmergencyVehicleDto) {
    return this.fleetService.create(dto);
  }

  /** Update general data, everything except status (AUTOMOTORES). */
  @Roles('AUTOMOTORES')
  @Patch(':id')
  @ApiOperation({ summary: 'Update general vehicle data' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmergencyVehicleDto,
  ) {
    return this.fleetService.update(id, dto);
  }

  /** Permanently write off a vehicle (ADMIN only). */
  @Roles('ADMIN')
  @Patch(':id/baja')
  @ApiOperation({ summary: 'Write off a vehicle permanently (ADMIN)' })
  async writeOff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WriteOffEmergencyVehicleDto,
  ) {
    return this.fleetService.writeOff(id, dto);
  }
}
