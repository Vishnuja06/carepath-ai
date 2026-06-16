-- @param min_facilities BIGINT
-- Top districts by Care Gap Score for the AI/BI Insights console.
-- Higher score = higher need + lower supply + lower information-trust.
SELECT
  district,
  state,
  n_facilities,
  total_beds,
  total_doctors,
  avg_trust,
  flagged_pct,
  n_specialties,
  need_index,
  need_known,
  supply_scarcity,
  trust_deficit,
  care_gap_score
FROM workspace.carepath_ai.care_gap_index
WHERE n_facilities >= :min_facilities
ORDER BY care_gap_score DESC
LIMIT 25;
