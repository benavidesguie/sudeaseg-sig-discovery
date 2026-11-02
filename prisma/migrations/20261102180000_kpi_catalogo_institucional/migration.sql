-- Datos del catálogo institucional de indicadores (SUDEASEG)
ALTER TABLE "kpi_catalog"
  ADD COLUMN "responsible_area" VARCHAR(300),
  ADD COLUMN "indicator_type" VARCHAR(100),
  ADD COLUMN "indicator_level" VARCHAR(30),
  ADD COLUMN "target_value" VARCHAR(300),
  ADD COLUMN "data_source" VARCHAR(300),
  ADD COLUMN "strategic_objectives" VARCHAR(100),
  ADD COLUMN "in_management_plan" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "observations" TEXT;
