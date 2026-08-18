-- ============================================================
-- BALSAMA AUTO GESTION – Schéma de Base de Données Supabase
-- À exécuter dans l'éditeur SQL du dashboard Supabase
-- https://app.supabase.com → votre projet → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────
-- 1. Types ENUM
-- ─────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('founder', 'seller', 'collaborator', 'pending');
CREATE TYPE account_status AS ENUM ('pending', 'activated', 'suspended');
CREATE TYPE access_code_status AS ENUM ('pending', 'generated', 'sent', 'used', 'expired', 'disabled');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'cancelled', 'expired');
CREATE TYPE payment_method AS ENUM ('mobile_money', 'manual', 'free');
CREATE TYPE activation_type AS ENUM ('paid', 'manual');

-- ─────────────────────────────────────────
-- 2. Profils utilisateurs
--    (Complémente auth.users de Supabase)
-- ─────────────────────────────────────────
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'pending',
  status account_status NOT NULL DEFAULT 'pending',
  store_id UUID, -- Sera lié à stores.id
  pin_hash TEXT, -- PIN chiffré (bcrypt côté client ou edge function)
  session_timeout_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────
-- 3. Boutiques (Stores)
-- ─────────────────────────────────────────
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subtitle TEXT,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  nif_stat TEXT,
  receipt_footer TEXT,
  currency_symbol TEXT NOT NULL DEFAULT 'Ar',
  tva_rate NUMERIC NOT NULL DEFAULT 0,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  suppliers TEXT[] DEFAULT '{}',
  enable_pin_security BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Ajouter la FK de profiles.store_id vers stores.id
ALTER TABLE profiles ADD CONSTRAINT fk_profiles_store
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────
-- 4. Codes d'accès (Activation)
-- ─────────────────────────────────────────
CREATE TABLE access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,  -- Code unique ex: BLSM-A3F2-KX8P
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status access_code_status NOT NULL DEFAULT 'generated',
  activation_type activation_type NOT NULL DEFAULT 'paid',
  payment_method payment_method,
  amount_paid NUMERIC,
  payment_reference TEXT,  -- Ex: Numéro de transaction MVola
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  generated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,  -- Ex: "Offert par le fondateur"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour accélérer la recherche par code
CREATE INDEX idx_access_codes_code ON access_codes(code);
CREATE INDEX idx_access_codes_user ON access_codes(user_id);

-- ─────────────────────────────────────────
-- 5. Invitations Collaborateurs
-- ─────────────────────────────────────────
CREATE TABLE collaborator_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'collaborator', -- 'collaborator' | 'seller' | 'cashier'
  status invitation_status NOT NULL DEFAULT 'pending',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_email ON collaborator_invitations(invited_email);
CREATE INDEX idx_invitations_token ON collaborator_invitations(token);

-- ─────────────────────────────────────────
-- 6. Journal des Actions Admin
-- ─────────────────────────────────────────
CREATE TABLE admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,  -- Ex: 'manual_activation', 'code_generated', 'user_suspended'
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_actions_by ON admin_actions(performed_by);
CREATE INDEX idx_admin_actions_target ON admin_actions(target_user_id);

-- ─────────────────────────────────────────
-- 7. Fonction : Créer un Profil à l'Inscription
--    Appelée automatiquement via trigger auth
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'pending',
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────
-- 8. Fonction : Générer un Code d'Accès Unique
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_access_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INTEGER;
BEGIN
  -- Format: BLSM-XXXX-XXXX (12 caractères utiles)
  code := 'BLSM-';
  FOR i IN 1..4 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  code := code || '-';
  FOR i IN 1..4 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────
-- 9. Row Level Security (RLS) — Sécurité côté serveur
-- ─────────────────────────────────────────

-- Fonction sécurisée pour lire le rôle sans déclencher de boucle infinie RLS
CREATE OR REPLACE FUNCTION get_auth_role()
RETURNS text AS $$
  SELECT role::text FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Activer RLS sur toutes les tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborator_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Politique : Un utilisateur ne peut voir QUE son propre profil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Politique : Le fondateur (role = 'founder') peut voir tous les profils
CREATE POLICY "Founder can view all profiles"
  ON profiles FOR ALL
  USING (get_auth_role() = 'founder');

-- Politique : Les stores ne sont visibles que par leur propriétaire et les collaborateurs
CREATE POLICY "Store owner can manage store"
  ON stores FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "Collaborators can view store"
  ON stores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND store_id = stores.id
    )
  );

-- Politique : Les codes sont visibles seulement par leur propriétaire ou le fondateur
CREATE POLICY "Users can view own access codes"
  ON access_codes FOR SELECT
  USING (
    user_id = auth.uid()
    OR get_auth_role() = 'founder'
  );

-- Le fondateur peut tout faire sur les codes
CREATE POLICY "Founder can manage all access codes"
  ON access_codes FOR ALL
  USING (get_auth_role() = 'founder');

-- Invitations : visibles par le propriétaire de la boutique
CREATE POLICY "Store owner can manage invitations"
  ON collaborator_invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE id = collaborator_invitations.store_id AND owner_id = auth.uid()
    )
  );

-- Actions admin : visibles seulement par le fondateur
CREATE POLICY "Founder can view admin actions"
  ON admin_actions FOR SELECT
  USING (get_auth_role() = 'founder');

-- ─────────────────────────────────────────
-- 10. Compte Fondateur initial
--     NOTE: Créez d'abord votre compte via l'interface d'inscription,
--     puis exécutez cette commande en remplaçant VOTRE_EMAIL
-- ─────────────────────────────────────────
-- UPDATE profiles
-- SET role = 'founder', status = 'activated'
-- WHERE email = 'VOTRE_EMAIL@example.com';

-- ─────────────────────────────────────────
-- TERMINÉ ✓
-- Ce schéma crée l'infrastructure complète :
-- profiles, stores, access_codes, collaborator_invitations, admin_actions
-- avec sécurité RLS pour chaque table.
-- ─────────────────────────────────────────
