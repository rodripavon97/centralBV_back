import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  USER_REPOSITORY,
} from '../users/domain/user.repository.js';
import type { UserRepository } from '../users/domain/user.repository.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { LoginDto } from './dtos/login.dto.js';


@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
  ) {}

    async login(dto: LoginDto) {
    //Validate credentials with Supabase Auth
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

    //If the admin has deactivated the user, we block access
    if (!user.activo) {
      throw new UnauthorizedException('Su cuenta ha sido desactivada. Contacte al administrador.');
    }

    // Get roles
    const { data: rolesData } = await this.supabase
      .getAdminClient()
      .from('usuario_rol')
      .select('roles(nombre)')
      .eq('usuario_id', user.id);

    const roles = rolesData?.map((r: any) => r.roles.nombre) || [];
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
}