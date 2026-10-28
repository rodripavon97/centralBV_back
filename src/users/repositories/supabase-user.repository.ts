import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { UserRepository } from '../domain/user.repository.js';
import { User } from '../domain/user.entity.js';
import { SupabaseUserResponse } from '../interface/user.interface.js';
import { paginationRange } from '../../common/utils/pagination.utils.js';
import { throwMappedSupabaseError } from '../../supabase/supabase-error.js';
import { FindAllUsersParams } from '../interface/params.interface.js';
import { UserRow } from '../interface/userRow.interface.js';

@Injectable()
export class SupabaseUserRepository implements UserRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.getAdminClient();
  }

  async create(data: Partial<User>): Promise<User> {
    const { data: newUser, error } = await this.db
      .from('usuarios')
      .insert([data])
      .select(`*, usuario_rol ( roles ( nombre ) )`)
      .single();

    if (error) throwMappedSupabaseError(error);
    return this.toUser(newUser as SupabaseUserResponse);
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.db
      .from('usuarios')
      .select(`*, usuario_rol ( roles ( nombre ) )`)
      .eq('email', email)
      .maybeSingle();

    if (error) throwMappedSupabaseError(error);
    return data ? this.toUser(data as SupabaseUserResponse) : null;
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.db
      .from('usuarios')
      .select(`*, usuario_rol ( roles ( nombre ) )`)
      .eq('id', id)
      .maybeSingle();

    if (error) throwMappedSupabaseError(error);
    return data ? this.toUser(data as SupabaseUserResponse) : null;
  }

  async findAll(params: FindAllUsersParams): Promise<{ items: User[]; total: number }> {
    return this.listFromTable(params);
  }

  private async listFromTable(params: FindAllUsersParams): Promise<{ items: User[]; total: number }> {
    const { busqueda, rol, activo, orden, pagina, porPagina } = params;

    // Sin filtro de rol usamos LEFT JOIN para que también aparezcan los
    // usuarios sin roles (el admin necesita verlos para asignarles uno).
    // Al filtrar por rol necesitamos INNER para descartar a los que no lo tienen.
    const rolesRelation = rol
      ? 'usuario_rol!inner ( roles!inner ( nombre ) )'
      : 'usuario_rol ( roles ( nombre ) )';

    // Función interna para reutilizar la lógica de filtros (igual que el `query` en constancias)
    const buildQuery = (columns: string, selectOptions?: { count: 'exact'; head?: boolean }) => {
      let q = this.db.from('usuarios').select(columns, selectOptions);
      
      // Excluir al usuario admin
      q = q.neq('email', 'admin@centralbv.com'); 

      if (busqueda) {
        q = q.or(`nombre.ilike.%${busqueda}%,apellido.ilike.%${busqueda}%,email.ilike.%${busqueda}%`);
      }
      if (rol) {
        q = q.eq('usuario_rol.roles.nombre', rol.toUpperCase());
      }
      if (activo !== undefined) {
        q = q.eq('activo', activo);
      }

      return q;
    };

    // 3. Primero contamos (para no pedir rangos fuera de la última página)
    const { count, error: countError } = await buildQuery(`id, ${rolesRelation}`, {
      count: 'exact',
      head: true,
    });
    
    if (countError) throwMappedSupabaseError(countError);
    const total = count ?? 0;
    if (total === 0) return { items: [], total };

    // 4. Calculamos el rango usando tu utilidad
    const { from, to } = paginationRange(pagina, porPagina, total);

    // 5. Consultamos los datos reales con paginación y orden
    let dataQuery = buildQuery(`*, ${rolesRelation}`);
    
    if (orden) {
      const [columna, direccion] = orden.split('.');
      dataQuery = dataQuery.order(columna, { ascending: direccion === 'asc' });
    } else {
      dataQuery = dataQuery.order('creado_en', { ascending: false });
    }

    const { data, error } = await dataQuery.range(from, to);
    if (error) throwMappedSupabaseError(error);

    return {
      items: (data as unknown as UserRow[]).map((row) => this.toUser(row)),
      total,
    };
  }

  /** Mapea la fila de Supabase a la Entidad de Dominio User */
  private toUser(row: SupabaseUserResponse): User {
    const roles = row.usuario_rol
      ?.map((ur) => ur.roles?.nombre)
      .filter((nombre): nombre is string => !!nombre) || [];

    return new User(
      row.id,
      row.email,
      row.nombre,
      row.apellido,
      row.activo,
      row.google_sub ?? undefined,
      roles,
    );
  }
}