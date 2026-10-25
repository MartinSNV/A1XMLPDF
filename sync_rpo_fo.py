#!/usr/bin/env python3
"""
sync_rpo_fo.py
Synchronizácia RPO FO databázy z ekosystem.slovensko.digital
Beží v GitHub Actions každú nedeľu
Optimalizované: batch upserty (1000 záznamov naraz)
Opravené: vyšší timeout, retry s backoffom, exit code pri zlyhaní
"""

import json
import os
import sys
import time
import re
import subprocess
import tempfile
import requests
from datetime import datetime, timezone, timedelta

# --- KONFIGURÁCIA ---
API_BASE = "https://datahub.ekosystem.slovensko.digital/api/data/rpo2/organizations/sync"
STATE_FILE = "rpo_sync_state.json"
COCKROACH_URL = os.environ["COCKROACH_URL"]
RATE_LIMIT = 50          # requestov za minútu
BATCH_SIZE = 1000        # počet upsertov naraz
REQUEST_TIMEOUT = 180    # sekúnd na jeden HTTP request
MAX_RETRIES = 3          # počet pokusov na jednu stránku
RETRY_BACKOFFS = [10, 30, 60]  # sekúnd čakania medzi pokusmi
PSQL_TIMEOUT = 120       # sekúnd na jeden batch upsert (CockroachDB môže škrtiť pri RU limite)
PSQL_RETRIES = 3         # počet pokusov na jeden batch
PSQL_BACKOFFS = [15, 45, 90]   # sekúnd čakania medzi pokusmi o upsert

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{ts} {msg}", flush=True)

STATE_TABLE = "defaultdb.rpo_sync_state"
ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T[0-9:.]+(Z|[+-]\d{2}:?\d{2})?$")
_last_db_saved = None   # posledná hodnota zapísaná do DB (aby sme nespúšťali psql zbytočne)

def psql_run(sql, timeout=60):
    """Spustí jeden SQL príkaz cez psql. Vráti (returncode, stdout, stderr)."""
    try:
        r = subprocess.run(
            ["psql", COCKROACH_URL, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql],
            capture_output=True, text=True, timeout=timeout,
        )
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except subprocess.TimeoutExpired:
        return 124, "", f"timeout po {timeout}s"

def ensure_state_table():
    rc, _, err = psql_run(
        f"CREATE TABLE IF NOT EXISTS {STATE_TABLE} ("
        "id INT PRIMARY KEY, last_sync_at STRING NOT NULL, "
        "updated_at TIMESTAMPTZ NOT NULL DEFAULT now())"
    )
    if rc != 0:
        raise RuntimeError(f"Nepodarilo sa pripraviť tabuľku stavu: {err[:300]}")

def load_db_state():
    """Vráti last_sync_at z DB alebo None ak ešte neexistuje. Pri chybe DB vyhodí výnimku –
    tichý návrat k starému stavu by znamenal prepočítanie mesiacov dát."""
    rc, out, err = psql_run(f"SELECT last_sync_at FROM {STATE_TABLE} WHERE id = 1")
    if rc != 0:
        raise RuntimeError(f"Čítanie stavu z DB zlyhalo: {err[:300]}")
    return out or None

def save_db_state(since):
    global _last_db_saved
    if since == _last_db_saved:
        return
    if not ISO_RE.match(since):
        log(f"VAROVANIE: neplatný formát since '{since}', do DB neukladám")
        return
    rc, _, err = psql_run(
        f"UPSERT INTO {STATE_TABLE} (id, last_sync_at, updated_at) "
        f"VALUES (1, '{since}', now())"
    )
    if rc == 0:
        _last_db_saved = since
    else:
        log(f"CHYBA uloženia stavu do DB: {err[:300]}")

def load_state():
    """Priorita: SINCE_OVERRIDE > DB > súbor (cache/repo) > posledných 7 dní."""
    global _last_db_saved
    ensure_state_table()

    since_override = os.environ.get("SINCE_OVERRIDE", "").strip()
    if since_override:
        if not ISO_RE.match(since_override):
            raise ValueError(f"SINCE_OVERRIDE nemá platný ISO formát: {since_override}")
        log(f"Použitý manuálny since_override: {since_override}")
        return {"last_sync_at": since_override}

    db_since = load_db_state()
    if db_since:
        _last_db_saved = db_since
        log(f"Stav načítaný z DB: {db_since}")
        return {"last_sync_at": db_since}

    if os.path.exists(STATE_FILE):
        log("VAROVANIE: v DB nie je stav, používam súbor (môže byť zastaraný)")
        with open(STATE_FILE) as f:
            return json.load(f)
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    return {"last_sync_at": since}

def save_state(since):
    # Súbor zostáva ako záloha (Actions cache), zdrojom pravdy je DB.
    with open(STATE_FILE, "w") as f:
        json.dump({"last_sync_at": since}, f)
    save_db_state(since)

def fetch_page(url):
    """Stiahne jednu stránku s retry logikou. Vráti response alebo None ak zlyhalo úplne."""
    last_exception = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            return response
        except Exception as e:
            last_exception = e
            log(f"CHYBA API (pokus {attempt}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES:
                wait = RETRY_BACKOFFS[attempt - 1]
                log(f"Čakám {wait}s pred ďalším pokusom...")
                time.sleep(wait)
    log(f"Stránka zlyhala po {MAX_RETRIES} pokusoch: {last_exception}")
    return None

def is_fyzicka_osoba(org):
    data = org.get("data", {})
    if not data:
        return False
    for lf in data.get("legalForms", []):
        code = lf.get("value", {}).get("code", "")
        if code in ("101", "102", "103", "105"):
            return True
    return False

def extract_ico(org):
    data = org.get("data", {})
    for identifier in data.get("identifiers", []):
        value = identifier.get("value", "")
        if value and len(value) == 8 and value.isdigit():
            return value
    return None

def batch_upsert(records):
    """Upsertni viac záznamov naraz v jednom SQL príkaze.
    Vráti True ak sa batch podaril, False ak zlyhal aj po retry pokusoch."""
    if not records:
        return True

    values = []
    for ico, legal_form_code, is_fo, is_inactive, data_json in records:
        data_escaped = data_json.replace("'", "''")
        lfc = (legal_form_code or "").replace("'", "''")
        is_fo_str = "true" if is_fo else "false"
        is_inactive_str = "true" if is_inactive else "false"
        values.append(
            f"('{ico}', '{lfc}', {is_fo_str}, {is_inactive_str}, '{data_escaped}'::jsonb)"
        )

    sql = f"""INSERT INTO defaultdb.rpo_fo (ico, legal_form_code, is_fyzicka_osoba, is_inactive, data)
VALUES {', '.join(values)}
ON CONFLICT ON CONSTRAINT rpo_fo_ico_unique DO UPDATE SET
  legal_form_code = EXCLUDED.legal_form_code,
  is_fyzicka_osoba = EXCLUDED.is_fyzicka_osoba,
  is_inactive = EXCLUDED.is_inactive,
  data = EXCLUDED.data;"""

    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False, encoding='utf-8') as f:
        f.write(sql)
        tmp_path = f.name

    try:
        for attempt in range(1, PSQL_RETRIES + 1):
            try:
                result = subprocess.run(
                    ["psql", COCKROACH_URL, "-f", tmp_path],
                    capture_output=True, text=True, timeout=PSQL_TIMEOUT
                )
                if result.returncode == 0:
                    return True
                log(f"CHYBA batch upsert (pokus {attempt}/{PSQL_RETRIES}): {result.stderr[:300]}")
            except subprocess.TimeoutExpired:
                # CockroachDB škrtí dotazy pri vyčerpaní Request Units –
                # nesmie to zhodiť celý beh, skúsime znova po pauze.
                log(f"TIMEOUT batch upsert po {PSQL_TIMEOUT}s (pokus {attempt}/{PSQL_RETRIES})")

            if attempt < PSQL_RETRIES:
                wait = PSQL_BACKOFFS[attempt - 1]
                log(f"Čakám {wait}s pred ďalším pokusom o upsert...")
                time.sleep(wait)

        log(f"Batch {len(records)} záznamov zlyhal po {PSQL_RETRIES} pokusoch")
        return False
    finally:
        os.unlink(tmp_path)

def main():
    log("=== Začiatok RPO FO synchronizácie ===")

    state = load_state()
    since = state["last_sync_at"]
    log(f"Synchronizujem od: {since}")

    since_encoded = requests.utils.quote(since)
    next_url = f"{API_BASE}?since={since_encoded}"

    total_processed = 0
    total_upserted = 0
    new_since = since
    # safe_since = pokrok, ktorý je UŽ zapísaný v DB. Ukladáme len tento,
    # inak by sa pri páde stratili záznamy čakajúce v batchi.
    safe_since = since
    batch = []
    had_error = False

    request_count = 0
    minute_start = time.time()

    while next_url:
        # Rate limiting
        request_count += 1
        if request_count >= RATE_LIMIT:
            elapsed = time.time() - minute_start
            if elapsed < 60:
                wait = 60 - elapsed
                log(f"Rate limit: čakám {wait:.0f}s...")
                time.sleep(wait)
            request_count = 0
            minute_start = time.time()

        response = fetch_page(next_url)
        if response is None:
            had_error = True
            break

        records = response.json()

        # Získaj ďalšiu stránku z Link hlavičky
        next_url = None
        link_header = response.headers.get("Link", "")
        if link_header:
            match = re.search(r'<([^>]+)>;\s*rel=["\']next["\']', link_header)
            if match:
                next_url = match.group(1)

        if not isinstance(records, list):
            records = records.get("data", [])

        for org in records:
            total_processed += 1

            updated_at = org.get("updated_at", "")
            if updated_at > new_since:
                new_since = updated_at

            if not is_fyzicka_osoba(org):
                continue

            ico = extract_ico(org)
            if not ico:
                continue

            data = org.get("data", {})
            legal_form_code = ""
            legal_forms = data.get("legalForms", [])
            if legal_forms:
                legal_form_code = legal_forms[0].get("value", {}).get("code", "")

            is_inactive = bool(data.get("termination"))
            data_json = json.dumps(data, ensure_ascii=False)

            batch.append((ico, legal_form_code, True, is_inactive, data_json))

            if len(batch) >= BATCH_SIZE:
                if not batch_upsert(batch):
                    had_error = True
                    break
                safe_since = new_since
                total_upserted += len(batch)
                log(f"Spracovaných: {total_processed}, upsertnutých FO: {total_upserted}")
                batch = []

        if had_error:
            break

        # Postup ukladáme priebežne – keď beh spadne (RU limit, timeout),
        # ďalší beh pokračuje odtiaľto a nezačína znova od nuly.
        save_state(safe_since)
        log(f"Stránka hotová. Celkom: {total_processed}, FO: {total_upserted}, zapísané_po={safe_since}")

    # Upsertni zvyšok
    if batch:
        if batch_upsert(batch):
            safe_since = new_since
            total_upserted += len(batch)
            log(f"Posledný batch: {len(batch)} záznamov")
        else:
            had_error = True

    save_state(safe_since)
    log(f"Nový sync timestamp: {safe_since}")
    log(f"=== Hotovo. Spracovaných: {total_processed}, upsertnutých: {total_upserted} ===")

    if had_error:
        log("=== Synchronizácia zlyhala (API alebo DB nedostupné aj po retry pokusoch) ===")
        log("Postup je uložený – ďalší beh bude pokračovať od posledného úspešného bodu.")
        sys.exit(1)

if __name__ == "__main__":
    main()