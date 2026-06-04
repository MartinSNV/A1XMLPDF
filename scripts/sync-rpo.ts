/**
 * RPO sync z datahub.ekosystem.slovensko.digital
 *
 * Použitie:
 *   npx tsx scripts/sync-rpo.ts            # inkrementálny sync (od posledného)
 *   npx tsx scripts/sync-rpo.ts --full     # úplný sync (ignoruje last_sync)
 *
 * Env premenné:
 *   LOCAL_RPO_DB_URL  – PostgreSQL connection string na DB s tabuľkou rpo_fo
 *   DATAHUB_TOKEN     – API token z ekosystem.slovensko.digital
 */

import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const DATAHUB_TOKEN = process.env.DATAHUB_TOKEN;
const LOCAL_RPO_DB_URL = process.env.LOCAL_RPO_DB_URL;
const SYNC_URL = "https://datahub.ekosystem.slovensko.digital/api/data/rpo2/organizations/sync";
const BATCH_SIZE = 1000;
const RATE_LIMIT_DELAY_MS = 200; // 60 req/min → ~1 req/s, 200ms je bezpečné

const isFullSync = process.argv.includes("--full");

// ── Mapovanie API response → formát kompatibilný s frontend hookom ────────────
function mapOrganization(org: any): object {
  const addresses = org.municipality || org.street ? [{
    street: org.formatted_street || org.street || "",
    regNumber: org.reg_number || "",
    buildingNumber: org.building_number || "",
    municipality: { value: org.municipality || "" },
    postalCodes: org.postal_code ? [String(org.postal_code).replace(/\s/g, "")] : [],
    country: { value: org.country || "Slovenská republika" },
  }] : [];

  return {
    fullNames: [{ value: org.name || "" }],
    establishment: org.established_on || "",
    addresses,
    dic: org.tin || "",
    icdph: org.vatin || "",
    // activities a statutoryBodies sa načítavajú z RPO cez /api/rpo/detail-async
    activities: [],
    statutoryBodies: [],
  };
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Upsert jednej dávky do rpo_fo ────────────────────────────────────────────
async function upsertBatch(pool: pg.Pool, organizations: any[]): Promise<number> {
  if (!organizations.length) return 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let count = 0;
    for (const org of organizations) {
      const ico = org.cin ? String(org.cin).padStart(8, "0") : null;
      if (!ico || !/^\d{8}$/.test(ico)) continue;

      const data = mapOrganization(org);
      const isInactive = !!(org.terminated_on);

      await client.query(
        `INSERT INTO rpo_fo (ico, is_inactive, data, synced_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (ico) DO UPDATE
           SET is_inactive = EXCLUDED.is_inactive,
               data        = EXCLUDED.data,
               synced_at   = NOW()`,
        [ico, isInactive, JSON.stringify(data)]
      );
      count++;
    }
    await client.query("COMMIT");
    return count;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ── Hlavná funkcia ────────────────────────────────────────────────────────────
async function main() {
  if (!LOCAL_RPO_DB_URL) {
    console.error("[SYNC] Chyba: LOCAL_RPO_DB_URL nie je nastavená");
    process.exit(1);
  }
  if (!DATAHUB_TOKEN) {
    console.error("[SYNC] Chyba: DATAHUB_TOKEN nie je nastavený (získaj ho na ekosystem.slovensko.digital)");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: LOCAL_RPO_DB_URL });

  // Zabezpeč existenciu potrebných stĺpcov a tabuľky stavu
  await pool.query(`
    ALTER TABLE rpo_fo ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NOW()
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rpo_sync_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Načítaj posledný čas syncu
  const stateRow = await pool.query(
    "SELECT value FROM rpo_sync_state WHERE key = 'last_sync'"
  );
  const lastSync: string | null = (!isFullSync && stateRow.rows[0]?.value) || null;

  const syncStartedAt = new Date().toISOString();
  console.log(`[SYNC] ${isFullSync ? "Úplný" : "Inkrementálny"} sync RPO`);
  if (lastSync) console.log(`[SYNC] Zmeny od: ${lastSync}`);
  else console.log("[SYNC] Stiahnem všetky záznamy (môže trvať niekoľko hodín)");

  // Zostav prvú URL
  let nextUrl: string | null = lastSync
    ? `${SYNC_URL}?since=${encodeURIComponent(lastSync)}&limit=${BATCH_SIZE}`
    : `${SYNC_URL}?limit=${BATCH_SIZE}`;

  let page = 0;
  let totalSynced = 0;
  const t0 = Date.now();

  while (nextUrl) {
    page++;
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Token ${DATAHUB_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After") || 60);
      console.warn(`[SYNC] Rate limit (429), čakám ${retryAfter}s...`);
      await sleep(retryAfter * 1000);
      continue; // retry tej istej URL
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`API chyba ${response.status}: ${body.slice(0, 200)}`);
    }

    const organizations: any[] = await response.json();
    if (!organizations.length) break;

    const inserted = await upsertBatch(pool, organizations);
    totalSynced += inserted;

    const elapsed = Math.round((Date.now() - t0) / 1000);
    console.log(`[SYNC] Strana ${page}: ${organizations.length} záznamov → ${inserted} uložených | spolu: ${totalSynced} | ${elapsed}s`);

    // Ďalšia strana — Link header: <url>; rel="next"
    const linkHeader = response.headers.get("Link") || "";
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = nextMatch ? nextMatch[1] : null;

    if (nextUrl) await sleep(RATE_LIMIT_DELAY_MS);
  }

  // Ulož čas posledného úspešného syncu
  await pool.query(
    `INSERT INTO rpo_sync_state (key, value) VALUES ('last_sync', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [syncStartedAt]
  );

  const elapsed = Math.round((Date.now() - t0) / 1000);
  console.log(`[SYNC] Hotovo. Celkom ${totalSynced} záznamov za ${elapsed}s.`);
  console.log(`[SYNC] Ďalší inkrementálny sync začne od: ${syncStartedAt}`);

  await pool.end();
}

main().catch(err => {
  console.error("[SYNC] Fatálna chyba:", err.message);
  process.exit(1);
});
