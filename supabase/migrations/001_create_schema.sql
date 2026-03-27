-- =====================================================
-- DKP Inspections Database Schema
-- =====================================================

-- Enum types
CREATE TYPE app_role AS ENUM ('sales', 'settlement', 'contractor', 'crm_loader', 'admin');

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

-- =====================================================
-- Tables
-- =====================================================

-- Contractors (4 companies)
CREATE TABLE contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Projects (residential developments)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rejection reasons
CREATE TABLE rejection_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role app_role NOT NULL DEFAULT 'sales',
  contractor_id UUID REFERENCES contractors(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Import batches
CREATE TABLE import_batches (
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

-- Apartments (main entity)
CREATE TABLE apartments (
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

-- Status history (audit trail)
CREATE TABLE status_history (
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

CREATE INDEX idx_apartments_status ON apartments(status);
CREATE INDEX idx_apartments_contractor ON apartments(contractor_id);
CREATE INDEX idx_apartments_project ON apartments(project_id);
CREATE INDEX idx_apartments_crm_code ON apartments(crm_code);
CREATE INDEX idx_apartments_receipt_date ON apartments(receipt_date);
CREATE INDEX idx_apartments_project_name ON apartments(project_name);
CREATE INDEX idx_status_history_apartment ON status_history(apartment_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- =====================================================
-- Functions & Triggers
-- =====================================================

-- Auto-assign contractor when keys are confirmed
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

CREATE TRIGGER trigger_auto_assign_contractor
  BEFORE UPDATE ON apartments
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_assign_contractor();

-- Track status changes
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

CREATE TRIGGER trigger_track_status
  BEFORE UPDATE ON apartments
  FOR EACH ROW
  EXECUTE FUNCTION fn_track_status_change();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admin can manage all profiles" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Contractors: everyone can read
CREATE POLICY "Everyone can read contractors" ON contractors
  FOR SELECT USING (true);
CREATE POLICY "Admin can manage contractors" ON contractors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Projects: everyone can read
CREATE POLICY "Everyone can read projects" ON projects
  FOR SELECT USING (true);
CREATE POLICY "Admin can manage projects" ON projects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Rejection reasons: everyone can read
CREATE POLICY "Everyone can read rejection reasons" ON rejection_reasons
  FOR SELECT USING (true);
CREATE POLICY "Admin can manage rejection reasons" ON rejection_reasons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Apartments: role-based access
CREATE POLICY "Sales/admin/crm_loader can read all apartments" ON apartments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('sales', 'admin', 'crm_loader'))
  );
CREATE POLICY "Settlement can read all apartments" ON apartments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'settlement')
  );
CREATE POLICY "Contractors read own assignments" ON apartments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'contractor'
      AND apartments.contractor_id = p.contractor_id
    )
  );
CREATE POLICY "Sales can insert apartments" ON apartments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('sales', 'admin'))
  );
CREATE POLICY "Settlement can update apartments" ON apartments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('settlement', 'admin'))
  );
CREATE POLICY "Contractors can update own assignments" ON apartments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'contractor'
      AND apartments.contractor_id = p.contractor_id
    )
  );
CREATE POLICY "CRM loaders can update apartments" ON apartments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('crm_loader', 'admin'))
  );

-- Import batches: sales & admin
CREATE POLICY "Sales can manage import batches" ON import_batches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('sales', 'admin'))
  );

-- Status history: everyone can read
CREATE POLICY "Everyone can read status history" ON status_history
  FOR SELECT USING (true);
CREATE POLICY "System can insert status history" ON status_history
  FOR INSERT WITH CHECK (true);
