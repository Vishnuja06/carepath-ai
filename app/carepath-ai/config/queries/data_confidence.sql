-- Overall information-trust composition, powering the honest-uncertainty
-- footer shown under each Insights chart.
SELECT
  COUNT(*)                                                          AS n_facilities,
  ROUND(AVG(CASE WHEN trust_tier = 'High' THEN 1.0 ELSE 0.0 END) * 100, 1) AS high_pct,
  ROUND(AVG(CASE WHEN SIZE(trust_flags) > 0 THEN 1.0 ELSE 0.0 END) * 100, 1) AS flagged_pct,
  ROUND(AVG(trust_score), 1)                                        AS avg_trust
FROM workspace.carepath_ai.facility_trust;
