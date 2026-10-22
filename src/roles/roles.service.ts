import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class RolesService {
  constructor(private readonly supabase: SupabaseService) {}

  async assignRole(usuario_id: string, rol_id: string) {
    const db = this.supabase.getAdminClient();

    const { data: user } = await db
      .from('usuarios')
      .select('id')
      .eq('id', usuario_id)
      .single();
    if (!user) throw new NotFoundException('El usuario especificado no existe');

    const { data: role } = await db
      .from('roles')
      .select('id')
      .eq('id', rol_id)
      .single();
    if (!role) throw new NotFoundException('El rol especificado no existe');

    const { error } = await db
      .from('usuario_rol')
      .insert([{ usuario_id, rol_id }]);

    if (error) {
      if (error.code === '23505')
        throw new ConflictException('El usuario ya tiene asignado este rol');
      throw new Error(error.message);
    }

    return { message: 'Rol asignado correctamente' };
  }
}