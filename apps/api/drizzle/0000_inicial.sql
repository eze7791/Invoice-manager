CREATE TYPE "public"."client_type" AS ENUM('particular', 'empresa');--> statement-breakpoint
CREATE TYPE "public"."invoice_event_type" AS ENUM('creada', 'emitida', 'enviada', 'pagada', 'marcada_impagada', 'rectificada');--> statement-breakpoint
CREATE TYPE "public"."invoice_kind" AS ENUM('ordinaria', 'rectificativa');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('borrador', 'emitida');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('transferencia', 'efectivo');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issuer_id" uuid NOT NULL,
	"type" "client_type" DEFAULT 'particular' NOT NULL,
	"first_name" text,
	"last_name" text,
	"company_name" text,
	"nif" text,
	"email" text,
	"phone" text,
	"street" text,
	"postal_code" text,
	"city" text,
	"province" text,
	"country" text DEFAULT 'España',
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"type" "invoice_event_type" NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"detail" text,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"line_total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issuer_id" uuid NOT NULL,
	"code" text NOT NULL,
	"year" integer NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issuer_id" uuid NOT NULL,
	"client_id" uuid,
	"kind" "invoice_kind" DEFAULT 'ordinaria' NOT NULL,
	"status" "invoice_status" DEFAULT 'borrador' NOT NULL,
	"series_code" text,
	"series_year" integer,
	"number" integer,
	"rectifies_id" uuid,
	"rectification_reason" text,
	"issue_date" date,
	"operation_date" date,
	"due_date" date,
	"issued_at" timestamp with time zone,
	"irpf_rate" numeric(5, 2) DEFAULT '15.00' NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"vat_exemption_text" text,
	"taxable_base" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"vat_total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"irpf_total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"grand_total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"issuer_snapshot" jsonb,
	"client_snapshot" jsonb,
	"notes" text,
	"payment_method" "payment_method",
	"paid_at" timestamp with time zone,
	"paid_method" "payment_method",
	"payment_note" text,
	"sent_at" timestamp with time zone,
	"pdf_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issuers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"trade_name" text,
	"nif" text DEFAULT '' NOT NULL,
	"street" text DEFAULT '' NOT NULL,
	"postal_code" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"province" text DEFAULT '' NOT NULL,
	"country" text DEFAULT 'España' NOT NULL,
	"email" text,
	"phone" text,
	"logo_key" text,
	"bank_holder" text,
	"bank_name" text,
	"iban" text,
	"bank_address" text,
	"default_payment_method" "payment_method" DEFAULT 'transferencia' NOT NULL,
	"default_irpf_rate" numeric(5, 2) DEFAULT '15.00' NOT NULL,
	"vat_exemption_text" text DEFAULT 'Operación exenta de IVA conforme al artículo 20.Uno.3º de la Ley 37/1992' NOT NULL,
	"default_due_days" integer DEFAULT 7 NOT NULL,
	"show_signature" boolean DEFAULT false NOT NULL,
	"signature_text" text,
	"signature_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issuers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issuer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"unit_price" numeric(12, 2) NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_issuer_id_issuers_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_events" ADD CONSTRAINT "invoice_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_series" ADD CONSTRAINT "invoice_series_issuer_id_issuers_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issuer_id_issuers_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_rectifies_id_invoices_id_fk" FOREIGN KEY ("rectifies_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issuers" ADD CONSTRAINT "issuers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_issuer_id_issuers_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clients_issuer_id_idx" ON "clients" USING btree ("issuer_id");--> statement-breakpoint
CREATE INDEX "invoice_events_invoice_id_idx" ON "invoice_events" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_series_unique" ON "invoice_series" USING btree ("issuer_id","code","year");--> statement-breakpoint
CREATE INDEX "invoices_issuer_id_idx" ON "invoices" USING btree ("issuer_id");--> statement-breakpoint
CREATE INDEX "invoices_client_id_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_unique" ON "invoices" USING btree ("issuer_id","series_code","series_year","number") WHERE "invoices"."number" is not null;--> statement-breakpoint
CREATE INDEX "services_issuer_id_idx" ON "services" USING btree ("issuer_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");