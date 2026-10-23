// Datos de demostración (ficticios) para probar el portal de punta a punta.
// NO ejecutar en el ambiente del cliente: sobrescribe nombres y fichas de los sistemas.
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { SYSTEM_CODES } from "../src/lib/catalogs";
import { computeWave } from "../src/lib/waves";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Demo12345!";

const NAMES = [
  "ERP Contable", "CRM Comercial", "Facturación Electrónica", "Punto de Venta Sucursales", "Nómina",
  "Gestión de Almacén", "Transporte y Despachos", "Mesa de Ayuda", "Tesorería", "Presupuesto (Excel)",
  "Compras", "Inventario", "Portal de Clientes", "Call Center", "BI Legado", "Activos Fijos",
  "Cobranzas", "Marketing SaaS", "Gestión Documental", "Control de Calidad", "Mantenimiento", "Reclamos",
];

const contact = (name: string, role: string, email: string) => ({ name, role, email, phone: "+58 212 555 0000" });

async function user(email: string, name: string, role: "ADMIN" | "BUSINESS" | "TECH") {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) },
  });
}

async function main() {
  const admin = await user("admin@demo.local", "Consultor BI (demo)", "ADMIN");
  const biz = await user("negocio@demo.local", "Líder Funcional (demo)", "BUSINESS");
  const tech = await user("ti@demo.local", "Custodio Técnico (demo)", "TECH");

  for (const [i, systemCode] of SYSTEM_CODES.entries()) {
    await prisma.systemInventory.upsert({
      where: { systemCode },
      update: { commonName: NAMES[i], spocBusinessId: biz.id, spocTechId: tech.id },
      create: { systemCode, commonName: NAMES[i], spocBusinessId: biz.id, spocTechId: tech.id },
    });
  }

  type Profile = {
    code: string;
    domain: string;
    crit: string;
    access: string;
    solution: string;
    engine: string;
    hosting: string;
    pattern?: string;
    vendor?: { vendor_name: string; vendor_contact_email: string; has_active_support_contract: boolean; requires_extra_fee: string };
  };
  const profiles: Profile[] = [
    { code: "SIS-01", domain: "FINANZAS", crit: "ALTA", access: "DB_ONLY", solution: "ERP", engine: "SQL_SERVER", hosting: "ON_PREMISE", pattern: "TYPE_A_DIRECT_DB" },
    { code: "SIS-02", domain: "COMERCIAL", crit: "ALTA", access: "API_ONLY", solution: "CRM", engine: "UNKNOWN_SAAS", hosting: "SAAS_CLOUD", pattern: "TYPE_B_API" },
    { code: "SIS-03", domain: "FINANZAS", crit: "ALTA", access: "RESTRICTED_VENDOR", solution: "THIRD_PARTY_ONPREM", engine: "ORACLE", hosting: "ON_PREMISE",
      vendor: { vendor_name: "Proveedor Ejemplo C.A.", vendor_contact_email: "soporte@proveedor.example", has_active_support_contract: true, requires_extra_fee: "POR_CONFIRMAR" } },
    { code: "SIS-04", domain: "OPERACIONES", crit: "MEDIA", access: "TOTAL", solution: "CUSTOM_INHOUSE", engine: "POSTGRESQL", hosting: "PRIVATE_CLOUD_VPS", pattern: "TYPE_A_DIRECT_DB" },
    { code: "SIS-05", domain: "RRHH", crit: "BAJA", access: "MANUAL_EXPORT", solution: "THIRD_PARTY_ONPREM", engine: "FLAT_FILES_DBF_CSV", hosting: "ON_PREMISE" },
    { code: "SIS-10", domain: "FINANZAS", crit: "ALTA", access: "TOTAL", solution: "CRITICAL_SPREADSHEET", engine: "EXCEL", hosting: "LOCAL_SHARED_FOLDER", pattern: "TYPE_D_CONTROLLED_MANUAL" },
  ];
  for (const p of profiles) {
    const name = NAMES[SYSTEM_CODES.indexOf(p.code)];
    await prisma.systemInventory.update({
      where: { systemCode: p.code },
      data: {
        officialName: name,
        businessDomain: p.domain,
        userDepartments: ["Administración", "Gerencia"],
        activeUsersRange: "11-50",
        kpiCriticality: p.crit,
        businessOwner: contact("Dueño Funcional Demo", "Gerente", "dueno@demo.local"),
        techCustodian: contact("Custodio Técnico Demo", "DBA", "dba@demo.local"),
        solutionType: p.solution,
        accessLevel: p.access,
        vendorInfo: p.vendor ?? undefined,
        vendorRiskAlert: p.access === "RESTRICTED_VENDOR",
        hostingType: p.hosting,
        dbEngine: p.engine,
        docStatus: ["NONE"],
        phase1Status: "COMPLETED",
        ...(p.pattern
          ? {
              integrationPattern: p.pattern,
              networkRequirements: ["VPN_SITE_TO_SITE"],
              supportsIncrementalLoad: true,
              historicalVolumeEstimate: "1M_10M",
              extractionWindow: "01:00 AM - 04:00 AM",
              phase3Status: "COMPLETED",
            }
          : {}),
        waveNumber: computeWave({ kpiCriticality: p.crit, accessLevel: p.access, integrationPattern: p.pattern }),
      },
    });
  }

  if ((await prisma.kpiCatalog.count()) === 0) {
    await prisma.kpiCatalog.create({
      data: {
        kpiCode: "KPI-FIN-01",
        kpiName: "Cumplimiento de presupuesto de ventas",
        businessDomain: "FINANZAS",
        kpiObjective: "Decidir ajustes de metas comerciales por sucursal a mitad de mes.",
        unitOfMeasure: "PERCENTAGE",
        frequency: "MONTHLY",
        trendDirection: "UP_IS_BETTER",
        calculationFormula: "(Ventas Netas / Presupuesto) * 100",
        businessRules: "Excluir facturas anuladas y ventas intercompañía.",
        dimensions: ["TIEMPO", "SUCURSAL_SEDE"],
        currentCalculationMethod: "MANUAL_EXCEL_CROSSING",
        createdById: biz.id,
        variables: {
          create: [
            { position: 0, varName: "Ventas netas", sourceSystemCode: "SIS-01", screenModuleName: "Ventas > Facturación > Consulta", sampleTransactionId: "FAC-004512" },
            { position: 1, varName: "Presupuesto mensual", sourceSystemCode: "SIS-10", screenModuleName: "Hoja Presupuesto 2026 > Pestaña Ventas", sampleTransactionId: "PPTO-2026-03" },
          ],
        },
      },
    });
    await prisma.kpiCatalog.create({
      data: {
        kpiCode: "KPI-COM-01",
        kpiName: "Tasa de conversión de oportunidades",
        businessDomain: "COMERCIAL",
        kpiObjective: "Priorizar la cartera de oportunidades y el seguimiento de vendedores.",
        unitOfMeasure: "PERCENTAGE",
        frequency: "WEEKLY",
        trendDirection: "UP_IS_BETTER",
        calculationFormula: "Oportunidades ganadas / Oportunidades creadas",
        businessRules: "Solo oportunidades con monto mayor a cero.",
        dimensions: ["TIEMPO", "VENDEDOR_RESPONSABLE", "CANAL_VENTA"],
        currentCalculationMethod: "NATIVE_REPORT",
        createdById: biz.id,
        variables: {
          create: [{ position: 0, varName: "Oportunidades ganadas", sourceSystemCode: "SIS-02", screenModuleName: "Ventas > Oportunidades", sampleTransactionId: "OPP-88231" }],
        },
      },
    });
  }

  // Esquema de ejemplo para SIS-01
  if ((await prisma.systemRawSchema.count({ where: { systemCode: "SIS-01" } })) === 0) {
    const cols = [
      ["ventas", "facturas", "id_factura", "int", "NO", null],
      ["ventas", "facturas", "numero", "varchar", "NO", 20],
      ["ventas", "facturas", "fecha_emision", "datetime", "NO", null],
      ["ventas", "facturas", "monto_neto", "decimal", "NO", null],
      ["ventas", "facturas", "estado", "varchar", "NO", 10],
      ["ventas", "facturas", "updated_at", "datetime", "YES", null],
      ["ventas", "sucursales", "id_sucursal", "int", "NO", null],
      ["ventas", "sucursales", "codigo", "varchar", "NO", 5],
    ] as const;
    await prisma.systemRawSchema.createMany({
      data: cols.map(([tableSchema, tableName, columnName, dataType, isNullable, charMaxLength], i) => ({
        systemCode: "SIS-01", tableSchema, tableName, columnName, dataType, isNullable, charMaxLength, ordinal: i + 1,
      })),
    });
    await prisma.systemInventory.update({ where: { systemCode: "SIS-01" }, data: { phase2SchemaUploaded: true, phase2SchemaUpdatedAt: new Date() } });
  }

  if ((await prisma.masterDataMapping.count()) === 0) {
    await prisma.masterDataMapping.createMany({
      data: [
        { masterEntity: "SUCURSALES", canonicalCode: "CCS", canonicalName: "Caracas Centro", systemEquivalences: { "SIS-01": "001", "SIS-04": "CCS" }, position: 0 },
        { masterEntity: "SUCURSALES", canonicalCode: "VAL", canonicalName: "Valencia", systemEquivalences: { "SIS-01": "002", "SIS-04": "VLN" }, position: 1 },
      ],
    });
  }

  await prisma.projectSettings.upsert({
    where: { id: 1 },
    update: { catalogConfirmedAt: new Date(), catalogConfirmedBy: admin.name },
    create: { id: 1, catalogConfirmedAt: new Date(), catalogConfirmedBy: admin.name },
  });
  console.log(`Datos demo cargados. Usuarios: admin@demo.local, negocio@demo.local, ti@demo.local (clave ${DEMO_PASSWORD})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
