CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE identity_provider AS ENUM ('manual', 'google');
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE transaction_source AS ENUM ('gmail', 'manual');
CREATE TYPE sync_status AS ENUM ('running', 'success', 'failed');
CREATE TYPE budget_period AS ENUM ('monthly');
CREATE TYPE goal_status AS ENUM ('active', 'paused', 'completed', 'cancelled');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email CITEXT NOT NULL UNIQUE,
    full_name TEXT,
    locale TEXT NOT NULL DEFAULT 'es-CL',
    timezone TEXT NOT NULL DEFAULT 'America/Santiago',
    currency_code TEXT NOT NULL DEFAULT 'CLP',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider identity_provider NOT NULL,
    provider_user_id TEXT,
    password_hash TEXT,
    refresh_token_hash TEXT,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT manual_password_required CHECK (
        (provider = 'manual' AND password_hash IS NOT NULL)
        OR provider <> 'manual'
    ),
    CONSTRAINT provider_uniqueness UNIQUE (provider, provider_user_id)
);

CREATE TABLE email_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider identity_provider NOT NULL DEFAULT 'google',
    email_address CITEXT NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    scope TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    gmail_history_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT gmail_only_provider CHECK (provider = 'google'),
    CONSTRAINT email_connection_unique UNIQUE (user_id, email_address)
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    color_hex TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_connection_id UUID REFERENCES email_connections(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    type transaction_type NOT NULL,
    source transaction_source NOT NULL,
    amount_clp BIGINT NOT NULL CHECK (amount_clp > 0),
    occurred_at TIMESTAMPTZ NOT NULL,
    merchant TEXT,
    counterpart TEXT,
    subject TEXT,
    raw_glosa TEXT NOT NULL,
    normalized_glosa TEXT,
    external_message_id TEXT,
    reference_number TEXT,
    dedupe_hash TEXT NOT NULL,
    parser_version TEXT,
    is_user_categorized BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT transaction_unique_per_user_hash UNIQUE (user_id, dedupe_hash)
);

CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    period budget_period NOT NULL DEFAULT 'monthly',
    year SMALLINT NOT NULL CHECK (year >= 2020),
    month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
    amount_limit_clp BIGINT NOT NULL CHECK (amount_limit_clp > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT budget_unique UNIQUE (user_id, category_id, period, year, month)
);

CREATE TABLE saving_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount_clp BIGINT NOT NULL CHECK (target_amount_clp > 0),
    monthly_contribution_clp BIGINT NOT NULL CHECK (monthly_contribution_clp > 0),
    current_amount_clp BIGINT NOT NULL DEFAULT 0 CHECK (current_amount_clp >= 0),
    target_date DATE,
    status goal_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE goal_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id UUID NOT NULL REFERENCES saving_goals(id) ON DELETE CASCADE,
    amount_clp BIGINT NOT NULL CHECK (amount_clp <> 0),
    contributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source transaction_source NOT NULL DEFAULT 'manual',
    note TEXT
);

CREATE TABLE sync_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_connection_id UUID REFERENCES email_connections(id) ON DELETE SET NULL,
    status sync_status NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    fetched_emails_count INTEGER NOT NULL DEFAULT 0,
    created_transactions_count INTEGER NOT NULL DEFAULT 0,
    duplicates_count INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,
    error_summary TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    ip_address INET,
    user_agent TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_date ON transactions (user_id, occurred_at DESC);
CREATE UNIQUE INDEX idx_categories_user_lower_name ON categories (user_id, LOWER(name));
CREATE INDEX idx_transactions_user_type_date ON transactions (user_id, type, occurred_at DESC);
CREATE INDEX idx_transactions_user_category_date ON transactions (user_id, category_id, occurred_at DESC);
CREATE INDEX idx_transactions_source ON transactions (source);
CREATE INDEX idx_transactions_message_id ON transactions (external_message_id);
CREATE INDEX idx_sync_runs_user_started ON sync_runs (user_id, started_at DESC);
CREATE INDEX idx_audit_logs_user_created ON audit_logs (user_id, created_at DESC);
