CREATE TABLE IF NOT EXISTS "contacts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "email" TEXT not null,
  "message" TEXT not null,
  "locale" TEXT default 'en',
  "ip_address" TEXT,
  "status" TEXT default 'new',
  "replied_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);