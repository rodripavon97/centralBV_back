import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { USER_REPOSITORY } from './domain/user.repository.js';
import type { UserRepository } from './domain/user.repository.js';
import { CreateUserDto } from './dtos/create-user.dto.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { throwMappedSupabaseError } from '../supabase/supabase-error.js';
import { MailService } from '../mail/mail.service.js';
import { User } from './domain/user.entity.js';
import { buildPaginatedResponse, Paginated } from '../common/utils/pagination.utils.js';
import { EncryptionService } from '../common/security/encryption.service.js';
import { ListUsersDto } from './dtos/list-user.dto.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly supabase: SupabaseService,
    private readonly mailService: MailService,
    private readonly encryption: EncryptionService,
  ) {}

  async findAll(query: ListUsersDto): Promise<Paginated<User>> {
    const { busqueda, rol, activo, orden, pagina, porPagina } = query;
    
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

    const existingUser = await this.userRepo.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado en el sistema');
    }

    try {
      const { data: authData, error: authError } = await db.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
      });

      if (authError) throwMappedSupabaseError(authError);
      const userId = authData.user.id;

      await this.userRepo.create({
        id: userId,
        email: dto.email,
        nombre: dto.nombre,
        apellido: dto.apellido,
        activo: true,
      });

      // Guardamos la contraseña cifrada para poder reenviarla tal cual
      // en el correo de bienvenida (nunca en texto plano).
      await this.storeEncryptedPassword(userId, dto.password);

      const roleToAssign = dto.roleName.toUpperCase();
      const rolesIdsToAssign: { usuario_id: string; rol_id: string }[] = [];

      const { data: mainRole, error: roleError } = await db
        .from('roles')
        .select('id')
        .eq('nombre', roleToAssign)
        .single();

      if (roleError || !mainRole) {
        throw new NotFoundException(`El rol '${roleToAssign}' no existe en el sistema`);
      }
      rolesIdsToAssign.push({ usuario_id: userId, rol_id: mainRole.id });

      // Herencia de roles según la Matriz de Permisos
      if (roleToAssign === 'ADMINISTRATIVO') {
        const { data: comunRole } = await db.from('roles').select('id').eq('nombre', 'COMUN').single();
        if (comunRole) rolesIdsToAssign.push({ usuario_id: userId, rol_id: comunRole.id });
      }

      const { error: assignError } = await db.from('usuario_rol').insert(rolesIdsToAssign);
      if (assignError) throwMappedSupabaseError(assignError);

      // Enviar correo real
      await this.mailService.sendWelcomeEmail(dto.email, dto.nombre, dto.password);

      return {
        message: 'Usuario creado exitosamente. Se ha enviado un correo con las credenciales.',
        userId: userId,
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error creando usuario: ${(error as Error).message}`);
      throw new InternalServerErrorException('Error interno al crear el usuario');
    }
  }

  async resendWelcomeEmail(id: string) {
    const user = await this.findOne(id);

    // Debe ser exactamente la contraseña que el admin ingresó al registrar
    // al usuario. Si no está guardada (usuarios viejos), no se inventa una.
    const password = await this.getStoredPassword(user.id);
    if (!password) {
      throw new BadRequestException(
        'No hay una contraseña guardada para este usuario porque fue creado antes de habilitar esta función. Asignale una nueva contraseña y volvé a intentarlo.',
      );
    }

    await this.mailService.sendWelcomeEmail(user.email, user.nombre, password);

    return {
      message: 'Correo de bienvenida reenviado exitosamente.',
    };
  }

  /** Guarda la contraseña cifrada con AES-256-GCM en `usuarios.password_cifrada`. */
  private async storeEncryptedPassword(userId: string, password: string) {
    try {
      const passwordCifrada = this.encryption.encrypt(password);
      const { error } = await this.supabase
        .getAdminClient()
        .from('usuarios')
        .update({ password_cifrada: passwordCifrada })
        .eq('id', userId);

      if (error) {
        this.logger.warn(
          `No se pudo guardar la contraseña cifrada de ${userId}: ${error.message}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo cifrar la contraseña de ${userId}: ${(error as Error).message}`,
      );
    }
  }

  /** Lee y descifra la contraseña guardada; `null` si no existe o no se puede descifrar. */
  private async getStoredPassword(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('usuarios')
      .select('password_cifrada')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      this.logger.warn(
        `No se pudo leer la contraseña cifrada de ${userId}: ${error.message}`,
      );
      return null;
    }

    const encrypted = (data as { password_cifrada?: string | null } | null)
      ?.password_cifrada;
    if (!encrypted) return null;

    try {
      return this.encryption.decrypt(encrypted);
    } catch (error) {
      this.logger.error(
        `No se pudo descifrar la contraseña de ${userId}: ${(error as Error).message}`,
      );
      return null;
    }
  }
}