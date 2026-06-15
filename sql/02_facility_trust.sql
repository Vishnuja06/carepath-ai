-- =====================================================================
-- facility_trust: INFORMATION-trust score for each facility's self-claims.
-- This scores how well-corroborated / complete / internally consistent /
-- fresh a facility's record is. It does NOT assert clinical quality.
--
-- Score = 0..100, four transparent axes (0..25 each):
--   A corroboration  - how many independent sources back the record
--   B completeness    - share of key claim fields actually populated
--   C consistency     - penalties for self-contradictory / impossible claims
--   D recency         - how recently the record was refreshed
-- Component sub-scores and human-readable flags are stored for transparency.
-- =====================================================================
CREATE OR REPLACE TABLE workspace.carepath_ai.facility_trust AS
WITH base AS (
  SELECT
    *,
    -- most recent refresh signal across page update and social activity
    GREATEST(page_update_date, last_social_post_date) AS effective_update_date
  FROM workspace.carepath_ai.facilities_silver
),
scored AS (
  SELECT
    facility_id, name, city, district, state,

    ---------------------------------------------------------------- A
    CASE
      WHEN n_distinct_sources >= 4 THEN 25
      WHEN n_distinct_sources = 3 THEN 21
      WHEN n_distinct_sources = 2 THEN 15
      WHEN n_distinct_sources = 1 THEN 8
      ELSE 0
    END AS corroboration_score,

    ---------------------------------------------------------------- B
    ROUND(25.0 / 9 * (
      CAST(n_specialties > 0          AS INT) +
      CAST(number_doctors IS NOT NULL AS INT) +
      CAST(capacity IS NOT NULL       AS INT) +
      CAST(phone IS NOT NULL          AS INT) +
      CAST(website IS NOT NULL        AS INT) +
      CAST(email IS NOT NULL          AS INT) +
      CAST(city IS NOT NULL           AS INT) +
      CAST(year_established IS NOT NULL AS INT) +
      CAST(description IS NOT NULL    AS INT)
    )) AS completeness_score,

    ---------------------------------------------------------------- C
    GREATEST(0,
      25
      - CASE WHEN n_specialties >= 10 AND number_doctors IS NOT NULL AND number_doctors <= 1 THEN 10 ELSE 0 END
      - CASE WHEN capacity > 5000 OR (number_doctors IS NOT NULL AND capacity > number_doctors * 150) THEN 5 ELSE 0 END
      - CASE WHEN page_update_future_dated THEN 5 ELSE 0 END
      - CASE WHEN NOT geo_valid THEN 5 ELSE 0 END
    ) AS consistency_score,

    ---------------------------------------------------------------- D
    CASE
      WHEN effective_update_date IS NULL THEN 0
      WHEN MONTHS_BETWEEN(CURRENT_DATE(), effective_update_date) <= 6  THEN 25
      WHEN MONTHS_BETWEEN(CURRENT_DATE(), effective_update_date) <= 12 THEN 18
      WHEN MONTHS_BETWEEN(CURRENT_DATE(), effective_update_date) <= 24 THEN 10
      WHEN MONTHS_BETWEEN(CURRENT_DATE(), effective_update_date) <= 36 THEN 5
      ELSE 0
    END AS recency_score,

    -- human-readable flags (drop NULLs)
    FILTER(ARRAY(
      CASE WHEN n_distinct_sources <= 1 THEN 'single_or_no_source' END,
      CASE WHEN n_specialties >= 10 AND number_doctors IS NOT NULL AND number_doctors <= 1
           THEN 'doctor_count_contradicts_specialty_breadth' END,
      CASE WHEN capacity > 5000 OR (number_doctors IS NOT NULL AND capacity > number_doctors * 150)
           THEN 'implausible_capacity_vs_doctors' END,
      CASE WHEN page_update_future_dated THEN 'future_dated_update' END,
      CASE WHEN NOT geo_valid THEN 'missing_or_invalid_geo' END,
      CASE WHEN effective_update_date IS NULL
                OR MONTHS_BETWEEN(CURRENT_DATE(), effective_update_date) > 24 THEN 'stale_over_2y' END
    ), x -> x IS NOT NULL) AS trust_flags
  FROM base
)
SELECT
  *,
  (corroboration_score + completeness_score + consistency_score + recency_score) AS trust_score,
  CASE
    WHEN (corroboration_score + completeness_score + consistency_score + recency_score) >= 70 THEN 'High'
    WHEN (corroboration_score + completeness_score + consistency_score + recency_score) >= 45 THEN 'Medium'
    ELSE 'Low'
  END AS trust_tier
FROM scored;
