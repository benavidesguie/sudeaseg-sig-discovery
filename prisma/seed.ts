// Seed inicial: crea el usuario administrador y los códigos del catálogo semilla (SIS-01..SIS-NN, según TOTAL_SYSTEMS).
// Es idempotente: no sobrescribe datos existentes.
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { SYSTEM_CODES } from "../src/lib/catalogs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 10) throw new Error("Defina ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 10 caracteres) en .env");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: { email, name: process.env.ADMIN_NAME || "Administrador", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Administrador creado: ${email}`);
  } else {
    console.log(`Administrador ya existe: ${email}`);
  }

  for (const systemCode of SYSTEM_CODES) {
    await prisma.systemInventory.upsert({ where: { systemCode }, update: {}, create: { systemCode } });
  }
  await prisma.projectSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  console.log(`Catálogo semilla listo: ${SYSTEM_CODES[0]}..${SYSTEM_CODES.at(-1)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
