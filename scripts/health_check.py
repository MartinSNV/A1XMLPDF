#!/usr/bin/env python3
"""
Denná kontrola zdravia RPO synchronizácie a produkčnej appky.

Beží v GitHub Actions (health_check.yml). Pri probléme skončí s kódom 1 a zapíše
health_report.txt, ktorý workflow pošle na Telegram. Pri zdravom stave je ticho.

Kontroly:
  1. stav sync-u v DB (rpo_sync_state) nie je starší ako STATE_MAX_AGE_DAYS
  2. posledný dokončený beh sync workflow uspel, nie je starý a netrval príliš dlho
  3. počet riadkov v rpo_fo nekleol (len pondelok, count(*) stojí Request Units)
  4. produkčná appka žije a /api/rpo/* bez kľúča vracia 401 (nie 200)

Nekontroluje kvóty API kľúčov – tie sú v inej DB (Northflank), do ktorej GitHub
Actions zámerne nemá prístup.
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

COCKROACH_URL = os.environ["COCKROACH_URL"]
APP_URL = os.environ.get("APP_URL", "https://p01--a1xmlpdf--zvrnypvb9jkl.code.run").rstrip("/")
REPO = os.environ.get("GITHUB_REPOSITORY", "MartinSNV/A1XMLPDF")
WORKFLOW = "sync_rpo_fo.yml"
REPORT_FILE = os.environ.get("HEALTH_REPORT", "health_report.txt")

STATE_MAX_AGE_DAYS = 9     # sync beží raz týždenne, rezerva na oneskorený cron
RUN_MAX_AGE_DAYS = 9
RUN_MAX_HOURS = 2.0        # beh, čo trval 3 h a prepočítaval staré dáta, je podozrivý
COUNT_DROP_LIMIT = 0.98    # alert ak rpo_fo klesne pod 98 % poslednej známej hodnoty

problems = []


def log(msg):
    print(msg, flush=True)


def psql(sql, timeout=60):
    r = subprocess.run(
        ["psql", COCKROACH_URL, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql],
        capture_output=True, text=True, timeout=timeout,
    )
    if r.returncode != 0:
        raise RuntimeError(f"psql zlyhalo: {r.stderr.strip()[:200]}")
    return r.stdout.strip()


def parse_ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def check_state():
    out = psql(
        "SELECT (extract(epoch FROM now() - updated_at) / 86400)::STRING || '|' || last_sync_at "
        "FROM defaultdb.rpo_sync_state WHERE id = 1"
    )
    if not out:
        problems.append("rpo_sync_state je prázdna – sync nemá uložený postup.")
        return
    age_days, since = out.split("|", 1)
    age = float(age_days)
    log(f"stav sync: since={since}, zapísaný pred {age:.1f} dňami")
    if age > STATE_MAX_AGE_DAYS:
        problems.append(
            f"Stav sync-u v DB sa nezmenil {age:.1f} dní (limit {STATE_MAX_AGE_DAYS}). "
            f"Posledné since={since}. Cron pravdepodobne nebeží."
        )


def check_last_run():
    r = subprocess.run(
        ["gh", "run", "list", "--repo", REPO, "--workflow", WORKFLOW, "--limit", "10",
         "--json", "status,conclusion,event,createdAt,startedAt,updatedAt,url"],
        capture_output=True, text=True, timeout=60,
    )
    if r.returncode != 0:
        raise RuntimeError(f"gh run list zlyhalo: {r.stderr.strip()[:200]}")
    runs = [x for x in json.loads(r.stdout) if x["status"] == "completed"]
    if not runs:
        problems.append("Workflow RPO FO Sync nemá žiadny dokončený beh.")
        return

    last = runs[0]
    now = datetime.now(timezone.utc)
    age_days = (now - parse_ts(last["createdAt"])).total_seconds() / 86400
    hours = (parse_ts(last["updatedAt"]) - parse_ts(last["startedAt"])).total_seconds() / 3600
    log(f"posledný beh: {last['conclusion']}, pred {age_days:.1f} d, trval {hours:.2f} h")

    if last["conclusion"] != "success":
        problems.append(f"Posledný beh sync-u skončil '{last['conclusion']}': {last['url']}")
    if age_days > RUN_MAX_AGE_DAYS:
        problems.append(
            f"Posledný dokončený beh sync-u je starý {age_days:.1f} dní (limit {RUN_MAX_AGE_DAYS}). "
            "GitHub mohol vypnúť plánované workflowy."
        )
    if hours > RUN_MAX_HOURS:
        problems.append(
            f"Posledný beh trval {hours:.1f} h (bežne minúty). Pravdepodobne prepočítaval staré dáta: {last['url']}"
        )


def check_count():
    if not (datetime.now(timezone.utc).weekday() == 0 or os.environ.get("FORCE_COUNT")):
        log("počet riadkov rpo_fo: preskočené (kontroluje sa len v pondelok)")
        return
    psql(
        "CREATE TABLE IF NOT EXISTS defaultdb.rpo_health ("
        "key STRING PRIMARY KEY, value STRING NOT NULL, "
        "updated_at TIMESTAMPTZ NOT NULL DEFAULT now())"
    )
    count = int(psql("SELECT count(*) FROM defaultdb.rpo_fo"))
    baseline = psql("SELECT value FROM defaultdb.rpo_health WHERE key = 'rpo_fo_count'")
    log(f"rpo_fo: {count} riadkov, základ: {baseline or 'žiadny'}")

    if count == 0:
        problems.append("Tabuľka rpo_fo je prázdna.")
    elif baseline and count < int(baseline) * COUNT_DROP_LIMIT:
        problems.append(
            f"rpo_fo kleslo z {baseline} na {count} riadkov (viac ako "
            f"{round((1 - COUNT_DROP_LIMIT) * 100)} %). Základ som nezmenil."
        )
    else:
        # základ posúvame len pri zdravom stave, aby sa pokles nestal novým normálom
        psql(
            "UPSERT INTO defaultdb.rpo_health (key, value, updated_at) "
            f"VALUES ('rpo_fo_count', '{count}', now())"
        )


def http_status(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "a1xmlpdf-health-check"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code


def check_app():
    root = http_status(f"{APP_URL}/")
    log(f"appka /: HTTP {root}")
    if root != 200:
        problems.append(f"Produkčná appka na / vracia HTTP {root} (čakané 200).")

    rpo = http_status(f"{APP_URL}/api/rpo/entity?ico=32484500")
    log(f"/api/rpo/entity bez kľúča: HTTP {rpo}")
    if rpo == 200:
        problems.append(
            "BEZPEČNOSŤ: /api/rpo/entity odpovedá bez API kľúča (HTTP 200) – ochrana nefunguje."
        )
    elif rpo != 401:
        problems.append(f"/api/rpo/entity bez kľúča vracia HTTP {rpo} (čakané 401).")


CHECKS = [
    ("stav sync-u", check_state),
    ("posledný beh", check_last_run),
    ("počet riadkov", check_count),
    ("produkčná appka", check_app),
]


def main():
    for name, fn in CHECKS:
        try:
            fn()
        except Exception as e:  # jedna padnutá kontrola nesmie skryť ostatné
            problems.append(f"Kontrola '{name}' sa nedala vykonať: {e}")

    if not problems:
        log("OK – všetky kontroly prešli")
        if os.path.exists(REPORT_FILE):
            os.remove(REPORT_FILE)
        return 0

    report = "A1XMLPDF – kontrola zdravia našla problémy:\n\n" + "\n\n".join(f"• {p}" for p in problems)
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(report)
    log(report)
    return 1


if __name__ == "__main__":
    sys.exit(main())
