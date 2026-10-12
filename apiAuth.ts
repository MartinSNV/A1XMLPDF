// apiAuth.ts
// Autorizácia pre /api/rpo/* – dve cesty, obe bez databázového dotazu na request:
//   1) X-API-Key   – cudzie projekty (VBA, backendy). Kľúče v DB, v pamäti cache.
//   2) X-App-Token – vlastná appka. Podpísaný HMAC token vložený do index.html.
// Latencia overenia je v mikrosekundách; samotný RPO lookup trvá rádovo dlhšie.

import crypto from "crypto";
import type { PrismaClient } from "./generated/prisma/client.js";

const APP_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hodín
const KEY_CACHE_TTL_MS = 60_000;              // obnova cache kľúčov raz za minútu
const USAGE_FLUSH_MS = 30_000;                // dávkový zápis počítadiel do DB

// ── App token (vlastná appka) ───────────────────────────────────────────────

const SECRET =
  process.env.APP_TOKEN_SECRET || crypto.randomBytes(32).toString("hex");

if (!process.env.APP_TOKEN_SECRET) {
  const msg =
    "[AUTH] APP_TOKEN_SECRET nie je nastavené – použitý náhodný dočasný secret. " +
    "Tokeny prestanú platiť po reštarte a nefungujú pri viacerých instanciách.";
  if (process.env.NODE_ENV === "production") console.error(msg);
  else console.warn(msg);
}

const sign = (exp: string) =>
  crypto.createHmac("sha256", SECRET).update(exp).digest("base64url");

/** Vytvorí token tvaru "<expiry>.<hmac>". Vkladá sa do index.html. */
export function issueAppToken(): string {
  const exp = String(Date.now() + APP_TOKEN_TTL_MS);
  return `${exp}.${sign(exp)}`;
}

/** Overí token – iba HMAC a expirácia, žiadne I/O. */
export function verifyAppToken(token: string): boolean {
  const dot = token.indexOf(".");
  if (dot <= 0) return false;

  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs < Date.now()) return false;

  const a = Buffer.from(sig);
  const b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── API kľúče (cudzie projekty) ─────────────────────────────────────────────

/** SHA-256, nie bcrypt: kľúče majú vysokú entropiu, takže slovníkový útok
 *  nehrozí, a bcrypt by pridal ~100 ms na každý request. */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): string {
  return "a1k_" + crypto.randomBytes(32).toString("base64url");
}

interface KeyRecord {
  id: string;
  name: string;
  active: boolean;
  dailyLimit: number;
  usedToday: number;
  usageDate: string;
  totalCount: number;
  dirty: boolean;
}

let prisma: PrismaClient | null = null;
const keyCache = new Map<string, KeyRecord>();
let cacheLoadedAt = 0;
let loading: Promise<void> | null = null;

const today = () => new Date().toISOString().slice(0, 10);

async function loadKeys(): Promise<void> {
  if (!prisma) return;
  const rows = await prisma.apiKey.findMany();
  const d = today();

  for (const row of rows) {
    const existing = keyCache.get(row.keyHash);
    // Lokálne počítadlo má prednosť, ak ešte nebolo zapísané do DB
    if (existing?.dirty) {
      existing.name = row.name;
      existing.active = row.active;
      existing.dailyLimit = row.dailyLimit;
      continue;
    }
    keyCache.set(row.keyHash, {
      id: row.id,
      name: row.name,
      active: row.active,
      dailyLimit: row.dailyLimit,
      usedToday: row.usageDate === d ? row.usedToday : 0,
      usageDate: d,
      totalCount: row.totalCount,
      dirty: false,
    });
  }

  // Zmazané kľúče odstráň z cache
  const valid = new Set(rows.map((r) => r.keyHash));
  for (const hash of keyCache.keys()) {
    if (!valid.has(hash)) keyCache.delete(hash);
  }

  cacheLoadedAt = Date.now();
}

async function ensureCache(): Promise<void> {
  if (Date.now() - cacheLoadedAt < KEY_CACHE_TTL_MS) return;
  if (loading) return loading;
  loading = loadKeys()
    .catch((e) => console.error("[AUTH] Načítanie API kľúčov zlyhalo:", e.message))
    .finally(() => { loading = null; });
  return loading;
}

async function flushUsage(): Promise<void> {
  if (!prisma) return;
  const dirty = [...keyCache.values()].filter((r) => r.dirty);
  if (!dirty.length) return;

  for (const rec of dirty) {
    rec.dirty = false;
    try {
      await prisma.apiKey.update({
        where: { id: rec.id },
        data: {
          usedToday: rec.usedToday,
          usageDate: rec.usageDate,
          totalCount: rec.totalCount,
          lastUsedAt: new Date(),
        },
      });
    } catch (e: any) {
      rec.dirty = true; // skúsi sa znova pri ďalšom flushi
      console.error(`[AUTH] Zápis štatistiky kľúča ${rec.name} zlyhal:`, e.message);
    }
  }
}

/** Zavolať raz pri štarte servera. */
export function initApiAuth(client: PrismaClient | null): void {
  prisma = client;
  if (!client) {
    console.warn("[AUTH] Bez databázy – API kľúče nie sú dostupné");
    return;
  }
  void ensureCache();
  setInterval(() => void flushUsage(), USAGE_FLUSH_MS).unref();
}

// Jeden typ s volitelnymi polami namiesto diskriminovanej unie:
// projekt ma strictNullChecks vypnute, kde zuzovanie cez `!result.ok`
// nie je spolahlive.
interface CheckResult {
  ok: boolean;
  status?: number;
  error?: string;
  name?: string;
}

async function checkApiKey(key: string): Promise<CheckResult> {
  if (!prisma) {
    return { ok: false, status: 503, error: "API kľúče nie sú nakonfigurované" };
  }

  await ensureCache();

  const rec = keyCache.get(hashApiKey(key));
  if (!rec) return { ok: false, status: 401, error: "Neplatný API kľúč" };
  if (!rec.active) return { ok: false, status: 403, error: "API kľúč je deaktivovaný" };

  const d = today();
  if (rec.usageDate !== d) {
    rec.usageDate = d;
    rec.usedToday = 0;
  }

  if (rec.usedToday >= rec.dailyLimit) {
    return {
      ok: false,
      status: 429,
      error: `Vyčerpaná denná kvóta (${rec.dailyLimit} dotazov). Skúste zajtra.`,
    };
  }

  rec.usedToday++;
  rec.totalCount++;
  rec.dirty = true;
  return { ok: true, name: rec.name };
}

/** Middleware pre /api/rpo/*. Poradie: API kľúč → app token → 401. */
export async function rpoAuth(req: any, res: any, next: any): Promise<void> {
  const apiKey = req.get("X-API-Key");
  if (apiKey) {
    const result = await checkApiKey(apiKey);
    if (!result.ok) {
      res.status(result.status ?? 401).json({ error: result.error ?? "Neautorizovaný prístup" });
      return;
    }
    req.apiKeyName = result.name;
    next();
    return;
  }

  const appToken = req.get("X-App-Token");
  if (appToken && verifyAppToken(appToken)) {
    next();
    return;
  }

  res.set("WWW-Authenticate", 'ApiKey realm="RPO"');
  res.status(401).json({
    error: "Neautorizovaný prístup. Pošlite hlavičku X-API-Key.",
  });
}

/** Vloží app token do <head> servovaného HTML. */
export function injectAppToken(html: string): string {
  return html.replace(
    "</head>",
    `  <meta name="app-token" content="${issueAppToken()}">\n</head>`
  );
}
