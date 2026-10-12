// scripts/api_key.ts
// Správa API kľúčov pre /api/rpo/*
//
//   npx tsx scripts/api_key.ts list
//   npx tsx scripts/api_key.ts create "Projekt XY – VBA" 500
//   npx tsx scripts/api_key.ts disable <id>
//   npx tsx scripts/api_key.ts enable  <id>
//   npx tsx scripts/api_key.ts delete  <id>
//
// Plaintext kľúč sa zobrazí IBA raz pri vytvorení – v DB je len SHA-256 hash.

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { generateApiKey, hashApiKey } from "../apiAuth.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("Chýba DATABASE_URL v .env");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
});

async function list() {
  const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } });
  if (!keys.length) {
    console.log("Žiadne API kľúče.");
    return;
  }
  console.log("");
  for (const k of keys) {
    const stav = k.active ? "aktívny" : "VYPNUTÝ";
    const dnes = k.usageDate === new Date().toISOString().slice(0, 10) ? k.usedToday : 0;
    console.log(`${k.id}  [${stav}]  ${k.name}`);
    console.log(`    dnes: ${dnes}/${k.dailyLimit}   celkom: ${k.totalCount}   naposledy: ${k.lastUsedAt?.toISOString() ?? "nikdy"}`);
  }
  console.log("");
}

async function create(name: string, dailyLimit: number) {
  const key = generateApiKey();
  const row = await prisma.apiKey.create({
    data: { name, keyHash: hashApiKey(key), dailyLimit },
  });
  console.log("");
  console.log("Kľúč vytvorený. Zobrazí sa IBA teraz – ulož si ho:");
  console.log("");
  console.log(`    ${key}`);
  console.log("");
  console.log(`  názov:       ${row.name}`);
  console.log(`  id:          ${row.id}`);
  console.log(`  denná kvóta: ${row.dailyLimit}`);
  console.log("");
  console.log("Použitie:  curl -H \"X-API-Key: <kľúč>\" \\");
  console.log("    \"https://p01--a1xmlpdf--zvrnypvb9jkl.code.run/api/rpo/entity?ico=32484500\"");
  console.log("");
}

async function setActive(id: string, active: boolean) {
  const row = await prisma.apiKey.update({ where: { id }, data: { active } });
  console.log(`${active ? "Aktivovaný" : "Deaktivovaný"}: ${row.name}`);
  console.log("Zmena sa prejaví do 1 minúty (cache kľúčov na serveri).");
}

async function remove(id: string) {
  const row = await prisma.apiKey.delete({ where: { id } });
  console.log(`Zmazaný: ${row.name}`);
  console.log("Zmena sa prejaví do 1 minúty (cache kľúčov na serveri).");
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2);

  switch (cmd) {
    case "list":
      await list();
      break;
    case "create":
      if (!a) throw new Error('Chýba názov. Napr.: create "Projekt XY" 500');
      await create(a, b ? parseInt(b, 10) : 200);
      break;
    case "disable":
      if (!a) throw new Error("Chýba id kľúča");
      await setActive(a, false);
      break;
    case "enable":
      if (!a) throw new Error("Chýba id kľúča");
      await setActive(a, true);
      break;
    case "delete":
      if (!a) throw new Error("Chýba id kľúča");
      await remove(a);
      break;
    default:
      console.log("Príkazy: list | create <názov> [kvóta] | disable <id> | enable <id> | delete <id>");
  }
}

main()
  .catch((e) => {
    console.error("Chyba:", e.message);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
