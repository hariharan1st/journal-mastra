-- Dynamic journal table template
-- Used by dynamic-table-manager.ts to create/alter journal tables at runtime
-- This template defines the base columns that must exist on every journal table

-- Base columns (shared across all dynamic journal tables)
CREATE TABLE IF NOT EXISTS journal_{{SLUG}} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  who_recorded UUID REFERENCES caregiver_profiles(id),
  source_message_id TEXT,
  submitted_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  health_week_label TEXT CHECK (health_week_label IN ('healthy', 'unhealthy', 'unspecified')) DEFAULT 'unspecified',
  meta JSONB DEFAULT '{}',
  
  -- Category-specific columns will be added here via ALTER TABLE statements
  -- based on tracking_catalogue_fields definitions
  
  -- Indexes for common query patterns
  CONSTRAINT journal_{{SLUG}}_user_recorded_idx UNIQUE (user_id, recorded_at DESC),
  CONSTRAINT journal_{{SLUG}}_recorded_idx UNIQUE (recorded_at DESC)
);

-- Row-level security policies (to be enabled when RLS is implemented)
-- ALTER TABLE journal_{{SLUG}} ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY journal_{{SLUG}}_user_access ON journal_{{SLUG}} 
--   FOR ALL TO authenticated 
--   USING (user_id = auth.uid() OR EXISTS (
--     SELECT 1 FROM caregiver_profiles cp 
--     WHERE cp.id = auth.uid() AND cp.role IN ('admin', 'caregiver')
--   ));