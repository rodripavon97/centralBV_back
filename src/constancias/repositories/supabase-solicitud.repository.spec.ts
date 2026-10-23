import { filtroBusqueda } from './supabase-solicitud.repository.js';

describe('filtroBusqueda (US09)', () => {
  it('busca por DNI y número cuando se escriben solo dígitos, con o sin puntos', () => {
    expect(filtroBusqueda('30.112.456')).toBe('dni.ilike."%30112456%",numero.ilike."%30112456%"');
  });

  it('busca por número y por nombre en los dos órdenes', () => {
    expect(filtroBusqueda('Lucía Fer')).toBe(
      'numero.ilike."%Lucía Fer%",nombre_completo.ilike."%Lucía Fer%",apellido_nombre.ilike."%Lucía Fer%"',
    );
  });

  it('quita comillas y comodines para no romper el filtro de PostgREST', () => {
    expect(filtroBusqueda('"%*')).toBeNull();
    expect(filtroBusqueda('SOL-"0001"')).toContain('numero.ilike."%SOL-0001%"');
  });
});
