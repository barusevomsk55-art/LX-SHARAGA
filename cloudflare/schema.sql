CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL UNIQUE,
 state_json TEXT NOT NULL DEFAULT '{}',
 timezone TEXT NOT NULL DEFAULT 'UTC',
 telegram_chat_id TEXT UNIQUE,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pair_codes (
 code TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK(purpose IN ('device','telegram')),
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_logs (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 event_key TEXT NOT NULL,
 sent_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,event_key)
);
CREATE INDEX IF NOT EXISTS idx_pair_expiry ON pair_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_chat_id);