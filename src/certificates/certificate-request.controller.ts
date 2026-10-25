import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CertificateRequestService } from './certificate-request.service.js';
import { CertificatePdfService } from './pdf/certificate-pdf.service.js';
import { CreateCertificateRequestDto } from './dtos/create-certificate-request.dto.js';
import { ListCertificateRequestsDto } from './dtos/list-certificate-requests.dto.js';
import { CancelCertificateRequestDto } from './dtos/cancel-certificate-request.dto.js';
import { RealizeCertificateRequestDto } from './dtos/realize-certificate-request.dto.js';
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
  constructor(
    private readonly service: CertificateRequestService,
    private readonly pdfService: CertificatePdfService,
  ) {}

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

  /** Download the certificate PDF (REALIZADA | FIRMADA | RETIRADA). */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary:
      'Descargar el PDF de la constancia (REALIZADA, FIRMADA o RETIRADA)',
  })
  async pdf(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const { buffer, filename } = await this.pdfService.generatePdf(id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${filename}"`,
    });
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

  /**
   * Mark pending as REALIZADA (optional observaciones) and return the PDF.
   */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Patch(':id/generar-constancia')
  @Header('Content-Type', 'application/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary:
      'Generar constancia (PENDIENTE → REALIZADA) y devolver el PDF de la constancia',
  })
  async generarConstancia(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RealizeCertificateRequestDto,
  ): Promise<StreamableFile> {
    const observaciones = dto.observaciones ?? null;
    await this.service.realizeRequest(id, observaciones);
    const { buffer, filename } = await this.pdfService.generatePdf(
      id,
      observaciones,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${filename}"`,
    });
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
    summary: 'Registrar o editar abono (falla si está cancelada o entregada)',
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
    summary: 'Marcar una solicitud firmada y abonada como entregada (RETIRADA)',
  })
  async entregar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeliverCertificateRequestDto,
  ) {
    return this.service.markAsDelivered(id, dto);
  }
}
