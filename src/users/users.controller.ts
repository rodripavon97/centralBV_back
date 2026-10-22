import {
  Controller,
  UseGuards,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('pending')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Ver usuarios pendientes de aprobación (Solo Admin)' })
  async getPending() {
    return this.usersService.getPendingUsers();
  }

  @Patch(':id/approve')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Aprobar la creación de un usuario (Solo Admin)' })
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.approveUser(id);
  }

  // We're including this endpoint in case you need to list users in a table in the future
  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Listar todos los usuarios (Solo Admin)' })
  async findAll() {
    // This endpoint is currently not implemented, but it's here for future use if you need to list users in a table.
    return []; 
  }
}