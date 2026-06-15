-- @param pincode BIGINT
-- Resolve a patient pincode to coordinates + district for display/validation.
SELECT
  pincode,
  district,
  state,
  latitude,
  longitude
FROM workspace.carepath_ai.pincode_geo
WHERE pincode = CAST(:pincode AS BIGINT)
LIMIT 1;
