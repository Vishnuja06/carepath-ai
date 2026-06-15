-- Distinct specialties available across facilities, for the patient-need picker.
SELECT
  specialty,
  COUNT(*) AS n_facilities
FROM (
  SELECT EXPLODE(specialties_clean) AS specialty
  FROM workspace.carepath_ai.facilities_silver
)
WHERE specialty IS NOT NULL AND TRIM(specialty) <> ''
GROUP BY specialty
HAVING COUNT(*) >= 5
ORDER BY n_facilities DESC, specialty;
