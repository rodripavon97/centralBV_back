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
import { ListCompletedCertificateRequestsDto } from './dtos/list-completed-certificate-requests.dto.js';
import { CancelCertificateRequestDto } from './dtos/cancel-certificate-request.dto.js';
import { RealizeCertificateRequestDto } from './dtos/realize-certificate-request.dto.js';
import { AddPaymentDto } from './dtos/add-payment.dto.js';
import { DeliverCertificateRequestDto } from './dtos/deliver-certificate-request.dto.js';

type RequestWithUser = Request & { user?: { userId?: string } };

/** HTTP API for certificate requests (`/solicitudes`). */
@ApiTags('Certificate requests')
@ApiBearerAuth()
@Controller('solicitudes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMINISTRATIVO')
export class CertificateRequestController {
  constructor(
    private readonly service: CertificateRequestService,
    private readonly pdfService: CertificatePdfService,
  ) {}

  /** US09: list active requests with search, filter, sort and pagination. */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Get()
  @ApiOperation({
    summary:
      'List active requests with search, filter, sort and pagination',
  })
  async list(@Query() query: ListCertificateRequestsDto) {
    return this.service.findAll(query);
  }

  /** List completed (RETIRADA) requests with search, sort and pagination. */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Get('completadas')
  @ApiOperation({
    summary: 'List completed requests with search, sort and pagination',
  })
  async listCompleted(@Query() query: ListCompletedCertificateRequestsDto) {
    return this.service.findCompleted(query);
  }

  /** Download the certificate PDF (REALIZADA | FIRMADA | RETIRADA). */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary:
      'Download the certificate PDF (REALIZADA, FIRMADA or RETIRADA)',
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
  @ApiOperation({ summary: 'Get request detail' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  /** US08: create a request in PENDIENTE status. */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Post()
  @ApiOperation({
    summary: 'Create a request in PENDIENTE status (US08)',
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
  @ApiOperation({ summary: 'Edit a pending request (US13)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCertificateRequestDto,
  ) {
    return this.service.updatePending(id, dto);
  }

  /** US13: cancel a pending request with a reason. */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Patch(':id/cancelar')
  @ApiOperation({
    summary: 'Cancel a pending request with a reason (US13)',
  })
  async cancel(
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
      'Realize certificate (PENDIENTE → REALIZADA) and return the PDF',
  })
  async realize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RealizeCertificateRequestDto,
  ): Promise<StreamableFile> {
    const observations = dto.observaciones ?? null;
    await this.service.realizeRequest(id, observations);
    const { buffer, filename } = await this.pdfService.generatePdf(
      id,
      observations,
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
    summary: 'Sign a request in REALIZADA status',
  })
  async sign(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.signRequest(id);
  }

  /** Register or edit payment; fails if cancelled or delivered. */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Patch(':id/abono')
  @ApiOperation({
    summary: 'Register or edit payment (fails if cancelled or delivered)',
  })
  async addPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPaymentDto,
  ) {
    return this.service.addPayment(id, dto);
  }

  /** Mark a signed and paid request as delivered (RETIRADA). */
  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Patch(':id/entregar')
  @ApiOperation({
    summary: 'Mark a signed and paid request as delivered (RETIRADA)',
  })
  async deliver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeliverCertificateRequestDto,
  ) {
    return this.service.markAsDelivered(id, dto);
  }
}
