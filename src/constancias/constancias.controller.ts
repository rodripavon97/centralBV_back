import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ConstanciasService } from './constancias.service.js';
import { GuardarSolicitudDto } from './dtos/guardar-solicitud.dto.js';
import { ListarSolicitudesDto } from './dtos/listar-solicitudes.dto.js';
import { CancelarSolicitudDto } from './dtos/cancelar-solicitud.dto.js';

type RequestConUsuario = Request & { user?: { userId?: string } };

@ApiTags('Solicitudes')
@ApiBearerAuth()
@Controller('solicitudes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMINISTRATIVO')
export class ConstanciasController {
  constructor(private readonly constanciasService: ConstanciasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar solicitudes con búsqueda, filtro, orden y paginación (US09)' })
  async listar(@Query() query: ListarSolicitudesDto) {
    return this.constanciasService.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver el detalle de una solicitud' })
  async obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.constanciasService.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Dar de alta una solicitud en estado PENDIENTE (US08)' })
  async crear(@Body() dto: GuardarSolicitudDto, @Req() req: RequestConUsuario) {
    return this.constanciasService.crear(dto, req.user?.userId ?? null);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Editar una solicitud pendiente (US13)' })
  async actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GuardarSolicitudDto) {
    return this.constanciasService.actualizar(id, dto);
  }

  @Patch(':id/cancelar')
  @ApiOperation({ summary: 'Cancelar una solicitud pendiente con motivo (US13)' })
  async cancelar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelarSolicitudDto) {
    return this.constanciasService.cancelar(id, dto.motivo);
  }
}
