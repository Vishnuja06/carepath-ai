-- @param specialty STRING
-- @param pincode BIGINT
-- @param radius_km DOUBLE
-- @param trust_weight DOUBLE
-- Ranked referrals: facilities matching a specialty within radius of the
-- patient pincode, blended on proximity + information-trust.
SELECT
  facility_id,
  name,
  city,
  district,
  state,
  ARRAY_JOIN(matched_specialties, ', ') AS matched_specialties,
  number_doctors,
  capacity,
  distance_km,
  proximity_score,
  trust_score,
  trust_tier,
  ARRAY_JOIN(trust_flags, '|') AS trust_flags,
  rank_score
FROM workspace.carepath_ai.recommend_by_pincode(
  :specialty,
  CAST(:pincode AS BIGINT),
  CAST(:radius_km AS DOUBLE),
  CAST(:trust_weight AS DOUBLE)
)
LIMIT 40;
