import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesService } from './roles.service.js';
import { AssignRoleDto } from './dtos/assing-roles.dtos.js';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post('assign')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Asignar un rol a un usuario (Solo Admin)' })
  async assign(@Body() dto: AssignRoleDto) {
    return this.rolesService.assignRole(dto.usuario_id, dto.rol_id);
  }
}