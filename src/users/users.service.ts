import {
  Injectable,
  Inject,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { USER_REPOSITORY} from './domain/user.repository.js';
import type { UserRepository } from './domain/user.repository.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateUserDto } from './dtos/create-user.dto.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly supabase: SupabaseService,
  ) {}

  async createUser(dto: CreateUserDto) {
    const db = this.supabase.getAdminClient();

    // Check if the email address already exists (Acceptance criterion)
    const existingUser = await this.userRepo.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado en el sistema');
    }

    try {
      // Create the user in Supabase Auth
      const { data: authData, error: authError } = await db.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
      });

      if (authError) {
        throw new InternalServerErrorException('Error al crear credenciales: ' + authError.message);
      }

      const userId = authData.user.id;

      // 3. Insert the user into the public.usuarios table
      await this.userRepo.create({
        id: userId,
        email: dto.email,
        nombre: dto.nombre,
        apellido: dto.apellido,
        activo: true, // Ahora el admin lo crea activo directamente
      });

      // 4. Search for the role ID based on the provided role name
      const { data: roleData, error: roleError } = await db
        .from('roles')
        .select('id')
        .eq('nombre', dto.roleName.toUpperCase())
        .single();

      if (roleError || !roleData) {
        throw new NotFoundException(`El rol '${dto.roleName}' no existe en el sistema`);
      }

      // 5. Assign the role to the user in the usuario_rol table
      await db.from('usuario_rol').insert([{ usuario_id: userId, rol_id: roleData.id }]);

      // 6. WELCOME EMAIL SIMULATION (See note below)
      // In production, you would call a MailService or the Supabase endpoint here
      this.logger.log(`[EMAIL] Enviando correo de bienvenida a ${dto.email} con contraseña temporal.`);

      return {
        message: 'Usuario creado exitosamente y correo de bienvenida enviado',
        userId: userId,
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error creando usuario: ${errorMessage}`);
      throw new InternalServerErrorException('Error interno al crear el usuario');
    }
  }

  async getPendingUsers() {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('usuarios')
      .select('*')
      .eq('activo', false);

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async approveUser(id: string) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const { data, error } = await this.supabase
      .getAdminClient()
      .from('usuarios')
      .update({ activo: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return { message: 'Usuario aprobado exitosamente', user: data };
  }
}