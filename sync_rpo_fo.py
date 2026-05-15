#!/usr/bin/env python3
"""
sync_rpo_fo.py
Synchronizácia RPO FO databázy z ekosystem.slovensko.digital
Beží v GitHub Actions každú nedeľu
Optimalizované: batch upserty (100 záznamov naraz)
"""

import json
import os
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
RATE_LIMIT = 50      # requestov za minútu
BATCH_SIZE = 100     # počet upsertov naraz

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{ts} {msg}", flush=True)

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    return {"last_sync_at": since}

def save_state(since):
    with open(STATE_FILE, "w") as f:
        json.dump({"last_sync_at": since}, f)

def is_fyzicka_osoba(org):
    data = org.get("data", {})
    if not data:
        return False
    for lf in data.get("legalForms", []):
        code = lf.get("value", {}).get("code", "")
        if code and code.startswith("1") and len(code) == 3:
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
    """Upsertni viac záznamov naraz v jednom SQL príkaze"""
    if not records:
        return

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
        result = subprocess.run(
            ["psql", COCKROACH_URL, "-f", tmp_path],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode != 0:
            log(f"CHYBA batch upsert: {result.stderr[:300]}")
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
    batch = []

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

        try:
            response = requests.get(next_url, timeout=30)
            response.raise_for_status()
            records = response.json()
        except Exception as e:
            log(f"CHYBA API: {e}")
            break

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
                batch_upsert(batch)
                total_upserted += len(batch)
                log(f"Spracovaných: {total_processed}, upsertnutých FO: {total_upserted}")
                batch = []

        log(f"Stránka hotová. Celkom: {total_processed}, FO: {total_upserted}")

    # Upsertni zvyšok
    if batch:
        batch_upsert(batch)
        total_upserted += len(batch)
        log(f"Posledný batch: {len(batch)} záznamov")

    save_state(new_since)
    log(f"Nový sync timestamp: {new_since}")
    log(f"=== Hotovo. Spracovaných: {total_processed}, upsertnutých: {total_upserted} ===")

if __name__ == "__main__":
    main()
