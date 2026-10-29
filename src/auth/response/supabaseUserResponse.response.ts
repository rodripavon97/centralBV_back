export interface SupabaseUserRoleResponse {
  rol_id: string;
  roles: {
    nombre: string;
  } | null;
}