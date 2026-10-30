import {
  Injectable,
  Inject,
  UnauthorizedException,
  Logger,
  BadRequestException, // <-- 1. Agregado Logger
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  USER_REPOSITORY,
} from '../users/domain/user.repository.js';
import type { UserRepository } from '../users/domain/user.repository.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { LoginDto } from './dtos/login.dto.js';
import { SupabaseUserRoleResponse } from './response/supabaseUserResponse.response.js';
import { MailService } from '../mail/mail.service.js';
import { ForgotPasswordDto } from './dtos/forgotPassword.dto.js';
import { ResetPasswordDto } from './dtos/resetPassword.dto.js';



@Injectable()
export class AuthService {
  // 3. Instanciamos el Logger
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService, // <-- 2. Inyectamos MailService
  ) { }

  async login(dto: LoginDto) {
    // Validate credentials with Supabase Auth
    const { data: authData, error } = await this.supabase
      .getClient()
      .auth.signInWithPassword({ email: dto.email, password: dto.password });

    // Exact message if credentials fail
    if (error || !authData.user) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    // If the admin has deactivated the user, we block access
    if (!user.activo) {
      throw new UnauthorizedException('Su cuenta ha sido desactivada. Contacte al administrador.');
    }

    // ==========================================
    // 4. REEMPLAZADO: Nuevo bloque para obtener roles
    // ==========================================
    const { data: rolesData, error: rolesError } = await this.supabase
      .getAdminClient()
      .from('usuario_rol')
      .select(`
        rol_id,
        roles:rol_id (nombre)
      `)
      .eq('usuario_id', user.id) as { data: SupabaseUserRoleResponse[] | null, error: any };

    if (rolesError) {
      this.logger.error(`Error al obtener roles: ${rolesError.message}`);
    }

    const roles = rolesData?.map((r) => r.roles?.nombre).filter((nombre): nombre is string => !!nombre) || [];
    // ==========================================

    const payload = { sub: user.id, email: user.email, roles };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        roles,
      },
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const adminDb = this.supabase.getAdminClient();

    try {
      // Buscamos si el usuario existe para obtener su nombre y personalizar el correo
      const user = await this.userRepo.findByEmail(dto.email);

      // Generamos el link de recuperación
      const { data, error } = await adminDb.auth.admin.generateLink({
        type: 'recovery',
        email: dto.email,
        options: {
          // Esta URL es a donde irá el usuario cuando haga clic en el correo.
          // Debe ser la ruta de tu Frontend que reciba el token.
          redirectTo: 'http://localhost:3000/update-password',
        },
      });

      // Si hay error o no existe, fingimos demencia por seguridad (evitar enumeración de usuarios)
      if (error || !data.properties?.action_link || !user) {
        this.logger.warn(`Intento de recuperación fallido o usuario inexistente: ${dto.email}`);
        return { message: 'Si el correo está registrado, recibirás un enlace en breve.' };
      }

      // Enviamos el correo con nuestro template y MailService
      this.mailService.sendRecoveryEmail(user.email, user.nombre, data.properties.action_link);

      return { message: 'Si el correo está registrado, recibirás un enlace en breve.' };
    } catch (error) {
      this.logger.error(`Error en forgotPassword: ${(error as Error).message}`);
      return { message: 'Si el correo está registrado, recibirás un enlace en breve.' };
    }
  }

    async resetPassword(dto: ResetPasswordDto) {
    // 1. Validar que las contraseñas coincidan
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Las contraseñas no coinciden. Por favor, verifícalas.');
    }

    // 2. Validar el JWT con Supabase
    const { data: { user }, error: authError } = await this.supabase
      .getClient()
      .auth.getUser(dto.token);

    if (authError || !user) {
      this.logger.error(`Error getUser: ${authError?.message}`);
      throw new BadRequestException('El enlace ha expirado o ya fue utilizado. Por favor, solicita uno nuevo.');
    }

    // 3. Actualizar la contraseña en Supabase Auth
    const { error: updateError } = await this.supabase
      .getAdminClient()
      .auth.admin.updateUserById(user.id, {
        password: dto.newPassword,
      });

    // 4. Manejo de errores
    if (updateError) {
      this.logger.error(`Error actualizando contraseña: ${updateError.message}`);
      
      if (updateError.message.includes('different from the old password')) {
        throw new BadRequestException('La contraseña nueva no puede ser igual a la anterior.');
      }
      
      throw new BadRequestException('No se pudo actualizar la contraseña.');
    }

    // 5. Retorno exitoso
    return {
      message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva clave.',
    };
  }
}