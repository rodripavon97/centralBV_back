import { Injectable, Inject, NotFoundException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { USER_REPOSITORY } from './domain/user.repository.js';
import type { UserRepository } from './domain/user.repository.js';
import { User } from './domain/user.entity.js';
import { CreateUserDto } from './dtos/create-user.dto.js';

import { SupabaseService } from '../supabase/supabase.service.js';
import { throwMappedSupabaseError } from '../supabase/supabase-error.js';
import { buildPaginatedResponse, Paginated } from '../common/utils/pagination.utils.js';
import { ListUsersDto } from './dtos/list-user.dto.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly supabase: SupabaseService,
  ) {}

  async findAll(query: ListUsersDto): Promise<Paginated<User>> {
    const { busqueda, rol, activo, orden, pagina, porPagina } = query;
    
    // Traducimos el DTO de HTTP a la interfaz de Dominio
    const { items, total } = await this.userRepo.findAll({
      busqueda: busqueda?.trim() || undefined,
      rol: rol?.trim() || undefined,
      activo,
      orden,
      pagina: Number(pagina) || 1,
      porPagina: Number(porPagina) || 10,
    });

    return buildPaginatedResponse(items, total, pagina, porPagina);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundException(`El usuario con ID ${id} no fue encontrado`);
    }
    return user;
  }

  async createUser(dto: CreateUserDto) {
    const db = this.supabase.getAdminClient();

    // 1. Verificar si existe
    const existingUser = await this.userRepo.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado en el sistema');
    }

    try {
      // 2. Crear en Supabase Auth
      const { data: authData, error: authError } = await db.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
      });

      if (authError) throwMappedSupabaseError(authError);
      const userId = authData.user.id;

      // 3. Insertar en public.usuarios
      await this.userRepo.create({
        id: userId,
        email: dto.email,
        nombre: dto.nombre,
        apellido: dto.apellido,
        activo: true,
      });

      // 4. Asignar Roles (Lógica de Matriz de Permisos)
      const roleToAssign = dto.roleName.toUpperCase();
      const rolesIdsToAssign: { usuario_id: string; rol_id: string }[] = [];

      // Rol principal
      const { data: mainRole, error: roleError } = await db
        .from('roles')
        .select('id')
        .eq('nombre', roleToAssign)
        .single();

      if (roleError || !mainRole) {
        throw new NotFoundException(`El rol '${roleToAssign}' no existe en el sistema`);
      }
      rolesIdsToAssign.push({ usuario_id: userId, rol_id: mainRole.id });

      // Herencia explícita: Si es ADMINISTRATIVO, también lleva COMUN
      if (roleToAssign === 'ADMINISTRATIVO') {
        const { data: comunRole } = await db
          .from('roles')
          .select('id')
          .eq('nombre', 'COMUN')
          .single();
          
        if (comunRole) {
          rolesIdsToAssign.push({ usuario_id: userId, rol_id: comunRole.id });
        }
      }

      // 5. Insertar roles
      const { error: assignError } = await db.from('usuario_rol').insert(rolesIdsToAssign);
      if (assignError) throwMappedSupabaseError(assignError);

      this.logger.log(`[EMAIL] Enviando correo de bienvenida a ${dto.email} con contraseña temporal.`);

      return {
        message: 'Usuario creado exitosamente y correo de bienvenida enviado',
        userId: userId,
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error creando usuario: ${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException('Error interno al crear el usuario');
    }
  }
}