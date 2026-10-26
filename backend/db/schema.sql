-- Additive, repeatable schema for NextGen Mobiles. Does not drop or truncate data.
CREATE SCHEMA IF NOT EXISTS nextgen_app;

CREATE TABLE IF NOT EXISTS nextgen_app.categories (
  slug text PRIMARY KEY,
  name text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '◇',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nextgen_categories_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  CONSTRAINT nextgen_categories_name_length CHECK (char_length(name) BETWEEN 1 AND 100)
);

INSERT INTO nextgen_app.categories (slug, name, subtitle, icon, display_order)
VALUES
  ('mobile-skins', 'Mobile Skins', 'Premium Skin Collections', '◆', 1),
  ('screen-guard', 'Screen Guard', 'Premium Screen Protection', '◇', 2),
  ('tempered-glass', 'Unbreakable Tempered Glass', 'Premium Protection', '◇', 3),
  ('smartphones', 'Smartphones', 'Sales & Latest Models', '▣', 4)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS nextgen_app.products (
  id text PRIMARY KEY,
  category_slug text NOT NULL REFERENCES nextgen_app.categories(slug) ON UPDATE CASCADE ON DELETE RESTRICT,
  name text NOT NULL,
  image_url text NOT NULL DEFAULT '',
  price numeric(12,2),
  description text NOT NULL DEFAULT '',
  is_new_arrival boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nextgen_products_name_length CHECK (char_length(name) BETWEEN 1 AND 180),
  CONSTRAINT nextgen_products_price_nonnegative CHECK (price IS NULL OR price >= 0)
);
CREATE INDEX IF NOT EXISTS nextgen_products_category_active_idx
  ON nextgen_app.products (category_slug, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS nextgen_products_arrivals_idx
  ON nextgen_app.products (is_new_arrival, is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS nextgen_app.guests (
  id uuid PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  contact_type text NOT NULL CHECK (contact_type IN ('email', 'phone')),
  contact_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nextgen_guests_contact_unique UNIQUE (contact_type, contact_value),
  CONSTRAINT nextgen_guests_first_name_length CHECK (char_length(first_name) BETWEEN 1 AND 60),
  CONSTRAINT nextgen_guests_last_name_length CHECK (char_length(last_name) BETWEEN 1 AND 60)
);

CREATE TABLE IF NOT EXISTS nextgen_app.product_like_counts (
  product_key text PRIMARY KEY,
  like_count integer NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nextgen_app.admin_sessions (
  token_hash text PRIMARY KEY,
  username text NOT NULL,
  csrf_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nextgen_admin_sessions_expiry_idx
  ON nextgen_app.admin_sessions (expires_at);

