-- =====================================================================
-- facilities_silver: cleaned, parsed facility records (India).
-- Serves BOTH engines:
--   * Referral ("where to go"): specialties_clean, lat/long, district, doctors/capacity
--   * Trust ("can we trust why"): parsed source/recency/presence signals
-- Source is read-only Delta Sharing; output lives in workspace.carepath_ai.
-- =====================================================================
CREATE OR REPLACE TABLE workspace.carepath_ai.facilities_silver AS
WITH src AS (
  SELECT *
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
  WHERE address_country = 'India'          -- drops the ~88 dirty/non-India rows
),
-- authoritative pincode centroids (lat/long + district), used to snap each
-- facility to its true district BY COORDINATES rather than its own (dirty)
-- postcode -- so the district label is consistent with the distance math.
pin_centroid AS (
  SELECT
    pincode,
    MAX(district)  AS district,
    MAX(statename) AS statename,
    AVG(TRY_CAST(latitude  AS DOUBLE)) AS lat,
    AVG(TRY_CAST(longitude AS DOUBLE)) AS lon
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.india_post_pincode_directory
  WHERE TRY_CAST(latitude  AS DOUBLE) BETWEEN 6 AND 37.5
    AND TRY_CAST(longitude AS DOUBLE) BETWEEN 68 AND 97.5
  GROUP BY pincode
),
cleaned AS (
  SELECT
    unique_id                                                   AS facility_id,
    NULLIF(TRIM(name), '')                                      AS name,
    NULLIF(TRIM(organization_type), '')                         AS organization_type,

    -- specialties: parse JSON array, dedup, drop blanks
    FILTER(
      ARRAY_DISTINCT(COALESCE(FROM_JSON(specialties, 'array<string>'), ARRAY())),
      x -> x IS NOT NULL AND TRIM(x) <> ''
    )                                                           AS specialties_clean,

    -- numeric claims (NULL when missing/zero/implausible)
    CASE WHEN TRY_CAST(numberDoctors AS INT) > 0 THEN TRY_CAST(numberDoctors AS INT) END AS number_doctors,
    CASE WHEN TRY_CAST(capacity AS INT) > 0 THEN TRY_CAST(capacity AS INT) END           AS capacity,
    CASE WHEN TRY_CAST(yearEstablished AS INT) BETWEEN 1800 AND YEAR(CURRENT_DATE())
         THEN TRY_CAST(yearEstablished AS INT) END                                       AS year_established,

    -- contact (prefer official; treat placeholders as missing)
    NULLIF(TRIM(COALESCE(NULLIF(TRIM(officialPhone), ''), phone_numbers)), '')   AS phone,
    NULLIF(TRIM(email), '')                                                      AS email,
    NULLIF(TRIM(COALESCE(NULLIF(TRIM(officialWebsite), ''), websites)), '')      AS website,
    NULLIF(TRIM(facebookLink), '')                                               AS facebook_link,

    -- address
    NULLIF(TRIM(address_line1), '')        AS address_line1,
    NULLIF(TRIM(address_line2), '')        AS address_line2,
    NULLIF(TRIM(address_city), '')         AS city,
    NULLIF(TRIM(address_stateOrRegion), '') AS state_raw,
    NULLIF(TRIM(address_zipOrPostcode), '') AS postcode_raw,
    TRY_CAST(address_zipOrPostcode AS BIGINT) AS pincode,

    -- geo: keep only coordinates plausibly inside India
    CASE WHEN latitude BETWEEN 6 AND 37.5 AND longitude BETWEEN 68 AND 97.5 THEN latitude END  AS latitude,
    CASE WHEN latitude BETWEEN 6 AND 37.5 AND longitude BETWEEN 68 AND 97.5 THEN longitude END AS longitude,

    -- source corroboration
    ARRAY_DISTINCT(COALESCE(FROM_JSON(source_types, 'array<string>'), ARRAY()))  AS source_types_clean,
    SIZE(ARRAY_DISTINCT(COALESCE(FROM_JSON(source_types, 'array<string>'), ARRAY()))) AS n_distinct_sources,

    -- recency (ignore impossible future dates)
    CASE WHEN TRY_CAST(recency_of_page_update AS DATE) <= CURRENT_DATE()
         THEN TRY_CAST(recency_of_page_update AS DATE) END                       AS page_update_date,
    TRY_CAST(recency_of_page_update AS DATE) > CURRENT_DATE()                     AS page_update_future_dated,
    CASE WHEN TRY_CAST(post_metrics_most_recent_social_media_post_date AS DATE) <= CURRENT_DATE()
         THEN TRY_CAST(post_metrics_most_recent_social_media_post_date AS DATE) END AS last_social_post_date,

    -- presence / activity signals
    TRY_CAST(post_metrics_post_count AS INT)                 AS post_count,
    TRY_CAST(distinct_social_media_presence_count AS INT)    AS distinct_social_presence,
    TRY_CAST(number_of_facts_about_the_organization AS INT)  AS n_facts,
    TRY_CAST(engagement_metrics_n_followers AS INT)          AS n_followers,
    LOWER(TRIM(affiliated_staff_presence)) = 'true'          AS has_affiliated_staff,
    LOWER(TRIM(custom_logo_presence)) = 'true'               AS has_custom_logo,

    -- evidence / provenance (for the Evidence Engine)
    NULLIF(TRIM(description), '')  AS description,
    source_urls,
    source_content_id,
    source_ids
  FROM src
),
-- snap each geo-valid facility to its nearest pincode centroid (bounding-box
-- prune to ~±0.5 deg, then pick the closest) to get an accurate district.
nearest AS (
  SELECT facility_id, district, statename
  FROM (
    SELECT
      c.facility_id,
      p.district,
      p.statename,
      ROW_NUMBER() OVER (
        PARTITION BY c.facility_id
        ORDER BY POW(p.lat - c.latitude, 2) + POW(p.lon - c.longitude, 2)
      ) AS rn
    FROM cleaned c
    JOIN pin_centroid p
      ON c.latitude IS NOT NULL
     AND p.lat BETWEEN c.latitude - 0.5 AND c.latitude + 0.5
     AND p.lon BETWEEN c.longitude - 0.5 AND c.longitude + 0.5
  )
  WHERE rn = 1
)
SELECT
  c.*,
  SIZE(c.specialties_clean)                                  AS n_specialties,
  (c.latitude IS NOT NULL)                                   AS geo_valid,
  INITCAP(COALESCE(n.district, ''))                          AS district,
  INITCAP(COALESCE(NULLIF(n.statename, ''), c.state_raw))    AS state
FROM cleaned c
LEFT JOIN nearest n ON c.facility_id = n.facility_id;
