-- ============================================================
-- CentralBV API - Schema base
-- Ejecutar en Supabase → SQL Editor (una sola vez al inicio)
-- Es idempotente: podés re-ejecutarlo sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
-- roles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT UNIQUE NOT NULL,
  descripcion TEXT,
  creado_en   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------
-- usuarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuarios (
  id          UUID PRIMARY KEY,
  google_sub  TEXT UNIQUE,
  email       TEXT UNIQUE NOT NULL,
  nombre      TEXT NOT NULL,
  apellido    TEXT NOT NULL,
  activo      BOOLEAN DEFAULT false,
  creado_en   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS password_cifrada TEXT;

-- ------------------------------------------------------------
-- usuario_rol (N:M)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuario_rol (
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
  rol_id     UUID REFERENCES public.roles(id)    ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, rol_id)
);

-- ------------------------------------------------------------
-- Índices auxiliares
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_usuarios_activo
  ON public.usuarios(activo);

CREATE INDEX IF NOT EXISTS idx_usuario_rol_rol
  ON public.usuario_rol(rol_id);

-- ------------------------------------------------------------
-- Comentarios (opcional, ayuda a documentar en el dashboard)
-- ------------------------------------------------------------
COMMENT ON TABLE public.usuarios    IS 'Usuarios registrados (activo=false = pendiente de aprobación)';
COMMENT ON TABLE public.roles       IS 'Catálogo de roles del sistema';
COMMENT ON TABLE public.usuario_rol IS 'Relación N:M entre usuarios y roles';