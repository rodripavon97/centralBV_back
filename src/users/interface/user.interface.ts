export interface SupabaseRoleResponse {
  nombre: string;
}

export interface SupabaseUsuarioRolResponse {
  roles: SupabaseRoleResponse | null;
}

export interface SupabaseUserResponse {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  google_sub: string | null;
  usuario_rol: SupabaseUsuarioRolResponse[];
}