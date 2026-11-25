DROP INDEX "invoices_number_unique";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "number_label" text;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_label_unique" ON "invoices" USING btree ("issuer_id",lower("number_label")) WHERE "invoices"."number_label" is not null and "invoices"."status" = 'emitida';--> statement-breakpoint
-- Facturas ya emitidas: guardan como número visible el que mostraban (p. ej. "2026-0001").
UPDATE "invoices" SET "number_label" = coalesce("series_code", '') || "series_year" || '-' || lpad("number"::text, 4, '0')
WHERE "number" IS NOT NULL AND "number_label" IS NULL;
--> statement-breakpoint
-- Contador único sin año (year = 0): continúa desde el mayor número ya usado en cada serie.
INSERT INTO "invoice_series" ("issuer_id", "code", "year", "next_number")
SELECT "issuer_id", "code", 0, max("next_number") FROM "invoice_series" WHERE "year" <> 0 GROUP BY "issuer_id", "code"
ON CONFLICT DO NOTHING;
