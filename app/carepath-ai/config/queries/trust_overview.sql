-- Trust-tier distribution across all facilities, for the overview KPIs.
SELECT
  trust_tier,
  COUNT(*) AS n_facilities,
  ROUND(AVG(trust_score), 1) AS avg_score
FROM workspace.carepath_ai.facility_trust
GROUP BY trust_tier
ORDER BY CASE trust_tier WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END;
