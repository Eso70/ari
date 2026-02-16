-- Update get_total_analytics_optimized to remove DISTINCT IP counting
-- Run this on your existing database to update totals to show all views/clicks (not unique)
-- This does NOT drop any data, only updates the function

CREATE OR REPLACE FUNCTION get_total_analytics_optimized()
RETURNS TABLE (total_views BIGINT, unique_views BIGINT, total_clicks BIGINT, unique_clicks BIGINT) AS $$
BEGIN
    RETURN QUERY
    WITH view_stats AS (SELECT COUNT(*)::BIGINT as total_views, COUNT(*)::BIGINT as unique_views FROM page_views),
    click_stats AS (SELECT COUNT(*)::BIGINT as total_clicks, COUNT(*)::BIGINT as unique_clicks FROM link_clicks)
    SELECT vs.total_views, vs.unique_views, cs.total_clicks, cs.unique_clicks FROM view_stats vs CROSS JOIN click_stats cs;
END;
$$ LANGUAGE plpgsql;
