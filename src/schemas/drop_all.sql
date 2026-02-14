-- Drop all – local Postgres (run before complete_schema to reset)

SET session_replication_role = 'replica';

DROP TABLE IF EXISTS link_clicks CASCADE;
DROP TABLE IF EXISTS page_views CASCADE;
DROP TABLE IF EXISTS links CASCADE;
DROP TABLE IF EXISTS linktrees CASCADE;
DROP TABLE IF EXISTS admin_sessions CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS reorder_links_after_delete() CASCADE;
DROP FUNCTION IF EXISTS verify_admin_password(VARCHAR, TEXT) CASCADE;
DROP FUNCTION IF EXISTS authenticate_and_create_session(VARCHAR, TEXT, TEXT, TIMESTAMPTZ, INET, TEXT) CASCADE;
DROP FUNCTION IF EXISTS is_session_valid(TEXT) CASCADE;
DROP FUNCTION IF EXISTS logout_admin(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_admin_by_session(TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_admin_password(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_next_display_order(UUID) CASCADE;
DROP FUNCTION IF EXISTS reorder_links(UUID, UUID[]) CASCADE;
DROP FUNCTION IF EXISTS recalculate_all_linktree_counts(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_all_linktrees_analytics_optimized() CASCADE;
DROP FUNCTION IF EXISTS get_total_analytics_optimized() CASCADE;
DROP FUNCTION IF EXISTS get_linktree_analytics_optimized(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_linktree_breakdowns_optimized(UUID) CASCADE;

SET session_replication_role = 'origin';
