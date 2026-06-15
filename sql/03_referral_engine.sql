-- =====================================================================
-- Referral Engine ("where should a patient go").
-- Retrieval (specialty + distance) + transparent blend of proximity & trust.
-- Built on workspace.carepath_ai.facilities_silver + facility_trust.
-- =====================================================================

-- Pincode -> coordinates lookup so a patient location can be a pincode.
CREATE OR REPLACE TABLE workspace.carepath_ai.pincode_geo AS
SELECT
  pincode,
  MAX(district)  AS district,
  MAX(statename) AS state,
  ROUND(AVG(TRY_CAST(latitude  AS DOUBLE)), 6) AS latitude,
  ROUND(AVG(TRY_CAST(longitude AS DOUBLE)), 6) AS longitude
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.india_post_pincode_directory
WHERE TRY_CAST(latitude  AS DOUBLE) BETWEEN 6 AND 37.5
  AND TRY_CAST(longitude AS DOUBLE) BETWEEN 68 AND 97.5
GROUP BY pincode;

-- Great-circle distance in km (haversine).
CREATE OR REPLACE FUNCTION workspace.carepath_ai.km_between(
  lat1 DOUBLE, lon1 DOUBLE, lat2 DOUBLE, lon2 DOUBLE
)
RETURNS DOUBLE
RETURN 6371.0 * 2 * ASIN(SQRT(
  POW(SIN(RADIANS(lat2 - lat1) / 2), 2)
  + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * POW(SIN(RADIANS(lon2 - lon1) / 2), 2)
));

-- Core recommender: returns facilities matching a specialty within a radius,
-- ranked by a visible blend of proximity and information-trust.
--   p_trust_weight in [0,1]: 0 = rank purely by proximity, 1 = purely by trust.
CREATE OR REPLACE FUNCTION workspace.carepath_ai.recommend_facilities(
  p_specialty     STRING,
  p_lat           DOUBLE,
  p_lon           DOUBLE,
  p_radius_km     DOUBLE,
  p_trust_weight  DOUBLE
)
RETURNS TABLE (
  facility_id          STRING,
  name                 STRING,
  city                 STRING,
  district             STRING,
  state                STRING,
  matched_specialties  ARRAY<STRING>,
  number_doctors       INT,
  capacity             INT,
  distance_km          DOUBLE,
  proximity_score      DOUBLE,
  trust_score          INT,
  trust_tier           STRING,
  trust_flags          ARRAY<STRING>,
  rank_score           DOUBLE
)
RETURN
  WITH cand AS (
    SELECT
      s.facility_id, s.name, s.city, s.district, s.state,
      s.specialties_clean, s.number_doctors, s.capacity,
      t.trust_score, t.trust_tier, t.trust_flags,
      workspace.carepath_ai.km_between(p_lat, p_lon, s.latitude, s.longitude) AS distance_km
    FROM workspace.carepath_ai.facilities_silver s
    JOIN workspace.carepath_ai.facility_trust t USING (facility_id)
    WHERE s.geo_valid
      AND SIZE(FILTER(s.specialties_clean, sp -> LOWER(sp) LIKE '%' || LOWER(p_specialty) || '%')) > 0
  )
  SELECT
    facility_id, name, city, district, state,
    FILTER(specialties_clean, sp -> LOWER(sp) LIKE '%' || LOWER(p_specialty) || '%') AS matched_specialties,
    number_doctors, capacity,
    ROUND(distance_km, 1) AS distance_km,
    ROUND(GREATEST(0, 100 * (1 - distance_km / p_radius_km)), 1) AS proximity_score,
    trust_score, trust_tier, trust_flags,
    ROUND(
      (1 - p_trust_weight) * GREATEST(0, 100 * (1 - distance_km / p_radius_km))
      + p_trust_weight * trust_score
    , 1) AS rank_score
  FROM cand
  WHERE distance_km <= p_radius_km
  ORDER BY rank_score DESC, distance_km ASC;

-- Convenience wrapper: locate the patient by pincode instead of coordinates.
-- Mirrors recommend_facilities and resolves the patient location via a 1-row
-- join, since SQL TVFs cannot take correlated subqueries as arguments.
CREATE OR REPLACE FUNCTION workspace.carepath_ai.recommend_by_pincode(
  p_specialty     STRING,
  p_pincode       BIGINT,
  p_radius_km     DOUBLE,
  p_trust_weight  DOUBLE
)
RETURNS TABLE (
  facility_id STRING, name STRING, city STRING, district STRING, state STRING,
  matched_specialties ARRAY<STRING>, number_doctors INT, capacity INT,
  distance_km DOUBLE, proximity_score DOUBLE,
  trust_score INT, trust_tier STRING, trust_flags ARRAY<STRING>, rank_score DOUBLE
)
RETURN
  WITH loc AS (
    SELECT MAX(latitude) AS lat, MAX(longitude) AS lon
    FROM workspace.carepath_ai.pincode_geo WHERE pincode = p_pincode
  ),
  cand AS (
    SELECT
      s.facility_id, s.name, s.city, s.district, s.state,
      s.specialties_clean, s.number_doctors, s.capacity,
      t.trust_score, t.trust_tier, t.trust_flags,
      workspace.carepath_ai.km_between(loc.lat, loc.lon, s.latitude, s.longitude) AS distance_km
    FROM workspace.carepath_ai.facilities_silver s
    JOIN workspace.carepath_ai.facility_trust t USING (facility_id)
    CROSS JOIN loc
    WHERE s.geo_valid
      AND SIZE(FILTER(s.specialties_clean, sp -> LOWER(sp) LIKE '%' || LOWER(p_specialty) || '%')) > 0
  )
  SELECT
    facility_id, name, city, district, state,
    FILTER(specialties_clean, sp -> LOWER(sp) LIKE '%' || LOWER(p_specialty) || '%') AS matched_specialties,
    number_doctors, capacity,
    ROUND(distance_km, 1) AS distance_km,
    ROUND(GREATEST(0, 100 * (1 - distance_km / p_radius_km)), 1) AS proximity_score,
    trust_score, trust_tier, trust_flags,
    ROUND(
      (1 - p_trust_weight) * GREATEST(0, 100 * (1 - distance_km / p_radius_km))
      + p_trust_weight * trust_score
    , 1) AS rank_score
  FROM cand
  WHERE distance_km <= p_radius_km
  ORDER BY rank_score DESC, distance_km ASC;
