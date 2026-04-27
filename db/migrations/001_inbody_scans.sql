-- Migration 001 : table inbody_scans
-- Appliquer sur une instance déjà déployée :
--   docker exec -i <container_postgres> psql -U postgres -d hevyviz < db/migrations/001_inbody_scans.sql

CREATE TABLE api.inbody_scans (
  id                       BIGSERIAL PRIMARY KEY,
  user_id                  INT NOT NULL REFERENCES api.users(id) ON DELETE CASCADE,
  scan_date                TIMESTAMPTZ NOT NULL,

  -- Identité du test
  height_cm                NUMERIC(5,2),

  -- Composition globale
  weight_kg                NUMERIC(6,2),
  skeletal_muscle_mass_kg  NUMERIC(5,2),
  body_fat_mass_kg         NUMERIC(5,2),
  lean_body_mass_kg        NUMERIC(5,2),
  fat_free_mass_kg         NUMERIC(5,2),
  body_fat_percent         NUMERIC(4,2),
  bmi                      NUMERIC(4,2),

  -- Composition segmentaire (masse maigre par segment, en kg)
  segmental_lean_right_arm_kg  NUMERIC(4,2),
  segmental_lean_left_arm_kg   NUMERIC(4,2),
  segmental_lean_trunk_kg      NUMERIC(5,2),
  segmental_lean_right_leg_kg  NUMERIC(4,2),
  segmental_lean_left_leg_kg   NUMERIC(4,2),

  -- Eau corporelle
  total_body_water_l       NUMERIC(4,2),
  intracellular_water_l    NUMERIC(4,2),
  extracellular_water_l    NUMERIC(4,2),
  ecw_tbw_ratio            NUMERIC(4,3),

  -- Métabolisme & morpho
  basal_metabolic_rate_kcal INT,
  waist_cm                 NUMERIC(5,2),
  waist_hip_ratio          NUMERIC(4,2),
  visceral_fat_area_cm2    NUMERIC(5,2),

  -- Qualité cellulaire
  phase_angle_deg          NUMERIC(3,1),

  -- Fourchettes de référence extraites par OCR (pour usage futur)
  -- Format : {"body_fat_percent": {"min": 10.0, "max": 20.0}, ...}
  ocr_references           JSONB,

  -- Notes libres
  notes                    TEXT,

  CONSTRAINT inbody_scans_unique UNIQUE (user_id, scan_date)
);

CREATE INDEX idx_inbody_user_date ON api.inbody_scans(user_id, scan_date DESC);

ALTER TABLE api.inbody_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY inbody_scans_isolation ON api.inbody_scans
  FOR ALL TO web_user
  USING (user_id = api.current_user_id())
  WITH CHECK (user_id = api.current_user_id());

GRANT ALL ON api.inbody_scans TO web_user;
GRANT USAGE, SELECT ON SEQUENCE api.inbody_scans_id_seq TO web_user;
