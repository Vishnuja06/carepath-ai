-- =====================================================================
-- care_gap_index: district-level CARE GAP prioritization for the AI/BI
-- Insights console. Flips CarePath from per-patient referral to
-- population-health triage: "where should scarce care resources go?"
--
-- care_gap_score (0..100, higher = bigger gap) blends three lenses:
--   NEED    (0.45) - NFHS-5 deprivation: anaemia, non-institutional births,
--                    unskilled births, uninsured households (higher = worse)
--   SUPPLY  (0.35) - scarcity of facilities (percent-rank inverse)
--   TRUST   (0.20) - information-trust deficit (100 - avg facility trust)
-- When a district has no NFHS match, NEED is dropped and the remaining two
-- lenses are reweighted, with need_known = false so the UI can be honest
-- about it (Evidence & Uncertainty).
--
-- Idempotent VIEW over workspace.carepath_ai.facilities_silver + facility_trust
-- and the read-only NFHS-5 source table. Run once; no base-table rebuild.
-- =====================================================================
CREATE OR REPLACE VIEW workspace.carepath_ai.care_gap_index AS
WITH supply AS (
  SELECT
    s.district                                            AS district,
    MAX(s.state)                                          AS state,
    COUNT(*)                                              AS n_facilities,
    SUM(COALESCE(s.capacity, 0))                          AS total_beds,
    SUM(COALESCE(s.number_doctors, 0))                    AS total_doctors,
    ROUND(AVG(t.trust_score), 1)                          AS avg_trust,
    ROUND(AVG(CASE WHEN t.trust_tier = 'Low' OR SIZE(t.trust_flags) > 0
                   THEN 1.0 ELSE 0.0 END) * 100, 1)       AS flagged_pct,
    SIZE(ARRAY_DISTINCT(FLATTEN(COLLECT_LIST(s.specialties_clean)))) AS n_specialties
  FROM workspace.carepath_ai.facilities_silver s
  JOIN workspace.carepath_ai.facility_trust t USING (facility_id)
  WHERE s.district IS NOT NULL AND TRIM(s.district) <> ''
  GROUP BY s.district
),
need_raw AS (
  SELECT
    UPPER(TRIM(district_name))                                 AS dkey,
    TRY_CAST(all_w15_49_who_are_anaemic_pct AS DOUBLE)         AS anaemia,
    100 - TRY_CAST(institutional_birth_5y_pct AS DOUBLE)       AS non_institutional,
    100 - TRY_CAST(births_attended_by_skilled_hp_5y_10_pct AS DOUBLE) AS unskilled,
    100 - TRY_CAST(hh_member_covered_health_insurance_pct AS DOUBLE)  AS uninsured
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.nfhs_5_district_health_indicators
),
need_idx AS (
  -- mean of the available (non-null) need components, 0..100
  SELECT
    dkey,
    ROUND((
      COALESCE(anaemia, 0) + COALESCE(non_institutional, 0)
      + COALESCE(unskilled, 0) + COALESCE(uninsured, 0)
    ) / NULLIF(
      (CASE WHEN anaemia IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN non_institutional IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN unskilled IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN uninsured IS NOT NULL THEN 1 ELSE 0 END), 0
    ), 1) AS need_index
  FROM need_raw
),
joined AS (
  SELECT
    sp.*,
    ni.need_index,
    (ni.need_index IS NOT NULL)            AS need_known,
    ROUND(100 - sp.avg_trust, 1)           AS trust_deficit
  FROM supply sp
  LEFT JOIN need_idx ni ON UPPER(TRIM(sp.district)) = ni.dkey
),
ranked AS (
  SELECT
    *,
    -- fewer facilities -> higher scarcity (0..100)
    ROUND(100 * (1 - PERCENT_RANK() OVER (ORDER BY n_facilities ASC)), 1) AS supply_scarcity
  FROM joined
)
SELECT
  district,
  state,
  n_facilities,
  total_beds,
  total_doctors,
  avg_trust,
  flagged_pct,
  n_specialties,
  ROUND(COALESCE(need_index, 0), 1) AS need_index,
  need_known,
  supply_scarcity,
  trust_deficit,
  ROUND(
    CASE
      WHEN need_known
        THEN 0.45 * need_index + 0.35 * supply_scarcity + 0.20 * trust_deficit
      ELSE 0.65 * supply_scarcity + 0.35 * trust_deficit
    END, 1) AS care_gap_score
FROM ranked;
