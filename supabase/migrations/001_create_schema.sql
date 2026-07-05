-- =====================================================
-- DKP Inspections Database Schema
-- Идемпотентная версия: повторный прогон не падает.
-- RLS построена на SECURITY DEFINER функциях — политика,
-- которая делает EXISTS-подзапрос в свою же таблицу,
-- даёт infinite recursion (42P17).
-- =====================================================

-- Enum types (переживают wipe free-tier — оборачиваем)
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('sales', 'settlement', 'contractor', 'crm_loader', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE apartment_status AS ENUM (
    'pending_keys',
    'keys_unavailable',
    'keys_available',
    'assigned',
    'in_progress',
    'rejected',
    'completed',
    'uploaded_to_crm'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rejection_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role app_role NOT NULL DEFAULT 'sales',
  contractor_id UUID REFERENCES contractors(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  filename TEXT NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  imported_rows INT NOT NULL DEFAULT 0,
  skipped_rows INT NOT NULL DEFAULT 0,
  duplicate_rows INT NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- CRM data
  crm_code TEXT NOT NULL UNIQUE,
  project_name TEXT NOT NULL,
  project_id UUID REFERENCES projects(id),
  address TEXT NOT NULL,
  building_number TEXT,
  apartment_number TEXT NOT NULL,
  area_sqm DECIMAL(8,2),
  finish_type TEXT,
  ovp_status TEXT,

  -- Contract info
  client_name TEXT,
  contract_number TEXT,
  contract_date DATE,
  contract_amount DECIMAL(14,2),
  contract_expiry DATE,
  sale_scheme TEXT,
  object_state TEXT,

  -- Workflow
  status apartment_status NOT NULL DEFAULT 'pending_keys',
  contractor_id UUID REFERENCES contractors(id),

  -- Dates
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline DATE,
  keys_confirmed_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  uploaded_to_crm_at TIMESTAMPTZ,

  -- Keys & access
  keys_available BOOLEAN,
  rejection_reason_id UUID REFERENCES rejection_reasons(id),
  rejection_note TEXT,

  -- Report
  report_file_path TEXT,
  report_uploaded_at TIMESTAMPTZ,
  drive_file_url TEXT,

  -- Metadata
  import_batch_id UUID REFERENCES import_batches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id UUID NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  old_status apartment_status,
  new_status apartment_status NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_apartments_status ON apartments(status);
CREATE INDEX IF NOT EXISTS idx_apartments_contractor ON apartments(contractor_id);
CREATE INDEX IF NOT EXISTS idx_apartments_project ON apartments(project_id);
CREATE INDEX IF NOT EXISTS idx_apartments_crm_code ON apartments(crm_code);
CREATE INDEX IF NOT EXISTS idx_apartments_receipt_date ON apartments(receipt_date);
CREATE INDEX IF NOT EXISTS idx_apartments_project_name ON apartments(project_name);
CREATE INDEX IF NOT EXISTS idx_status_history_apartment ON status_history(apartment_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- =====================================================
-- RLS helper functions (SECURITY DEFINER — обходят RLS
-- внутри себя, разрывая рекурсию политик)
-- =====================================================

CREATE OR REPLACE FUNCTION public.current_user_is_admin() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_role(roles app_role[]) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ANY(roles))
$$;

CREATE OR REPLACE FUNCTION public.current_user_contractor_id() RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT contractor_id FROM profiles WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(app_role[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_contractor_id() TO authenticated, anon;

-- =====================================================
-- Functions & Triggers (workflow)
-- =====================================================

CREATE OR REPLACE FUNCTION fn_auto_assign_contractor()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'keys_available' AND (OLD.status IS NULL OR OLD.status != 'keys_available') THEN
    SELECT p.contractor_id INTO NEW.contractor_id
    FROM projects p
    WHERE UPPER(p.name) = UPPER(NEW.project_name)
    AND p.is_active = true
    LIMIT 1;

    IF NEW.contractor_id IS NOT NULL THEN
      NEW.status := 'assigned';
      NEW.assigned_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_assign_contractor ON apartments;
CREATE TRIGGER trigger_auto_assign_contractor
  BEFORE UPDATE ON apartments
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_assign_contractor();

CREATE OR REPLACE FUNCTION fn_track_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO status_history (apartment_id, old_status, new_status, reason)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.rejection_note);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_track_status ON apartments;
CREATE TRIGGER trigger_track_status
  BEFORE UPDATE ON apartments
  FOR EACH ROW
  EXECUTE FUNCTION fn_track_status_change();

CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_on_auth_user_created ON auth.users;
CREATE TRIGGER trigger_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION fn_handle_new_user();

-- =====================================================
-- Row Level Security
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejection_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;

-- Profiles: чтение всем залогиненным (нужно приложению для
-- отображения имён/ролей), запись — только админ.
DROP POLICY IF EXISTS "Profiles readable by all auth users" ON profiles;
CREATE POLICY "Profiles readable by all auth users" ON profiles
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert profiles" ON profiles;
CREATE POLICY "Admin can insert profiles" ON profiles
  FOR INSERT TO authenticated WITH CHECK (public.current_user_is_admin());
DROP POLICY IF EXISTS "Admin can update profiles" ON profiles;
CREATE POLICY "Admin can update profiles" ON profiles
  FOR UPDATE TO authenticated USING (public.current_user_is_admin());
DROP POLICY IF EXISTS "Admin can delete profiles" ON profiles;
CREATE POLICY "Admin can delete profiles" ON profiles
  FOR DELETE TO authenticated USING (public.current_user_is_admin());

-- Contractors
DROP POLICY IF EXISTS "Everyone can read contractors" ON contractors;
CREATE POLICY "Everyone can read contractors" ON contractors
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin can insert contractors" ON contractors;
CREATE POLICY "Admin can insert contractors" ON contractors
  FOR INSERT TO authenticated WITH CHECK (public.current_user_is_admin());
DROP POLICY IF EXISTS "Admin can update contractors" ON contractors;
CREATE POLICY "Admin can update contractors" ON contractors
  FOR UPDATE TO authenticated USING (public.current_user_is_admin());
DROP POLICY IF EXISTS "Admin can delete contractors" ON contractors;
CREATE POLICY "Admin can delete contractors" ON contractors
  FOR DELETE TO authenticated USING (public.current_user_is_admin());

-- Projects
DROP POLICY IF EXISTS "Everyone can read projects" ON projects;
CREATE POLICY "Everyone can read projects" ON projects
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin can insert projects" ON projects;
CREATE POLICY "Admin can insert projects" ON projects
  FOR INSERT TO authenticated WITH CHECK (public.current_user_is_admin());
DROP POLICY IF EXISTS "Admin can update projects" ON projects;
CREATE POLICY "Admin can update projects" ON projects
  FOR UPDATE TO authenticated USING (public.current_user_is_admin());
DROP POLICY IF EXISTS "Admin can delete projects" ON projects;
CREATE POLICY "Admin can delete projects" ON projects
  FOR DELETE TO authenticated USING (public.current_user_is_admin());

-- Rejection reasons
DROP POLICY IF EXISTS "Everyone can read rejection reasons" ON rejection_reasons;
CREATE POLICY "Everyone can read rejection reasons" ON rejection_reasons
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin can insert rejection reasons" ON rejection_reasons;
CREATE POLICY "Admin can insert rejection reasons" ON rejection_reasons
  FOR INSERT TO authenticated WITH CHECK (public.current_user_is_admin());
DROP POLICY IF EXISTS "Admin can update rejection reasons" ON rejection_reasons;
CREATE POLICY "Admin can update rejection reasons" ON rejection_reasons
  FOR UPDATE TO authenticated USING (public.current_user_is_admin());
DROP POLICY IF EXISTS "Admin can delete rejection reasons" ON rejection_reasons;
CREATE POLICY "Admin can delete rejection reasons" ON rejection_reasons
  FOR DELETE TO authenticated USING (public.current_user_is_admin());

-- Apartments
DROP POLICY IF EXISTS "Sales/admin/crm_loader can read all apartments" ON apartments;
CREATE POLICY "Sales/admin/crm_loader can read all apartments" ON apartments
  FOR SELECT TO authenticated
  USING (public.current_user_has_role(ARRAY['sales','admin','crm_loader']::app_role[]));
DROP POLICY IF EXISTS "Settlement can read all apartments" ON apartments;
CREATE POLICY "Settlement can read all apartments" ON apartments
  FOR SELECT TO authenticated
  USING (public.current_user_has_role(ARRAY['settlement']::app_role[]));
DROP POLICY IF EXISTS "Contractors read own assignments" ON apartments;
CREATE POLICY "Contractors read own assignments" ON apartments
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_role(ARRAY['contractor']::app_role[])
    AND contractor_id = public.current_user_contractor_id()
  );
DROP POLICY IF EXISTS "Sales/admin can insert apartments" ON apartments;
CREATE POLICY "Sales/admin can insert apartments" ON apartments
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['sales','admin']::app_role[]));
DROP POLICY IF EXISTS "Settlement/admin can update apartments" ON apartments;
CREATE POLICY "Settlement/admin can update apartments" ON apartments
  FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['settlement','admin']::app_role[]));
DROP POLICY IF EXISTS "Contractors can update own assignments" ON apartments;
CREATE POLICY "Contractors can update own assignments" ON apartments
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_role(ARRAY['contractor']::app_role[])
    AND contractor_id = public.current_user_contractor_id()
  );
DROP POLICY IF EXISTS "CRM loaders/admin can update apartments" ON apartments;
CREATE POLICY "CRM loaders/admin can update apartments" ON apartments
  FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['crm_loader','admin']::app_role[]));

-- Import batches
DROP POLICY IF EXISTS "Sales/admin can manage import batches" ON import_batches;
CREATE POLICY "Sales/admin can manage import batches" ON import_batches
  FOR ALL TO authenticated
  USING (public.current_user_has_role(ARRAY['sales','admin']::app_role[]));

-- Status history
DROP POLICY IF EXISTS "Everyone can read status history" ON status_history;
CREATE POLICY "Everyone can read status history" ON status_history
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "System can insert status history" ON status_history;
CREATE POLICY "System can insert status history" ON status_history
  FOR INSERT WITH CHECK (true);
