-- @param facility_id STRING
-- Full facility record + trust breakdown + evidence for the detail panel.
SELECT
  s.facility_id,
  s.name,
  s.organization_type,
  s.city,
  s.district,
  s.state,
  s.address_line1,
  s.address_line2,
  s.postcode_raw,
  s.phone,
  s.email,
  s.website,
  s.number_doctors,
  s.capacity,
  s.year_established,
  ARRAY_JOIN(s.specialties_clean, ', ') AS specialties,
  s.n_specialties,
  s.n_distinct_sources,
  s.description,
  s.source_urls,
  CAST(s.page_update_date AS STRING) AS page_update_date,
  s.latitude,
  s.longitude,
  t.trust_score,
  t.trust_tier,
  t.corroboration_score,
  t.completeness_score,
  t.consistency_score,
  t.recency_score,
  ARRAY_JOIN(t.trust_flags, '|') AS trust_flags
FROM workspace.carepath_ai.facilities_silver s
JOIN workspace.carepath_ai.facility_trust t USING (facility_id)
WHERE s.facility_id = :facility_id
LIMIT 1;
