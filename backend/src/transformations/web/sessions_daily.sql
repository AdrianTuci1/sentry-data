-- ═══════════════════════════════════════════════════════════════
-- TRANSFORM: sessions_daily
-- Source: ${dataset}.pageviews_clean
-- Target: ${dataset}.sessions_daily (table, incremental)
-- Schedule: every hour, appends new rows
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE TABLE `${dataset}`.sessions_daily AS
SELECT
  date,
  country,
  browser,
  device_type,
  
  -- Session metrics
  COUNT(DISTINCT session_id) AS sessions,
  COUNT(DISTINCT visitor_id) AS unique_visitors,
  COUNT(*) AS pageviews,
  
  -- Engagement
  COUNT(DISTINCT page_url) AS unique_pages,
  COUNT(*) / NULLIF(COUNT(DISTINCT session_id), 0) AS pages_per_session,
  
  -- Bounce rate: sessions with 1 pageview
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN pageview_count = 1 THEN session_id END),
    COUNT(DISTINCT session_id)
  ) * 100 AS bounce_rate

FROM (
  SELECT 
    *,
    COUNT(*) OVER (PARTITION BY session_id) AS pageview_count
  FROM `${dataset}`.pageviews_clean
)
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY 1, 2, 3, 4;
