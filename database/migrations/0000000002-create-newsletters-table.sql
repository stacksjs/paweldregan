CREATE TABLE IF NOT EXISTS "newsletters" (
  "id" BIGSERIAL PRIMARY KEY,
  "email" varchar(255),
  "status" varchar(255) default 'subscribed',
  "locale" varchar(255) default 'en',
  "source" varchar(255) default 'footer',
  "unsubscribed_at" timestamp,
  "created_at" timestamp not null default CURRENT_TIMESTAMP,
  "updated_at" timestamp,
  "uuid" varchar(255)
);