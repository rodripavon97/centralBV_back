import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { VehicleCatalogService } from './vehicle-catalog.service.js';
import { CreateCatalogItemDto } from './dtos/create-catalog-item.dto.js';
import { UpdateCatalogItemDto } from './dtos/update-catalog-item.dto.js';
import { CreateCatalogModelDto } from './dtos/create-catalog-model.dto.js';

/**
 * HTTP API for vehicle catalogs (`/flota/catalogos/tipos|marcas|modelos`).
 * Any signed-in user can read (with `enUso`); writes need AUTOMOTORES, the
 * same role that registers vehicles (ADMIN always passes, see RolesGuard).
 */
@ApiTags('Fleet catalogs')
@ApiBearerAuth()
@Controller('flota/catalogos')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class VehicleCatalogController {
  constructor(private readonly catalogService: VehicleCatalogService) {}

  // --- tipos ---

  /** List active vehicle types. */
  @Get('tipos')
  @ApiOperation({ summary: 'List active vehicle types' })
  findTypes() {
    return this.catalogService.findTypes();
  }

  /** Create a vehicle type (AUTOMOTORES). */
  @Roles('AUTOMOTORES')
  @Post('tipos')
  @ApiOperation({ summary: 'Create a vehicle type (AUTOMOTORES)' })
  createType(@Body() dto: CreateCatalogItemDto) {
    return this.catalogService.createType(dto.valor);
  }

  /** Rename a vehicle type (AUTOMOTORES). */
  @Roles('AUTOMOTORES')
  @Patch('tipos/:id')
  @ApiOperation({ summary: 'Rename a vehicle type (AUTOMOTORES)' })
  updateType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogItemDto,
  ) {
    return this.catalogService.updateType(id, dto.valor);
  }

  /** Soft-deactivate a vehicle type (AUTOMOTORES). */
  @Roles('AUTOMOTORES')
  @Patch('tipos/:id/desactivar')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deactivate a vehicle type (AUTOMOTORES)' })
  deactivateType(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.deactivateType(id);
  }

  // --- marcas ---

  /** List active vehicle brands. */
  @Get('marcas')
  @ApiOperation({ summary: 'List active vehicle brands' })
  findBrands() {
    return this.catalogService.findBrands();
  }

  /** Create a vehicle brand (AUTOMOTORES). */
  @Roles('AUTOMOTORES')
  @Post('marcas')
  @ApiOperation({ summary: 'Create a vehicle brand (AUTOMOTORES)' })
  createBrand(@Body() dto: CreateCatalogItemDto) {
    return this.catalogService.createBrand(dto.valor);
  }

  /** Rename a vehicle brand (AUTOMOTORES). */
  @Roles('AUTOMOTORES')
  @Patch('marcas/:id')
  @ApiOperation({ summary: 'Rename a vehicle brand (AUTOMOTORES)' })
  updateBrand(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogItemDto,
  ) {
    return this.catalogService.updateBrand(id, dto.valor);
  }

  /** Soft-deactivate a vehicle brand (AUTOMOTORES). */
  @Roles('AUTOMOTORES')
  @Patch('marcas/:id/desactivar')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deactivate a vehicle brand (AUTOMOTORES)' })
  deactivateBrand(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.deactivateBrand(id);
  }

  // --- modelos ---

  /** List active vehicle models. */
  @Get('modelos')
  @ApiOperation({ summary: 'List active vehicle models' })
  findModels() {
    return this.catalogService.findModels();
  }

  /** Create a vehicle model (AUTOMOTORES). */
  @Roles('AUTOMOTORES')
  @Post('modelos')
  @ApiOperation({ summary: 'Create a vehicle model (AUTOMOTORES)' })
  createModel(@Body() dto: CreateCatalogModelDto) {
    return this.catalogService.createModel(dto.valor, dto.marcaId);
  }

  /** Rename a vehicle model (AUTOMOTORES). */
  @Roles('AUTOMOTORES')
  @Patch('modelos/:id')
  @ApiOperation({ summary: 'Rename a vehicle model (AUTOMOTORES)' })
  updateModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogItemDto,
  ) {
    return this.catalogService.updateModel(id, dto.valor);
  }

  /** Soft-deactivate a vehicle model (AUTOMOTORES). */
  @Roles('AUTOMOTORES')
  @Patch('modelos/:id/desactivar')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deactivate a vehicle model (AUTOMOTORES)' })
  deactivateModel(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.deactivateModel(id);
  }
}
