-- ============================================================
-- CentralBV API - Constancias de actuación (M4 · Solicitudes 1/2)
-- Basado en el DER propuesto (Figma "03 · DER") con ajustes para
-- US08 (alta), US09 (listado y búsqueda) y US13 (editar y cancelar).
-- Aplicado en Supabase como migración "constancias_m4_solicitudes".
-- Es idempotente: podés re-ejecutarlo sin romper nada.
--
-- Ajustes respecto del DER:
--   * estado suma PENDIENTE (solicitud cargada, sin constancia) y CANCELADA.
--     Flujo: PENDIENTE → REALIZADA → FIRMADA → RETIRADA, o PENDIENTE → CANCELADA.
--   * tipo_constancia suma ACCIDENTE_TRANSITO (lo usan las pantallas del M4).
--   * descripcion, motivo_cancelacion, cancelado_en y actualizado_en son nuevos.
--   * Los datos que se completan al generar la constancia (US10) quedan NULL
--     por ahora: parte_numero, localidad, partido, motivo, perdidas, destino,
--     numero_poliza y patente_vehiculo (la FK a vehiculos llega con US10).
--   * damnificados.domicilio es opcional (criterio de T17).
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.tipo_constancia AS ENUM ('VEHICULAR', 'VIVIENDA', 'ACCIDENTE_TRANSITO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.destino_constancia AS ENUM ('SEGURO', 'ACCION_SOCIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.estado_constancia AS ENUM ('PENDIENTE', 'REALIZADA', 'FIRMADA', 'RETIRADA', 'CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.estado_arancel AS ENUM ('PENDIENTE', 'ABONADO', 'EXENTO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.metodo_pago AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- damnificados (el DNI se indexa pero no se asume único)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.damnificados (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dni        TEXT NOT NULL CHECK (dni ~ '^[0-9]{7,8}$'),
  nombre     TEXT NOT NULL,
  apellido   TEXT NOT NULL,
  telefono   TEXT,
  domicilio  TEXT,
  creado_en  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_damnificados_dni ON public.damnificados(dni);

-- ------------------------------------------------------------
-- constancias (cada fila nace como solicitud PENDIENTE)
-- ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.constancias_numero_seq;

CREATE TABLE IF NOT EXISTS public.constancias (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero             TEXT UNIQUE NOT NULL
                     DEFAULT 'SOL-' || lpad(nextval('public.constancias_numero_seq')::text, 4, '0'),
  damnificado_id     UUID NOT NULL REFERENCES public.damnificados(id) ON DELETE RESTRICT,
  creado_por         UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,

  -- Datos del siniestro (US08)
  tipo_constancia    public.tipo_constancia NOT NULL,
  fecha_actuacion    DATE NOT NULL,
  hora_actuacion     TIME NOT NULL,
  domicilio_hecho    TEXT NOT NULL,
  descripcion        TEXT NOT NULL,

  -- Datos de la constancia (se completan en US10)
  parte_numero       TEXT,
  localidad          TEXT,
  partido            TEXT,
  motivo             TEXT,
  perdidas           TEXT,
  destino            public.destino_constancia,
  numero_poliza      TEXT,
  patente_vehiculo   TEXT,

  estado             public.estado_constancia NOT NULL DEFAULT 'PENDIENTE',
  estado_arancel     public.estado_arancel NOT NULL DEFAULT 'PENDIENTE',
  monto              NUMERIC(12, 2),
  metodo_pago        public.metodo_pago,
  motivo_exento      TEXT,
  fecha_pago         TIMESTAMP WITH TIME ZONE,
  motivo_cancelacion TEXT,

  creado_en          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  actualizado_en     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  firmado_en         TIMESTAMP WITH TIME ZONE,
  retirado_en        TIMESTAMP WITH TIME ZONE,
  retirado_por_nombre TEXT,
  retirado_por_dni   TEXT CHECK (retirado_por_dni IS NULL OR retirado_por_dni ~ '^[0-9]{7,8}$'),
  cancelado_en       TIMESTAMP WITH TIME ZONE,

  -- RN/01: la póliza solo aplica a constancias para un seguro
  CONSTRAINT poliza_segun_destino
    CHECK (destino IS DISTINCT FROM 'ACCION_SOCIAL' OR numero_poliza IS NULL),
  -- RN/02: solo se retira con el arancel abonado o exento
  CONSTRAINT retiro_con_arancel
    CHECK (estado <> 'RETIRADA' OR estado_arancel IN ('ABONADO', 'EXENTO')),
  -- US13: toda cancelación registra su motivo
  CONSTRAINT cancelacion_con_motivo
    CHECK (estado <> 'CANCELADA' OR (cancelado_en IS NOT NULL AND coalesce(length(trim(motivo_cancelacion)), 0) > 0)),
  -- EXENTO: motivo y sin monto/método; ABONADO: monto > 0 y método
  CONSTRAINT exento_con_motivo
    CHECK (estado_arancel <> 'EXENTO' OR (
      coalesce(length(trim(motivo_exento)), 0) > 0
      AND monto IS NULL
      AND metodo_pago IS NULL
    )),
  CONSTRAINT abonado_con_monto
    CHECK (estado_arancel <> 'ABONADO' OR (
      monto IS NOT NULL AND monto > 0 AND metodo_pago IS NOT NULL
    ))
);

-- Idempotente si la tabla ya existía sin columnas de abono / retiro
ALTER TABLE public.constancias ADD COLUMN IF NOT EXISTS monto NUMERIC(12, 2);
ALTER TABLE public.constancias ADD COLUMN IF NOT EXISTS metodo_pago public.metodo_pago;
ALTER TABLE public.constancias ADD COLUMN IF NOT EXISTS motivo_exento TEXT;
ALTER TABLE public.constancias ADD COLUMN IF NOT EXISTS fecha_pago TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.constancias ADD COLUMN IF NOT EXISTS retirado_por_nombre TEXT;
ALTER TABLE public.constancias ADD COLUMN IF NOT EXISTS retirado_por_dni TEXT;

-- Compatibilidad: EXENTO antes guardaba monto 0
UPDATE public.constancias
SET monto = NULL, metodo_pago = NULL
WHERE estado_arancel = 'EXENTO';

ALTER TABLE public.constancias DROP CONSTRAINT IF EXISTS exento_con_motivo;
ALTER TABLE public.constancias DROP CONSTRAINT IF EXISTS abonado_con_monto;

ALTER TABLE public.constancias ADD CONSTRAINT exento_con_motivo
  CHECK (estado_arancel <> 'EXENTO' OR (
    coalesce(length(trim(motivo_exento)), 0) > 0
    AND monto IS NULL
    AND metodo_pago IS NULL
  ));
ALTER TABLE public.constancias ADD CONSTRAINT abonado_con_monto
  CHECK (estado_arancel <> 'ABONADO' OR (
    monto IS NOT NULL AND monto > 0 AND metodo_pago IS NOT NULL
  ));

ALTER SEQUENCE public.constancias_numero_seq OWNED BY public.constancias.numero;

CREATE INDEX IF NOT EXISTS idx_constancias_estado ON public.constancias(estado);
CREATE INDEX IF NOT EXISTS idx_constancias_creado_en ON public.constancias(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_constancias_damnificado ON public.constancias(damnificado_id);

-- ------------------------------------------------------------
-- Vista para el listado (US09): permite buscar por número, DNI
-- o nombre del damnificado con un solo filtro.
-- ------------------------------------------------------------
DROP VIEW IF EXISTS public.solicitudes_listado;
CREATE VIEW public.solicitudes_listado
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.numero,
  c.estado,
  c.tipo_constancia,
  c.fecha_actuacion,
  c.hora_actuacion,
  c.domicilio_hecho,
  c.descripcion,
  c.estado_arancel,
  c.monto,
  c.metodo_pago,
  c.motivo_exento,
  c.fecha_pago,
  c.motivo_cancelacion,
  c.creado_en,
  c.cancelado_en,
  c.retirado_en,
  c.retirado_por_nombre,
  c.retirado_por_dni,
  d.id        AS damnificado_id,
  d.dni,
  d.nombre,
  d.apellido,
  d.telefono,
  d.domicilio,
  d.nombre || ' ' || d.apellido AS nombre_completo,
  d.apellido || ' ' || d.nombre AS apellido_nombre
FROM public.constancias c
JOIN public.damnificados d ON d.id = c.damnificado_id;

-- ------------------------------------------------------------
-- RLS: se accede solo desde el backend con la service role,
-- igual que usuarios, roles y usuario_rol.
-- ------------------------------------------------------------
ALTER TABLE public.damnificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constancias  ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.damnificados IS 'Personas afectadas por el siniestro (DNI no único)';
COMMENT ON TABLE public.constancias  IS 'Solicitudes y constancias de actuación (nace PENDIENTE)';
COMMENT ON VIEW  public.solicitudes_listado IS 'Constancias con datos del damnificado para el listado (US09)';
