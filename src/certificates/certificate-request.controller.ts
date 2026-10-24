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
import { CertificateRequestService } from './certificate-request.service.js';
import { CreateCertificateRequestDto } from './dtos/create-certificate-request.dto.js';
import { ListCertificateRequestsDto } from './dtos/list-certificate-requests.dto.js';
import { CancelCertificateRequestDto } from './dtos/cancel-certificate-request.dto.js';
import { AddPaymentDto } from './dtos/add-payment.dto.js';
import { DeliverCertificateRequestDto } from './dtos/deliver-certificate-request.dto.js';

type RequestWithUser = Request & { user?: { userId?: string } };

/** HTTP API for certificate requests (`/solicitudes`). */
@ApiTags('Solicitudes')
@ApiBearerAuth()
@Controller('solicitudes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMINISTRATIVO')
export class CertificateRequestController {
  constructor(private readonly service: CertificateRequestService) {}

  /** US09: list with search, filter, sort and pagination. */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Get()
  @ApiOperation({
    summary:
      'Listar solicitudes con búsqueda, filtro, orden y paginación (US09)',
  })
  async list(@Query() query: ListCertificateRequestsDto) {
    return this.service.findAll(query);
  }

  /** Returns the detail of a single request. */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Get(':id')
  @ApiOperation({ summary: 'Ver el detalle de una solicitud' })
  async obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  /** US08: create a request in PENDIENTE status. */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Post()
  @ApiOperation({
    summary: 'Dar de alta una solicitud en estado PENDIENTE (US08)',
  })
  async create(
    @Body() dto: CreateCertificateRequestDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.create(dto, req.user?.userId ?? null);
  }

  /** US13: edit a pending request. */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Put(':id')
  @ApiOperation({ summary: 'Editar una solicitud pendiente (US13)' })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCertificateRequestDto,
  ) {
    return this.service.updatePending(id, dto);
  }

  /** US13: cancel a pending request with a reason. */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Patch(':id/cancelar')
  @ApiOperation({
    summary: 'Cancelar una solicitud pendiente con motivo (US13)',
  })
  async cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelCertificateRequestDto,
  ) {
    return this.service.cancelRequest(id, dto.motivo);
  }

  /** Sign a request in REALIZADA status (REALIZADA → FIRMADA). */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Patch(':id/firmar')
  @ApiOperation({
    summary: 'Firmar una solicitud en estado REALIZADA',
  })
  async firmar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.signRequest(id);
  }

  /** Register or edit payment; fails if cancelled or delivered. */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Patch(':id/abono')
  @ApiOperation({
    summary:
      'Registrar o editar abono (falla si está cancelada o entregada)',
  })
  async abonar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPaymentDto,
  ) {
    return this.service.addPayment(id, dto);
  }

  /** Mark a signed and paid request as delivered (RETIRADA). */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Patch(':id/entregar')
  @ApiOperation({
    summary:
      'Marcar una solicitud firmada y abonada como entregada (RETIRADA)',
  })
  async entregar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeliverCertificateRequestDto,
  ) {
    return this.service.markAsDelivered(id, dto);
  }
}
