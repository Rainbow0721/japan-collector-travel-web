-- V3 景點資料庫草案（PostgreSQL + PostGIS）
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE places (
  id uuid PRIMARY KEY,
  name_zh_hant text NOT NULL,
  name_zh_hans text,
  name_ja text NOT NULL,
  name_en text,
  category text NOT NULL,
  subcategories text[] NOT NULL DEFAULT '{}',
  prefecture text NOT NULL,
  city text NOT NULL,
  district text,
  area_cluster text NOT NULL,
  location geography(Point, 4326) NOT NULL,
  official_url text,
  admission_jpy integer,
  typical_meal_min_jpy integer,
  typical_meal_max_jpy integer,
  opening_hours jsonb,
  reservation_required boolean NOT NULL DEFAULT false,
  average_stay_minutes integer,
  wheelchair jsonb,
  stroller jsonb,
  elderly_risk jsonb,
  rainy_day boolean,
  popularity_score numeric(5,2) NOT NULL DEFAULT 0,
  confidence numeric(4,3) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'candidate',
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('candidate','verified','hidden','closed')),
  CHECK (popularity_score BETWEEN 0 AND 100),
  CHECK (confidence BETWEEN 0 AND 1)
);

CREATE INDEX places_location_gix ON places USING gist(location);
CREATE INDEX places_recommendation_idx ON places(status, area_cluster, category, popularity_score DESC);

CREATE TABLE place_provider_refs (
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_place_id text NOT NULL,
  provider_url text,
  rating numeric(3,2),
  review_count integer,
  price_level integer,
  fetched_at timestamptz NOT NULL,
  expires_at timestamptz,
  raw_cache_allowed boolean NOT NULL DEFAULT false,
  PRIMARY KEY(provider, provider_place_id)
);

CREATE TABLE popularity_signals (
  id bigserial PRIMARY KEY,
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_url text NOT NULL,
  signal_weight numeric(6,3) NOT NULL,
  observed_at date NOT NULL,
  note_zh_hant text
);

CREATE TABLE route_snapshots (
  id bigserial PRIMARY KEY,
  provider text NOT NULL,
  origin geography(Point, 4326) NOT NULL,
  destination geography(Point, 4326) NOT NULL,
  departure_at timestamptz NOT NULL,
  mode text NOT NULL,
  duration_seconds integer NOT NULL,
  walking_seconds integer,
  transfer_count integer,
  fare_jpy integer,
  fare_complete boolean NOT NULL DEFAULT false,
  route_summary jsonb NOT NULL,
  fetched_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE official_price_sources (
  id bigserial PRIMARY KEY,
  place_id uuid REFERENCES places(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  price_type text NOT NULL,
  amount_jpy integer,
  conditions_zh_hant text,
  effective_from date,
  verified_at timestamptz NOT NULL
);
