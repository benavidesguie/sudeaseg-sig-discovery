-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'BUSINESS', 'TECH');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "catalog_confirmed_at" TIMESTAMP(3),
    "catalog_confirmed_by" TEXT,

    CONSTRAINT "project_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "systems_inventory" (
    "id" UUID NOT NULL,
    "system_code" VARCHAR(10) NOT NULL,
    "common_name" VARCHAR(150),
    "spoc_business_id" UUID,
    "spoc_tech_id" UUID,
    "official_name" VARCHAR(150),
    "internal_alias" VARCHAR(150),
    "version" VARCHAR(50),
    "business_domain" VARCHAR(50),
    "user_departments" JSONB NOT NULL DEFAULT '[]',
    "active_users_range" VARCHAR(30),
    "kpi_criticality" VARCHAR(20),
    "business_owner" JSONB,
    "tech_custodian" JSONB,
    "solution_type" VARCHAR(50),
    "access_level" VARCHAR(50),
    "vendor_info" JSONB,
    "hosting_type" VARCHAR(50),
    "db_engine" VARCHAR(50),
    "tech_stack" VARCHAR(100),
    "doc_status" JSONB NOT NULL DEFAULT '[]',
    "integration_pattern" VARCHAR(50),
    "network_requirements" JSONB NOT NULL DEFAULT '[]',
    "supports_incremental_load" BOOLEAN,
    "historical_volume_estimate" VARCHAR(50),
    "extraction_window" VARCHAR(100),
    "phase1_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "phase2_schema_uploaded" BOOLEAN NOT NULL DEFAULT false,
    "phase2_schema_uploaded_at" TIMESTAMP(3),
    "phase3_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "wave_number" INTEGER,
    "vendor_risk_alert" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "systems_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_raw_schemas" (
    "id" UUID NOT NULL,
    "system_code" VARCHAR(10) NOT NULL,
    "table_schema" VARCHAR(100),
    "table_name" VARCHAR(150) NOT NULL,
    "column_name" VARCHAR(150) NOT NULL,
    "data_type" VARCHAR(100) NOT NULL,
    "is_nullable" VARCHAR(10),
    "char_max_length" INTEGER,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_raw_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_catalog" (
    "id" UUID NOT NULL,
    "kpi_code" VARCHAR(30) NOT NULL,
    "kpi_name" VARCHAR(200) NOT NULL,
    "business_domain" VARCHAR(50) NOT NULL,
    "kpi_objective" TEXT,
    "unit_of_measure" VARCHAR(30),
    "frequency" VARCHAR(30),
    "trend_direction" VARCHAR(30),
    "calculation_formula" TEXT,
    "business_rules" TEXT,
    "dimensions" JSONB NOT NULL DEFAULT '[]',
    "current_calculation_method" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_source_variables" (
    "id" UUID NOT NULL,
    "kpi_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "var_name" VARCHAR(150) NOT NULL DEFAULT '',
    "source_system_code" VARCHAR(10),
    "screen_module_name" VARCHAR(200) NOT NULL DEFAULT '',
    "sample_transaction_id" VARCHAR(100) NOT NULL DEFAULT '',
    "exists_in_other_system" BOOLEAN NOT NULL DEFAULT false,
    "is_system_of_record" BOOLEAN NOT NULL DEFAULT true,
    "physical_table_name" VARCHAR(150),
    "physical_column_name" VARCHAR(150),
    "primary_key_column" VARCHAR(150),
    "incremental_date_column" VARCHAR(150),
    "transformation_rule" TEXT,
    "mapped_at" TIMESTAMP(3),

    CONSTRAINT "kpi_source_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data_mappings" (
    "id" UUID NOT NULL,
    "master_entity" VARCHAR(50) NOT NULL,
    "canonical_code" VARCHAR(50) NOT NULL,
    "canonical_name" VARCHAR(150) NOT NULL,
    "system_equivalences" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_data_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "system_code" VARCHAR(10),
    "kpi_id" UUID,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" VARCHAR(255) NOT NULL,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(60) NOT NULL,
    "entity" VARCHAR(40) NOT NULL,
    "entity_ref" VARCHAR(60) NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "systems_inventory_system_code_key" ON "systems_inventory"("system_code");

-- CreateIndex
CREATE INDEX "system_raw_schemas_system_code_table_name_idx" ON "system_raw_schemas"("system_code", "table_name");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_catalog_kpi_code_key" ON "kpi_catalog"("kpi_code");

-- CreateIndex
CREATE INDEX "kpi_source_variables_source_system_code_idx" ON "kpi_source_variables"("source_system_code");

-- CreateIndex
CREATE UNIQUE INDEX "master_data_mappings_master_entity_canonical_code_key" ON "master_data_mappings"("master_entity", "canonical_code");

-- CreateIndex
CREATE INDEX "attachments_system_code_idx" ON "attachments"("system_code");

-- CreateIndex
CREATE INDEX "attachments_kpi_id_idx" ON "attachments"("kpi_id");

-- CreateIndex
CREATE INDEX "activity_log_created_at_idx" ON "activity_log"("created_at");

-- AddForeignKey
ALTER TABLE "systems_inventory" ADD CONSTRAINT "systems_inventory_spoc_business_id_fkey" FOREIGN KEY ("spoc_business_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "systems_inventory" ADD CONSTRAINT "systems_inventory_spoc_tech_id_fkey" FOREIGN KEY ("spoc_tech_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_raw_schemas" ADD CONSTRAINT "system_raw_schemas_system_code_fkey" FOREIGN KEY ("system_code") REFERENCES "systems_inventory"("system_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_source_variables" ADD CONSTRAINT "kpi_source_variables_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "kpi_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_source_variables" ADD CONSTRAINT "kpi_source_variables_source_system_code_fkey" FOREIGN KEY ("source_system_code") REFERENCES "systems_inventory"("system_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_system_code_fkey" FOREIGN KEY ("system_code") REFERENCES "systems_inventory"("system_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "kpi_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
