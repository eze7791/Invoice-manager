CREATE TABLE "usage_counters" (
	"scope" text NOT NULL,
	"day" date NOT NULL,
	"kind" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_counters_scope_day_kind_pk" PRIMARY KEY("scope","day","kind")
);
