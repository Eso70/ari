-- Ari Sponsar - local Postgres schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(120) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name VARCHAR(150) NOT NULL,
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    password_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE TRIGGER update_admins_updated_at
    BEFORE UPDATE ON admins FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    session_expires_at TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_expires ON admin_sessions(session_token, session_expires_at DESC);
CREATE TRIGGER update_admin_sessions_updated_at
    BEFORE UPDATE ON admin_sessions FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE linktrees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subtitle TEXT,
    seo_name VARCHAR(255) UNIQUE NOT NULL,
    uid VARCHAR(50) UNIQUE NOT NULL,
    image TEXT,
    background_color VARCHAR(50) DEFAULT '#ffffff',
    template_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    expire_date TIMESTAMPTZ,
    footer_text TEXT,
    footer_phone VARCHAR(20),
    footer_hidden BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT name_length CHECK (char_length(name) >= 3),
    CONSTRAINT seo_name_length CHECK (char_length(seo_name) >= 3),
    CONSTRAINT uid_length CHECK (char_length(uid) >= 3),
    CONSTRAINT uid_format CHECK (uid ~ '^[a-z0-9-]+$'),
    CONSTRAINT seo_name_format CHECK (seo_name ~ '^[a-z0-9-]+$'),
    CONSTRAINT status_check CHECK (status IN ('Active', 'Expired'))
);
CREATE INDEX idx_linktrees_uid ON linktrees(uid);
CREATE INDEX idx_linktrees_seo_name ON linktrees(seo_name);
CREATE INDEX idx_linktrees_expire_date ON linktrees(expire_date);
CREATE INDEX IF NOT EXISTS idx_linktrees_status ON linktrees(status);
CREATE INDEX idx_linktrees_created_at ON linktrees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_linktrees_template_config ON linktrees USING GIN (template_config);
CREATE TRIGGER update_linktrees_updated_at
    BEFORE UPDATE ON linktrees FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    linktree_id UUID NOT NULL REFERENCES linktrees(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    url TEXT NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    default_message TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT platform_not_empty CHECK (char_length(platform) > 0),
    CONSTRAINT url_not_empty CHECK (char_length(url) > 0),
    CONSTRAINT url_format CHECK (url ~ '^https?://|^tel:|^mailto:|^viber://'),
    CONSTRAINT display_order_positive CHECK (display_order >= 0)
);
CREATE INDEX idx_links_linktree_id ON links(linktree_id);
CREATE INDEX idx_links_platform ON links(platform);
CREATE INDEX idx_links_linktree_order ON links(linktree_id, display_order);
CREATE INDEX idx_links_created_at ON links(created_at DESC);
CREATE TRIGGER update_links_updated_at
    BEFORE UPDATE ON links FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION reorder_links_after_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE links SET display_order = display_order - 1
    WHERE linktree_id = OLD.linktree_id AND display_order > OLD.display_order;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER reorder_links_on_delete
    AFTER DELETE ON links FOR EACH ROW
    EXECUTE FUNCTION reorder_links_after_delete();

CREATE TABLE page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    linktree_id UUID NOT NULL REFERENCES linktrees(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    session_id VARCHAR(255),
    CONSTRAINT ip_address_not_null CHECK (ip_address IS NOT NULL)
);
CREATE INDEX idx_page_views_linktree_date ON page_views(linktree_id, viewed_at DESC);
CREATE INDEX idx_page_views_session_id ON page_views(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_page_views_linktree_session ON page_views(linktree_id, session_id) WHERE session_id IS NOT NULL;

CREATE TABLE link_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    linktree_id UUID NOT NULL REFERENCES linktrees(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    session_id VARCHAR(255),
    CONSTRAINT ip_address_not_null CHECK (ip_address IS NOT NULL)
);
CREATE INDEX idx_link_clicks_linktree_date ON link_clicks(linktree_id, clicked_at DESC);
CREATE INDEX idx_link_clicks_link_id ON link_clicks(link_id);
CREATE INDEX idx_link_clicks_session_id ON link_clicks(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_link_clicks_linktree_session ON link_clicks(linktree_id, session_id) WHERE session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION verify_admin_password(p_username VARCHAR, p_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE stored_hash TEXT; is_valid BOOLEAN;
BEGIN
    SELECT password_hash INTO stored_hash FROM admins WHERE username = p_username;
    IF stored_hash IS NULL THEN RETURN FALSE; END IF;
    SELECT (crypt(p_password, stored_hash) = stored_hash) INTO is_valid;
    RETURN COALESCE(is_valid, FALSE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION authenticate_and_create_session(
    p_username VARCHAR, p_password TEXT, p_session_token TEXT, p_session_expires_at TIMESTAMPTZ,
    p_ip_address INET, p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, admin_id UUID, username VARCHAR, name VARCHAR) AS $$
DECLARE
    v_admin_id UUID; v_password_hash TEXT; v_admin_username VARCHAR; v_admin_name VARCHAR; v_password_valid BOOLEAN;
BEGIN
    SELECT a.id, a.password_hash, a.username, a.name
    INTO v_admin_id, v_password_hash, v_admin_username, v_admin_name FROM admins a WHERE a.username = p_username;
    IF v_admin_id IS NULL OR v_password_hash IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, NULL::VARCHAR; RETURN;
    END IF;
    SELECT (crypt(p_password, v_password_hash) = v_password_hash) INTO v_password_valid;
    IF NOT v_password_valid THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, NULL::VARCHAR; RETURN;
    END IF;
    UPDATE admins SET last_login_at = NOW(), last_login_ip = p_ip_address WHERE id = v_admin_id;
    INSERT INTO admin_sessions (admin_id, session_token, session_expires_at, ip_address, user_agent, last_used_at)
    VALUES (v_admin_id, p_session_token, p_session_expires_at, p_ip_address, p_user_agent, NOW())
    ON CONFLICT (session_token) DO UPDATE SET session_expires_at = EXCLUDED.session_expires_at, last_used_at = NOW();
    RETURN QUERY SELECT TRUE, v_admin_id, v_admin_username, v_admin_name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_session_valid(session_tok TEXT)
RETURNS BOOLEAN AS $$
DECLARE is_valid BOOLEAN;
BEGIN
    SELECT (session_token = session_tok AND session_expires_at > NOW()) INTO is_valid
    FROM admin_sessions WHERE session_token = session_tok;
    RETURN COALESCE(is_valid, FALSE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION logout_admin(session_tok TEXT) RETURNS VOID AS $$
BEGIN DELETE FROM admin_sessions WHERE session_token = session_tok; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_admin_by_session(session_tok TEXT)
RETURNS TABLE (admin_id UUID, username VARCHAR, name VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT a.id, a.username, a.name FROM admins a
    INNER JOIN admin_sessions s ON a.id = s.admin_id
    WHERE s.session_token = session_tok AND s.session_expires_at > NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_admin_password(p_admin_id UUID, p_new_password TEXT) RETURNS VOID AS $$
BEGIN
    UPDATE admins SET password_hash = crypt(p_new_password, gen_salt('bf', 10)), password_changed_at = NOW() WHERE id = p_admin_id;
    DELETE FROM admin_sessions WHERE admin_id = p_admin_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_next_display_order(p_linktree_id UUID) RETURNS INTEGER AS $$
DECLARE max_order INTEGER;
BEGIN SELECT COALESCE(MAX(display_order), -1) + 1 INTO max_order FROM links WHERE linktree_id = p_linktree_id; RETURN max_order; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reorder_links(p_linktree_id UUID, p_link_ids UUID[]) RETURNS VOID AS $$
DECLARE link_id UUID; new_order INTEGER := 0;
BEGIN
    FOREACH link_id IN ARRAY p_link_ids LOOP
        UPDATE links SET display_order = new_order WHERE id = link_id AND linktree_id = p_linktree_id;
        new_order := new_order + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recalculate_all_linktree_counts(p_linktree_id UUID) RETURNS VOID AS $$
DECLARE v_link_id UUID; v_link_clicks INTEGER;
BEGIN
    FOR v_link_id IN SELECT id FROM links WHERE linktree_id = p_linktree_id LOOP
        SELECT COUNT(*)::INTEGER INTO v_link_clicks FROM link_clicks WHERE link_id = v_link_id;
        UPDATE links SET click_count = v_link_clicks WHERE id = v_link_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_all_linktrees_analytics_optimized()
RETURNS TABLE (linktree_id UUID, unique_views BIGINT, unique_clicks BIGINT) AS $$
BEGIN
    RETURN QUERY
    WITH view_stats AS (SELECT pv.linktree_id, COUNT(DISTINCT pv.session_id)::BIGINT AS unique_views FROM page_views pv GROUP BY pv.linktree_id),
    click_stats AS (SELECT lc.linktree_id, COUNT(DISTINCT lc.session_id)::BIGINT AS unique_clicks FROM link_clicks lc GROUP BY lc.linktree_id)
    SELECT lt.id, COALESCE(vs.unique_views, 0)::BIGINT, COALESCE(cs.unique_clicks, 0)::BIGINT
    FROM linktrees lt
    LEFT JOIN view_stats vs ON lt.id = vs.linktree_id LEFT JOIN click_stats cs ON lt.id = cs.linktree_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_total_analytics_optimized()
RETURNS TABLE (total_views BIGINT, unique_views BIGINT, total_clicks BIGINT, unique_clicks BIGINT) AS $$
BEGIN
    RETURN QUERY
    WITH view_stats AS (SELECT COUNT(*)::BIGINT as total_views, COUNT(DISTINCT ip_address)::BIGINT as unique_views FROM page_views),
    click_stats AS (SELECT COUNT(*)::BIGINT as total_clicks, COUNT(DISTINCT ip_address)::BIGINT as unique_clicks FROM link_clicks)
    SELECT vs.total_views, vs.unique_views, cs.total_clicks, cs.unique_clicks FROM view_stats vs CROSS JOIN click_stats cs;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_linktree_analytics_optimized(p_linktree_id UUID)
RETURNS TABLE (total_views BIGINT, unique_views BIGINT, total_clicks BIGINT, unique_clicks BIGINT) AS $$
BEGIN
    RETURN QUERY
    WITH view_stats AS (SELECT COUNT(*)::BIGINT as total_views, COUNT(DISTINCT ip_address)::BIGINT as unique_views FROM page_views WHERE linktree_id = p_linktree_id),
    click_stats AS (SELECT COUNT(*)::BIGINT as total_clicks, COUNT(DISTINCT ip_address)::BIGINT as unique_clicks FROM link_clicks WHERE linktree_id = p_linktree_id)
    SELECT COALESCE(vs.total_views, 0)::BIGINT, COALESCE(vs.unique_views, 0)::BIGINT, COALESCE(cs.total_clicks, 0)::BIGINT, COALESCE(cs.unique_clicks, 0)::BIGINT
    FROM view_stats vs FULL OUTER JOIN click_stats cs ON true;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_linktree_breakdowns_optimized(p_linktree_id UUID)
RETURNS TABLE (views_by_device JSONB, clicks_by_device JSONB, clicks_by_platform JSONB, views_by_referer JSONB, clicks_by_referer JSONB, views_by_os JSONB, clicks_by_os JSONB) AS $$
BEGIN RETURN QUERY SELECT '{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb; END;
$$ LANGUAGE plpgsql;

INSERT INTO admins (username, password_hash, name) VALUES ('ari', crypt('ari.12345', gen_salt('bf', 10)), 'Ari Sponsar')
ON CONFLICT (username) DO UPDATE SET password_hash = crypt('ari.12345', gen_salt('bf', 10)), name = 'Ari Sponsar', updated_at = NOW();

INSERT INTO linktrees (name, subtitle, seo_name, uid, image, background_color, expire_date, footer_text, footer_phone, status, template_config)
VALUES ('Ari Sponsar', 'بۆ پەیوەندی کردن, کلیک لەم لینکانەی خوارەوە بکە', 'ari', 'ari', '/images/Logo.jpg', '#ffffff', '2100-01-01 00:00:00+00'::TIMESTAMPTZ, 'Ari Sponsar', '9647515363453', 'Active', jsonb_build_object('templateKey', 'colorful-pills'))
ON CONFLICT (uid) DO UPDATE SET name = EXCLUDED.name, subtitle = EXCLUDED.subtitle, image = EXCLUDED.image, footer_text = EXCLUDED.footer_text, footer_phone = EXCLUDED.footer_phone, status = EXCLUDED.status, background_color = EXCLUDED.background_color, expire_date = EXCLUDED.expire_date, template_config = COALESCE(linktrees.template_config, '{}'::jsonb) || EXCLUDED.template_config;

DO $$
DECLARE v_linktree_id UUID; v_order INTEGER := 0;
BEGIN
    SELECT id INTO v_linktree_id FROM linktrees WHERE uid = 'ari';
    IF v_linktree_id IS NULL THEN RAISE EXCEPTION 'Failed to create default linktree'; END IF;
    DELETE FROM links WHERE linktree_id = v_linktree_id;
    INSERT INTO links (linktree_id, platform, url, display_name, default_message, display_order, metadata) VALUES (v_linktree_id, 'whatsapp', 'https://wa.me/9647515363453?text=%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%DB%8C%DA%A9%D9%85%20%D8%A8%DB%95%D8%B1%DB%8E%D8%B2%20%D8%A8%DB%8E%20%D8%B2%DB%95%D8%AD%D9%85%DB%95%D8%AA%20%D9%86%D8%B1%D8%AE.', 'واتساپ', '', v_order, '{"original_input": "7515363453", "country_code": "964"}'::jsonb);
    v_order := v_order + 1;
    INSERT INTO links (linktree_id, platform, url, display_name, default_message, display_order, metadata) VALUES (v_linktree_id, 'viber', 'viber://chat?number=9647515363453', 'ڤایبەر', '', v_order, '{"original_input": "7515363453", "country_code": "964"}'::jsonb);
    v_order := v_order + 1;
    INSERT INTO links (linktree_id, platform, url, display_name, display_order, metadata) VALUES (v_linktree_id, 'phone', 'tel:+9647515363453', 'ژمارەی مۆبایل', v_order, '{"original_input": "7515363453", "country_code": "964"}'::jsonb);
END $$;
