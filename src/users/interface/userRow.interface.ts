interface UserRoleRow {
  roles: { nombre: string } | null;
}

export interface UserRow {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  google_sub: string | null;
  usuario_rol: UserRoleRow[];
}