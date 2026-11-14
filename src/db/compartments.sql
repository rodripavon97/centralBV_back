-- ============================================================
-- US17 · Compartimentos ("buches") de cada móvil
-- Correr DESPUÉS de fleet.sql. Idempotente: se puede volver a correr.
-- ============================================================

-- Zona del móvil donde está el compartimento (plano de Figma · S5 Buches)
DO $$
BEGIN
  CREATE TYPE public.zona_compartimento AS ENUM (
    'LADO_CONDUCTOR',
    'LADO_ACOMPANANTE',
    'TRASERO',
    'TECHO',
    'CABINA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Estado del compartimento (los 4 de Figma · S5 Buches). Mientras no haya
-- materiales se cambia a mano; no afecta el estado del móvil.
DO $$
BEGIN
  CREATE TYPE public.estado_compartimento AS ENUM (
    'OPERATIVO',
    'OBSERVACIONES',
    'DANADO',
    'FUERA_DE_USO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Para bases donde el tipo ya se creó con 3 estados (primera versión de US17).
ALTER TYPE public.estado_compartimento ADD VALUE IF NOT EXISTS 'DANADO' BEFORE 'FUERA_DE_USO';

-- ------------------------------------------------------------
-- compartimentos_vehiculo
-- orden: posición dentro de su zona (automática, la pone el back).
-- Cuando exista la tabla de materiales, su FK a esta tabla va con
-- ON DELETE RESTRICT: así no se puede borrar un compartimento con
-- materiales asignados (criterio 3 de la US17).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compartimentos_vehiculo (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehiculo_id     UUID NOT NULL
    REFERENCES public.vehiculos_emergencia(id) ON DELETE CASCADE,
  zona            public.zona_compartimento NOT NULL,
  nombre          TEXT NOT NULL,
  orden           INTEGER NOT NULL DEFAULT 1,
  estado          public.estado_compartimento NOT NULL DEFAULT 'OPERATIVO',
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT compartimentos_vehiculo_nombre_check
    CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 20),
  CONSTRAINT compartimentos_vehiculo_orden_check
    CHECK (orden >= 1)
);

-- Nombre único por móvil, sin distinguir mayúsculas
CREATE UNIQUE INDEX IF NOT EXISTS compartimentos_vehiculo_nombre_unico
  ON public.compartimentos_vehiculo (vehiculo_id, lower(nombre));

CREATE INDEX IF NOT EXISTS idx_compartimentos_vehiculo_orden
  ON public.compartimentos_vehiculo (vehiculo_id, zona, orden);

COMMENT ON TABLE public.compartimentos_vehiculo IS
  'Compartimentos ("buches") de cada vehículo de emergencia (US17)';

-- Seguridad: solo el backend accede, con la service role.
ALTER TABLE public.compartimentos_vehiculo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compartimentos_vehiculo FROM anon, authenticated;
