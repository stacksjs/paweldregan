CREATE TABLE IF NOT EXISTS "contacts" (
  "id" BIGSERIAL PRIMARY KEY,
  "name" varchar(255),
  "email" text,
  "message" text,
  "locale" varchar(255) default 'en',
  "ip_address" varchar(255),
  "status" varchar(255) default 'new',
  "replied_at" timestamp,
  "created_at" timestamp not null default CURRENT_TIMESTAMP,
  "updated_at" timestamp,
  "uuid" varchar(255)
);