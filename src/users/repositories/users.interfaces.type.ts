/**
 * Forma cruda que devuelve Supabase al consultar un usuario
 * (incluye el join de roles ya aplanado en el select).
 */
export interface UserRow {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  // Si el select hace un join, Supabase devuelve array de objetos.
  // Ajusta según tu query real:
  roles: Array<{ roles: { nombre: string } | null }>;
}