CREATE TABLE IF NOT EXISTS otp_codes (
  phone_hash TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at INTEGER
);

CREATE TABLE IF NOT EXISTS otp_send_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  sent_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS otp_send_log_phone_sent_at
  ON otp_send_log (phone_hash, sent_at);

CREATE INDEX IF NOT EXISTS otp_send_log_ip_sent_at
  ON otp_send_log (ip_hash, sent_at);
