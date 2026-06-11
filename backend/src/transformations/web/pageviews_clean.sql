-- ═══════════════════════════════════════════════════════════════
-- TRANSFORM: pageviews_clean
-- Source: ${dataset}_landing.pageviews
-- Target: ${dataset}.pageviews_clean (materialized view)
-- Schedule: every 15 minutes
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE MATERIALIZED VIEW `${dataset}`.pageviews_clean AS
SELECT
  -- Identity
  visitor_id,
  page_url,
  
  -- Normalized timestamp
  TIMESTAMP(timestamp) AS timestamp,
  DATE(TIMESTAMP(timestamp)) AS date,
  EXTRACT(HOUR FROM TIMESTAMP(timestamp)) AS hour,
  
  -- Clean dimensions
  COALESCE(NULLIF(country, ''), 'Unknown') AS country,
  COALESCE(NULLIF(browser, ''), 'Other') AS browser,
  COALESCE(NULLIF(referrer, ''), 'Direct') AS referrer,
  
  -- Session key: grouped by visitor + 30-minute inactivity gap
  CONCAT(
    visitor_id, '_',
    SUM(
      IF(TIMESTAMP_DIFF(TIMESTAMP(timestamp), 
        LAG(TIMESTAMP(timestamp)) OVER (
          PARTITION BY visitor_id ORDER BY TIMESTAMP(timestamp)
        ), MINUTE) > 30 OR
        LAG(TIMESTAMP(timestamp)) OVER (
          PARTITION BY visitor_id ORDER BY TIMESTAMP(timestamp)
        ) IS NULL,
      1, 0)
    ) OVER (PARTITION BY visitor_id ORDER BY TIMESTAMP(timestamp))
  ) AS session_id,
  
  -- Device type from user agent (basic)
  CASE 
    WHEN LOWER(user_agent) LIKE '%mobile%' OR LOWER(user_agent) LIKE '%android%' OR LOWER(user_agent) LIKE '%iphone%' THEN 'Mobile'
    WHEN LOWER(user_agent) LIKE '%tablet%' OR LOWER(user_agent) LIKE '%ipad%' THEN 'Tablet'
    ELSE 'Desktop'
  END AS device_type

FROM `${dataset}_landing`.pageviews
WHERE visitor_id IS NOT NULL
  AND timestamp IS NOT NULL
  AND page_url IS NOT NULL;
