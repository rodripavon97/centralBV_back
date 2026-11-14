import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { parseIdPipe } from '../common/pipes/parse-id.pipe.js';
import { CompartmentService } from './compartment.service.js';
import { GenerateCompartmentsDto } from './dtos/generate-compartments.dto.js';
import { CreateCompartmentDto } from './dtos/create-compartment.dto.js';
import { UpdateCompartmentDto } from './dtos/update-compartment.dto.js';
import { UpdateCompartmentStatusDto } from './dtos/update-compartment-status.dto.js';

/**
 * HTTP API for a vehicle's compartments ("buches", US17):
 * `/flota/vehiculos/:id/compartimentos`. Configuring them is for AUTOMOTORES
 * (ADMIN always passes); reading and changing the status is for anyone signed in.
 */
@ApiTags('Fleet compartments')
@ApiBearerAuth()
@Controller('flota/vehiculos/:id/compartimentos')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CompartmentController {
  constructor(private readonly compartments: CompartmentService) {}

  /** The vehicle's compartments in plan order. */
  @Get()
  @ApiOperation({ summary: 'List the compartments of a vehicle' })
  list(@Param('id', parseIdPipe()) id: string) {
    return this.compartments.list(id);
  }

  /** Create every compartment at once from per-zone counts. */
  @Roles('AUTOMOTORES')
  @Post('generar')
  @ApiOperation({ summary: 'Generate the compartments of a vehicle' })
  generate(
    @Param('id', parseIdPipe()) id: string,
    @Body() dto: GenerateCompartmentsDto,
  ) {
    return this.compartments.generate(id, dto);
  }

  /** Add one compartment at the end of its zone. */
  @Roles('AUTOMOTORES')
  @Post()
  @ApiOperation({ summary: 'Add a compartment' })
  create(
    @Param('id', parseIdPipe()) id: string,
    @Body() dto: CreateCompartmentDto,
  ) {
    return this.compartments.create(id, dto);
  }

  /** Change a compartment's status (any signed-in user). */
  @Patch(':compartimentoId/estado')
  @ApiOperation({ summary: 'Change the status of a compartment' })
  setStatus(
    @Param('id', parseIdPipe()) id: string,
    @Param('compartimentoId', parseIdPipe()) compartimentoId: string,
    @Body() dto: UpdateCompartmentStatusDto,
  ) {
    return this.compartments.setStatus(id, compartimentoId, dto.estado);
  }

  /** Rename a compartment or move it to another zone. */
  @Roles('AUTOMOTORES')
  @Patch(':compartimentoId')
  @ApiOperation({ summary: 'Update a compartment' })
  update(
    @Param('id', parseIdPipe()) id: string,
    @Param('compartimentoId', parseIdPipe()) compartimentoId: string,
    @Body() dto: UpdateCompartmentDto,
  ) {
    return this.compartments.update(id, compartimentoId, dto);
  }

  /** Delete a compartment (refused while it has materials). */
  @Roles('AUTOMOTORES')
  @Delete(':compartimentoId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a compartment' })
  async remove(
    @Param('id', parseIdPipe()) id: string,
    @Param('compartimentoId', parseIdPipe()) compartimentoId: string,
  ) {
    await this.compartments.remove(id, compartimentoId);
  }
}
