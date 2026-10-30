import {
  Controller,
  UseGuards,
  Post,
  Patch,
  Body,
  Get,
  Query,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dtos/create-user.dto.js';
import { ListUsersDto } from './dtos/list-user.dto.js';
import { UserDetailDto } from './dtos/user-details.dto.js';
import { EditUserDto } from './dtos/edit-user.dto.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear un nuevo usuario (Solo Admin)' })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Listar usuarios con búsqueda, filtros y paginación (Solo Admin)',
  })
  async findAll(@Query() query: ListUsersDto) {
    return this.usersService.findAll(query);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Editar los datos de un usuario (Solo Admin)' })
  @ApiParam({
    name: 'id',
    description: 'UUID del usuario',
    example: '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b',
  })
  @ApiResponse({
    status: 200,
    type: UserDetailDto,
    description: 'Usuario actualizado',
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'El correo electrónico ya está registrado',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditUserDto,
  ) {
    const updated = await this.usersService.updateUser(id, dto);
    return UserDetailDto.fromUser(updated);
  }

  @Post(':id/reenviar-bienvenida')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Reenviar el correo de bienvenida con una nueva contraseña temporal (Solo Admin)',
  })
  async resendWelcomeEmail(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.resendWelcomeEmail(id);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Buscar un usuario por su ID (Solo Admin)' })
  @ApiParam({
    name: 'id',
    description: 'UUID del usuario',
    example: '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b',
  })
  @ApiResponse({
    status: 200,
    type: UserDetailDto,
    description: 'Usuario encontrado',
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findOne(id);
    return UserDetailDto.fromUser(user);
  }
}
