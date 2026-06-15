-- @param district STRING
-- District health context (NFHS-5) for the Uncertainty Engine.
SELECT
  district_name,
  state_ut,
  institutional_birth_5y_pct,
  births_attended_by_skilled_hp_5y_10_pct,
  all_w15_49_who_are_anaemic_pct,
  hh_improved_water_pct,
  hh_use_improved_sanitation_pct,
  hh_member_covered_health_insurance_pct,
  women_age_15_49_who_are_literate_pct
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.nfhs_5_district_health_indicators
WHERE UPPER(TRIM(district_name)) = UPPER(TRIM(:district))
LIMIT 1;
