-- Database Schema Enhancements for ACID Compliance and Best Practices
-- For Cloudflare D1 (SQLite)

-- ========================================
-- 1. MISSING CONSTRAINTS & NORMALIZATION FIXES
-- ========================================

-- Add check constraints for enum-like fields
ALTER TABLE users ADD CONSTRAINT chk_provider CHECK (provider IN ('google', 'github', 'email'));
ALTER TABLE users ADD CONSTRAINT chk_theme CHECK (theme IN ('light', 'dark', 'system'));

ALTER TABLE teams ADD CONSTRAINT chk_visibility CHECK (visibility IN ('private', 'public'));
ALTER TABLE teams ADD CONSTRAINT chk_plan CHECK (plan IN ('free', 'pro', 'enterprise'));

ALTER TABLE team_members ADD CONSTRAINT chk_role CHECK (role IN ('owner', 'admin', 'member', 'viewer'));
ALTER TABLE team_members ADD CONSTRAINT chk_status CHECK (status IN ('pending', 'active', 'suspended'));

ALTER TABLE apps ADD CONSTRAINT chk_visibility CHECK (visibility IN ('private', 'team', 'board', 'public'));
ALTER TABLE apps ADD CONSTRAINT chk_status CHECK (status IN ('draft', 'generating', 'completed', 'deployed', 'error'));
ALTER TABLE apps ADD CONSTRAINT chk_deployment_status CHECK (deployment_status IN ('none', 'deploying', 'deployed', 'failed'));

ALTER TABLE boards ADD CONSTRAINT chk_visibility CHECK (visibility IN ('public', 'private', 'team_only'));

ALTER TABLE cloudflare_accounts ADD CONSTRAINT chk_validation_status CHECK (validation_status IN ('valid', 'invalid', 'pending'));

-- ========================================
-- 2. MISSING TABLES FOR PROPER NORMALIZATION
-- ========================================

-- Separate table for app tags (many-to-many relationship)
CREATE TABLE IF NOT EXISTS app_tags (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    tag_name TEXT NOT NULL,
    created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(app_id, tag_name)
);
CREATE INDEX idx_app_tags_app_id ON app_tags(app_id);
CREATE INDEX idx_app_tags_tag_name ON app_tags(tag_name);

-- Separate table for app categories (many-to-many relationship)
CREATE TABLE IF NOT EXISTS app_categories (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    category_name TEXT NOT NULL,
    created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(app_id, category_name)
);
CREATE INDEX idx_app_categories_app_id ON app_categories(app_id);
CREATE INDEX idx_app_categories_category ON app_categories(category_name);

-- User favorites as a separate table (better than boolean flag)
CREATE TABLE IF NOT EXISTS user_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, app_id)
);
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_user_favorites_app_id ON user_favorites(app_id);

-- Audit log table for tracking important changes
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_values TEXT, -- JSON
    new_values TEXT, -- JSON
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ========================================
-- 3. TRIGGERS FOR DATA INTEGRITY
-- ========================================

-- Auto-update timestamps
CREATE TRIGGER update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_teams_timestamp 
AFTER UPDATE ON teams
BEGIN
    UPDATE teams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_apps_timestamp 
AFTER UPDATE ON apps
BEGIN
    UPDATE apps SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Maintain denormalized counts
CREATE TRIGGER increment_board_member_count
AFTER INSERT ON board_members
BEGIN
    UPDATE boards SET member_count = member_count + 1 WHERE id = NEW.board_id;
END;

CREATE TRIGGER decrement_board_member_count
AFTER DELETE ON board_members
BEGIN
    UPDATE boards SET member_count = member_count - 1 WHERE id = OLD.board_id;
END;

CREATE TRIGGER increment_board_app_count
AFTER INSERT ON apps
WHEN NEW.board_id IS NOT NULL
BEGIN
    UPDATE boards SET app_count = app_count + 1 WHERE id = NEW.board_id;
END;

CREATE TRIGGER decrement_board_app_count
AFTER DELETE ON apps
WHEN OLD.board_id IS NOT NULL
BEGIN
    UPDATE boards SET app_count = app_count - 1 WHERE id = OLD.board_id;
END;

-- Maintain app statistics
CREATE TRIGGER increment_app_like_count
AFTER INSERT ON app_likes
BEGIN
    UPDATE apps SET like_count = like_count + 1 WHERE id = NEW.app_id;
END;

CREATE TRIGGER decrement_app_like_count
AFTER DELETE ON app_likes
BEGIN
    UPDATE apps SET like_count = like_count - 1 WHERE id = OLD.app_id;
END;

CREATE TRIGGER increment_app_view_count
AFTER INSERT ON app_views
BEGIN
    UPDATE apps SET view_count = view_count + 1 WHERE id = NEW.app_id;
END;

-- ========================================
-- 4. VIEWS FOR COMMON QUERIES
-- ========================================

-- User profile with stats
CREATE VIEW IF NOT EXISTS user_profiles AS
SELECT 
    u.*,
    COUNT(DISTINCT a.id) as app_count,
    COUNT(DISTINCT uf.app_id) as favorite_count,
    COUNT(DISTINCT tm.team_id) as team_count,
    COUNT(DISTINCT bm.board_id) as board_count
FROM users u
LEFT JOIN apps a ON u.id = a.user_id
LEFT JOIN user_favorites uf ON u.id = uf.user_id
LEFT JOIN team_members tm ON u.id = tm.user_id AND tm.status = 'active'
LEFT JOIN board_members bm ON u.id = bm.user_id
WHERE u.deleted_at IS NULL
GROUP BY u.id;

-- App with full details
CREATE VIEW IF NOT EXISTS app_details AS
SELECT 
    a.*,
    u.display_name as user_display_name,
    u.avatar_url as user_avatar_url,
    t.name as team_name,
    b.name as board_name,
    b.slug as board_slug
FROM apps a
LEFT JOIN users u ON a.user_id = u.id
LEFT JOIN teams t ON a.team_id = t.id
LEFT JOIN boards b ON a.board_id = b.id;

-- ========================================
-- 5. ADDITIONAL INDEXES FOR PERFORMANCE
-- ========================================

-- Composite indexes for common queries
CREATE INDEX idx_apps_user_visibility ON apps(user_id, visibility);
CREATE INDEX idx_apps_team_visibility ON apps(team_id, visibility);
CREATE INDEX idx_apps_created_at_desc ON apps(created_at DESC);
CREATE INDEX idx_sessions_user_expires ON sessions(user_id, expires_at);
CREATE INDEX idx_team_members_user_status ON team_members(user_id, status);

-- ========================================
-- 6. DATA MIGRATION NOTES
-- ========================================

-- Migrate existing tags/categories from JSON to normalized tables
-- This would be done in a migration script:
-- INSERT INTO app_tags (id, app_id, tag_name)
-- SELECT 
--     lower(hex(randomblob(16))) as id,
--     id as app_id,
--     json_each.value as tag_name
-- FROM apps, json_each(apps.tags)
-- WHERE apps.tags IS NOT NULL AND apps.tags != '[]';

-- Similar migration for categories and favorites