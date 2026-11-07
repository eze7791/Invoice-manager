ALTER TABLE "issuers" ADD COLUMN "smtp_user" text;--> statement-breakpoint
ALTER TABLE "issuers" ADD COLUMN "smtp_password_enc" text;--> statement-breakpoint
ALTER TABLE "issuers" ADD COLUMN "email_copy_to_self" boolean DEFAULT false NOT NULL;