-- ═══════════════════════════════════════════════════════════════
-- TRANSFORM: conversions_clean
-- Source: ${dataset}_landing.conversions
-- Target: ${dataset}.conversions_clean (view)
-- Schedule: every 15 minutes
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW `${dataset}`.conversions_clean AS
SELECT
  -- Identity
  conversion_id,
  visitor_id,
  
  -- Normalized timestamps
  TIMESTAMP(conversion_time) AS conversion_time,
  DATE(TIMESTAMP(conversion_time)) AS date,
  EXTRACT(MONTH FROM TIMESTAMP(conversion_time)) AS month,
  
  -- Clean amounts
  COALESCE(amount, 0) AS amount,
  COALESCE(currency, 'USD') AS currency,
  
  -- Type + status
  COALESCE(NULLIF(conversion_type, ''), 'purchase') AS conversion_type,
  COALESCE(NULLIF(status, ''), 'completed') AS status,
  
  -- Source attribution (last non-direct click)
  COALESCE(NULLIF(source, ''), NULLIF(utm_source, ''), 'Direct') AS source,
  COALESCE(NULLIF(medium, ''), NULLIF(utm_medium, ''), 'none') AS medium,
  COALESCE(NULLIF(campaign, ''), NULLIF(utm_campaign, ''), 'none') AS campaign,
  
  -- Revenue after refunds
  CASE WHEN status = 'refunded' THEN -ABS(amount) ELSE amount END AS net_revenue

FROM `${dataset}_landing`.conversions
WHERE conversion_id IS NOT NULL
  AND conversion_time IS NOT NULL;
