-- Future PostgreSQL deployment baseline. Not used by the hosted D1 demo.
BEGIN;
CREATE TABLE users (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE user_profiles (user_id text PRIMARY KEY REFERENCES users(id), display_name text);
CREATE TABLE broker_connections (id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), provider text NOT NULL, secret_reference text NOT NULL, status text NOT NULL DEFAULT 'disconnected');
CREATE TABLE trading_accounts (id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), broker_connection_id uuid REFERENCES broker_connections(id), provider_account_id text, currency char(3) NOT NULL DEFAULT 'ZAR', mode text NOT NULL CHECK(mode IN ('demo','live')));
CREATE TABLE watchlists (user_id text NOT NULL REFERENCES users(id), symbol text NOT NULL, PRIMARY KEY(user_id,symbol));
CREATE TABLE user_preferences (user_id text PRIMARY KEY REFERENCES users(id), display_currency char(3) NOT NULL DEFAULT 'ZAR', theme text NOT NULL DEFAULT 'dark', notifications boolean NOT NULL DEFAULT true);
CREATE TABLE notifications (id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), body text NOT NULL, read_at timestamptz);
CREATE TABLE audit_events (id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), event_type text NOT NULL, details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE app_settings (key text PRIMARY KEY, value jsonb NOT NULL);
-- In a future trusted backend, SET LOCAL app.user_id to the verified provider ID
-- inside every transaction; never accept that value from browser input.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_owns_self ON users USING(id = current_setting('app.user_id',true)) WITH CHECK(id = current_setting('app.user_id',true));
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['user_profiles','broker_connections','trading_accounts','watchlists','user_preferences','notifications','audit_events'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('CREATE POLICY owns_record ON %I USING (user_id = current_setting(''app.user_id'',true)) WITH CHECK (user_id = current_setting(''app.user_id'',true))',t); END LOOP; END $$;
-- Use non-owner, non-BYPASSRLS runtime roles; separately restrict app_settings to operators.
REVOKE ALL ON app_settings FROM PUBLIC;
COMMIT;
