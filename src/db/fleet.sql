-- ============================================================
-- CentralBV API - Flota de vehículos de emergencia
-- Es idempotente: podés re-ejecutarlo sin romper nada.
-- IDs UUID (alineado a usuarios/roles/constancias).
-- Si las tablas existían con SERIAL, se recrean (re-seed al boot).
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.estado_vehiculo_emergencia AS ENUM (
    'OPERATIVO',
    'MANTENIMIENTO',
    'OBSERVACIONES',
    'FUERA_SERVICIO',
    'BAJA_DEFINITIVA'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Recrear si el PK aún es entero (migración SERIAL → UUID)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tipos_vehiculo'
      AND column_name = 'id'
      AND data_type = 'integer'
  ) THEN
    DROP VIEW IF EXISTS public.vehiculos_emergencia_listado;
    DROP TABLE IF EXISTS public.vehiculos_emergencia CASCADE;
    DROP TABLE IF EXISTS public.modelos_vehiculo CASCADE;
    DROP TABLE IF EXISTS public.marcas_vehiculo CASCADE;
    DROP TABLE IF EXISTS public.tipos_vehiculo CASCADE;
  END IF;
END $$;

-- ------------------------------------------------------------
-- tipos_vehiculo (catálogo)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tipos_vehiculo (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  valor      TEXT NOT NULL UNIQUE,
  activo     BOOLEAN NOT NULL DEFAULT true,
  creado_en  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tipos_vehiculo_activo
  ON public.tipos_vehiculo(activo);

-- ------------------------------------------------------------
-- marcas_vehiculo (catálogo)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marcas_vehiculo (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  valor      TEXT NOT NULL UNIQUE,
  activo     BOOLEAN NOT NULL DEFAULT true,
  creado_en  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marcas_vehiculo_activo
  ON public.marcas_vehiculo(activo);

-- ------------------------------------------------------------
-- modelos_vehiculo (catálogo; pertenece a una marca)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.modelos_vehiculo (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  valor      TEXT NOT NULL,
  marca_id   UUID NOT NULL REFERENCES public.marcas_vehiculo(id) ON DELETE RESTRICT,
  activo     BOOLEAN NOT NULL DEFAULT true,
  creado_en  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (marca_id, valor)
);

CREATE INDEX IF NOT EXISTS idx_modelos_vehiculo_activo
  ON public.modelos_vehiculo(activo);

CREATE INDEX IF NOT EXISTS idx_modelos_vehiculo_marca
  ON public.modelos_vehiculo(marca_id);

-- ------------------------------------------------------------
-- vehiculos_emergencia
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehiculos_emergencia (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estado        public.estado_vehiculo_emergencia NOT NULL DEFAULT 'OPERATIVO',
  patente       TEXT NOT NULL UNIQUE,
  denominacion  TEXT NOT NULL,
  tipo_id       UUID NOT NULL REFERENCES public.tipos_vehiculo(id) ON DELETE RESTRICT,
  marca_id      UUID NOT NULL REFERENCES public.marcas_vehiculo(id) ON DELETE RESTRICT,
  modelo_id     UUID NOT NULL REFERENCES public.modelos_vehiculo(id) ON DELETE RESTRICT,
  motivo_baja   TEXT,
  creado_en     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vehiculos_emergencia
  ADD COLUMN IF NOT EXISTS motivo_baja TEXT;

-- ------------------------------------------------------------
-- US04 · Patentes normalizadas
-- Forma canónica: solo mayúsculas y dígitos ("AB 123 CD" → "AB123CD").
-- Las reglas están en src/fleet/domain/license-plate.ts. El UNIQUE de
-- patente pasa a proteger la forma canónica.
-- ------------------------------------------------------------
DO $$
DECLARE
  duplicadas TEXT;
BEGIN
  SELECT string_agg(canonica, ', ')
    INTO duplicadas
  FROM (
    SELECT upper(regexp_replace(patente, '[^A-Za-z0-9]', '', 'g')) AS canonica
    FROM public.vehiculos_emergencia
    GROUP BY 1
    HAVING count(*) > 1
  ) d;

  IF duplicadas IS NOT NULL THEN
    RAISE EXCEPTION 'Estas patentes quedan duplicadas al normalizarlas: %. Corregilas a mano y volvé a ejecutar el script.', duplicadas;
  END IF;

  UPDATE public.vehiculos_emergencia
     SET patente = upper(regexp_replace(patente, '[^A-Za-z0-9]', '', 'g'))
   WHERE patente <> upper(regexp_replace(patente, '[^A-Za-z0-9]', '', 'g'));
END $$;

DO $$ BEGIN
  ALTER TABLE public.vehiculos_emergencia
    ADD CONSTRAINT vehiculos_emergencia_patente_canonica
    CHECK (patente ~ '^[A-Z0-9]{2,12}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- US04 · Denominación normalizada y única entre móviles activos
-- Se guarda en mayúsculas; letras + número queda "M-1" (ver
-- src/fleet/domain/denomination.ts). La clave sin separadores
-- (denominacion_clave) hace que "M-1" y "M1" choquen.
-- ------------------------------------------------------------
UPDATE public.vehiculos_emergencia
   SET denominacion = regexp_replace(
         upper(btrim(regexp_replace(denominacion, '\s+', ' ', 'g'))),
         '^([A-Z]+)[ ._-]*([0-9]+)$',
         '\1-\2'
       )
 WHERE denominacion <> regexp_replace(
         upper(btrim(regexp_replace(denominacion, '\s+', ' ', 'g'))),
         '^([A-Z]+)[ ._-]*([0-9]+)$',
         '\1-\2'
       );

ALTER TABLE public.vehiculos_emergencia
  ADD COLUMN IF NOT EXISTS denominacion_clave TEXT
  GENERATED ALWAYS AS (
    regexp_replace(upper(denominacion), '[^A-Z0-9]', '', 'g')
  ) STORED;

DO $$
DECLARE
  duplicadas TEXT;
BEGIN
  SELECT string_agg(denominacion_clave, ', ')
    INTO duplicadas
  FROM (
    SELECT denominacion_clave
    FROM public.vehiculos_emergencia
    WHERE estado <> 'BAJA_DEFINITIVA'
    GROUP BY 1
    HAVING count(*) > 1
  ) d;

  IF duplicadas IS NOT NULL THEN
    RAISE EXCEPTION 'Hay móviles activos con la misma denominación: %. Corregilas a mano y volvé a ejecutar el script.', duplicadas;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehiculos_emergencia_denominacion_activa
  ON public.vehiculos_emergencia(denominacion_clave)
  WHERE estado <> 'BAJA_DEFINITIVA';

-- ------------------------------------------------------------
-- US45 / US46 · Nombres de catálogo únicos sin importar mayúsculas
-- ("ford" y "Ford" son la misma marca). Si ya hay repetidos, avisa y
-- sigue: el back igual los rechaza al crear o renombrar.
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_vehiculo_valor_ci
    ON public.tipos_vehiculo (lower(valor));
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Hay tipos de vehículo repetidos (sin importar mayúsculas); no se creó idx_tipos_vehiculo_valor_ci';
END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS idx_marcas_vehiculo_valor_ci
    ON public.marcas_vehiculo (lower(valor));
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Hay marcas repetidas (sin importar mayúsculas); no se creó idx_marcas_vehiculo_valor_ci';
END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS idx_modelos_vehiculo_valor_ci
    ON public.modelos_vehiculo (marca_id, lower(valor));
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Hay modelos repetidos en una marca (sin importar mayúsculas); no se creó idx_modelos_vehiculo_valor_ci';
END $$;

CREATE INDEX IF NOT EXISTS idx_vehiculos_emergencia_tipo
  ON public.vehiculos_emergencia(tipo_id);

CREATE INDEX IF NOT EXISTS idx_vehiculos_emergencia_marca
  ON public.vehiculos_emergencia(marca_id);

CREATE INDEX IF NOT EXISTS idx_vehiculos_emergencia_modelo
  ON public.vehiculos_emergencia(modelo_id);

CREATE INDEX IF NOT EXISTS idx_vehiculos_emergencia_estado
  ON public.vehiculos_emergencia(estado);

COMMENT ON TABLE public.tipos_vehiculo IS 'Catálogo de tipos de vehículo de emergencia (soft-delete vía activo)';
COMMENT ON TABLE public.marcas_vehiculo IS 'Catálogo de marcas de vehículo (soft-delete vía activo)';
COMMENT ON TABLE public.modelos_vehiculo IS 'Catálogo de modelos por marca (soft-delete vía activo)';
COMMENT ON TABLE public.vehiculos_emergencia IS 'Vehículos de emergencia de la flota';

-- ------------------------------------------------------------
-- Vista para listado/detalle: vehículo + catálogos (tipo/marca/modelo)
-- ------------------------------------------------------------
DROP VIEW IF EXISTS public.vehiculos_emergencia_listado;

CREATE VIEW public.vehiculos_emergencia_listado
WITH (security_invoker = true) AS
SELECT
  v.id,
  v.estado,
  v.patente,
  v.denominacion,
  v.motivo_baja,
  v.creado_en,
  v.tipo_id,
  t.valor AS tipo_valor,
  v.marca_id,
  m.valor AS marca_valor,
  v.modelo_id,
  mo.valor AS modelo_valor
FROM public.vehiculos_emergencia v
JOIN public.tipos_vehiculo t ON t.id = v.tipo_id
JOIN public.marcas_vehiculo m ON m.id = v.marca_id
JOIN public.modelos_vehiculo mo ON mo.id = v.modelo_id;

COMMENT ON VIEW public.vehiculos_emergencia_listado IS 'Vehículos de emergencia con datos de tipo, marca y modelo';

-- ------------------------------------------------------------
-- Seguridad: solo el backend accede, con la service role (que no pasa por
-- RLS). Sin políticas, anon y authenticated no pueden leer ni escribir.
-- ------------------------------------------------------------
ALTER TABLE public.tipos_vehiculo       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marcas_vehiculo      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos_vehiculo     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos_emergencia ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tipos_vehiculo               FROM anon, authenticated;
REVOKE ALL ON public.marcas_vehiculo              FROM anon, authenticated;
REVOKE ALL ON public.modelos_vehiculo             FROM anon, authenticated;
REVOKE ALL ON public.vehiculos_emergencia         FROM anon, authenticated;
REVOKE ALL ON public.vehiculos_emergencia_listado FROM anon, authenticated;
