export interface FindAllUsersParams {
  busqueda?: string;
  rol?: string;
  activo?: boolean;
  orden?: string;
  pagina: number;
  porPagina: number;
}