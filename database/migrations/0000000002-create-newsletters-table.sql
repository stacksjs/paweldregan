CREATE TABLE IF NOT EXISTS "newsletters" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "email" TEXT,
  "status" TEXT default 'subscribed',
  "locale" TEXT default 'en',
  "source" TEXT default 'footer',
  "unsubscribed_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);