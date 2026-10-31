import {
  Injectable,
  Inject,
  UnauthorizedException,
  Logger,
  BadRequestException, // <-- 1. Agregado Logger
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
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
    private readonly config: ConfigService,
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

  private static readonly GENERIC_RECOVERY_MESSAGE =
    'Si el correo está registrado, recibirás un enlace en breve.';

  async forgotPassword(dto: ForgotPasswordDto) {
    const genericResponse = { message: AuthService.GENERIC_RECOVERY_MESSAGE };
    const adminDb = this.supabase.getAdminClient();

    try {
      // Buscamos si el usuario existe para obtener su nombre y personalizar el correo
      const user = await this.userRepo.findByEmail(dto.email);

      // Si no existe, fingimos demencia por seguridad (evitar enumeración de usuarios)
      if (!user) {
        this.logger.warn(`Intento de recuperación para usuario inexistente: ${dto.email}`);
        return genericResponse;
      }

      // Generamos el link de recuperación. Supabase emite un token de un solo uso
      // y lo invalida al emitir otro; su vigencia se define en
      // Authentication > Providers > Email > Email OTP Expiration.
      const { data, error } = await adminDb.auth.admin.generateLink({
        type: 'recovery',
        email: dto.email,
        options: {
          // Ruta del frontend que recibe el token del correo.
          redirectTo: this.passwordResetRedirectUrl(),
        },
      });

      if (error || !data.properties?.action_link) {
        this.logger.error(
          `No se pudo generar el enlace de recuperación para ${dto.email}: ${
            error?.message ?? 'sin action_link'
          }`,
        );
        return genericResponse;
      }

      // Enviamos el correo con nuestro template y MailService
      await this.mailService.sendRecoveryEmail(
        user.email,
        user.nombre,
        data.properties.action_link,
      );

      return genericResponse;
    } catch (error) {
      this.logger.error(`Error en forgotPassword: ${(error as Error).message}`);
      return genericResponse;
    }
  }

  private passwordResetRedirectUrl(): string {
    return (
      this.config.get<string>('PASSWORD_RESET_REDIRECT_URL') ??
      'http://localhost:5173/update-password'
    );
  }

  private static readonly RECOVERY_AMR_METHODS = new Set(['recovery', 'otp', 'magiclink']);

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
      throw new BadRequestException(
        'El enlace ha expirado o ya fue utilizado. Por favor, solicita uno nuevo.',
      );
    }

    // 3. Solo aceptamos tokens emitidos por un enlace de recuperación.
    // Un access token de un login normal (amr: "password") no debe servir para
    // cambiar la contraseña sin conocer la actual.
    if (!this.isRecoveryToken(dto.token)) {
      this.logger.warn(`Intento de reset con token no recuperación: ${user.email}`);
      throw new BadRequestException(
        'El enlace ha expirado o ya fue utilizado. Por favor, solicita uno nuevo.',
      );
    }

    const adminDb = this.supabase.getAdminClient();

    // 4. Rechazar el reuso de la contraseña actual.
    // La API de administración de Supabase (updateUserById) no valida que la
    // contraseña nueva sea distinta de la anterior, por eso comprobamos
    // intentando iniciar sesión con la contraseña propuesta: si el login
    // funciona, es porque es la misma que ya tenía el usuario.
    await this.assertPasswordIsNew(user.email, dto.newPassword);

    // 5. Revocar todas las sesiones activas del usuario (incluida la del enlace).
    // Usamos el token de recuperación como JWT del usuario; debe hacerse antes
    // del update porque cambiar la contraseña invalida esa sesión.
    const { error: signOutError } = await adminDb.auth.admin.signOut(dto.token, 'global');

    if (signOutError) {
      // No bloqueamos el reset: updateUserById también revoca las sesiones.
      this.logger.warn(
        `No se pudieron revocar las sesiones de ${user.email}: ${signOutError.message}`,
      );
    }

    // 6. Actualizar la contraseña en Supabase Auth
    const { error: updateError } = await adminDb.auth.admin.updateUserById(user.id, {
      password: dto.newPassword,
    });

    // 7. Manejo de errores
    if (updateError) {
      this.logger.error(`Error actualizando contraseña: ${updateError.message}`);

      if (this.isSamePasswordError(updateError)) {
        throw new BadRequestException(
          AuthService.SAME_PASSWORD_MESSAGE,
        );
      }

      throw new BadRequestException('No se pudo actualizar la contraseña.');
    }

    // 8. Retorno exitoso
    return {
      message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva clave.',
    };
  }

  private static readonly SAME_PASSWORD_MESSAGE =
    'La contraseña nueva no puede ser igual a la anterior. Por favor, ingresa otra contraseña.';

  private isSamePasswordError(error: { code?: string; message?: string }): boolean {
    const message = (error.message ?? '').toLowerCase();
    return (
      error.code === 'same_password' ||
      message.includes('different from the old password') ||
      message.includes('same password')
    );
  }

  /**
   * Comprueba que la contraseña propuesta no sea la actual.
   *
   * Supabase solo valida el reuso en el endpoint de autoedición del usuario,
   * no en el de administración, que es el que usamos para el reset. Para
   * detectarlo iniciamos sesión con la contraseña propuesta: si funciona, la
   * contraseña es la misma. En ese caso cerramos la sesión recién creada.
   */
  private async assertPasswordIsNew(email: string | undefined, password: string): Promise<void> {
    if (!email) return;

    const { data, error } = await this.supabase
      .getClient()
      .auth.signInWithPassword({ email, password });

    // Si no se pudo iniciar sesión, la contraseña propuesta es distinta a la
    // actual (o no se pudo comprobar); el update de Supabase decidirá.
    if (error || !data.user) return;

    // La contraseña coincide con la actual: revocamos solo la sesión de prueba
    // para no cerrar las sesiones legítimas del usuario.
    if (data.session?.access_token) {
      const { error: probeSignOutError } = await this.supabase
        .getAdminClient()
        .auth.admin.signOut(data.session.access_token, 'local');

      if (probeSignOutError) {
        this.logger.warn(
          `No se pudo cerrar la sesión de verificación de ${email}: ${probeSignOutError.message}`,
        );
      }
    }

    throw new BadRequestException(AuthService.SAME_PASSWORD_MESSAGE);
  }

  /**
   * Indica si el access token fue emitido por un enlace de recuperación.
   * El token ya fue validado con Supabase (getUser), así que sus claims son
   * confiables; solo los decodificamos para leer `amr`.
   */
  private isRecoveryToken(token: string): boolean {
    const payload = this.jwtService.decode<{
      amr?: Array<{ method?: string } | string>;
    }>(token);

    if (!Array.isArray(payload?.amr)) return false;

    return payload.amr.some((entry) => {
      const method = typeof entry === 'string' ? entry : entry?.method;
      return !!method && AuthService.RECOVERY_AMR_METHODS.has(method);
    });
  }
}