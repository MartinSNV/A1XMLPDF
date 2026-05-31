#!/usr/bin/env python3
"""
Loto 5 z 35 - Automatická kontrola výhier
Spúšťa sa každú stredu, piatok a nedeľu o 20:00 cez cron.

Premenné prostredia (nastav v .env alebo priamo v crone):
  NOTIFY_EMAIL     - emailová adresa odosielateľa (Gmail)
  NOTIFY_PASSWORD  - Gmail App Password (nie bežné heslo!)
  NOTIFY_NTFY      - ntfy.sh topic pre push notifikácie (voliteľné)
"""

import os
import re
import sys
import json
import time
import smtplib
import logging
import argparse
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Konfigurácia
# ---------------------------------------------------------------------------

MY_NUMBERS = {9, 14, 19, 27, 33}
RECIPIENT_EMAIL = "mato.jurik1@gmail.com"

LOTO_URL = "https://www.tipos.sk/loterie/loto-5-z-35"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "sk-SK,sk;q=0.9,cs;q=0.8,en;q=0.7",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://www.tipos.sk/",
}

STATE_FILE = os.path.join(os.path.dirname(__file__), "last_checked.json")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "lottery.log")),
    ],
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Scraping
# ---------------------------------------------------------------------------

def fetch_page(url: str, retries: int = 3) -> str | None:
    for attempt in range(1, retries + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            r.raise_for_status()
            return r.text
        except requests.RequestException as e:
            log.warning(f"Pokus {attempt}/{retries} zlyhal: {e}")
            if attempt < retries:
                time.sleep(5 * attempt)
    return None


def parse_drawn_numbers(html: str) -> tuple[list[int], str] | tuple[None, None]:
    """
    Vráti (zoznam_cisel, datum_zrebu) alebo (None, None) ak sa nenašli.

    tipos.sk môže meniť štruktúru HTML - preto používame viacero stratégií.
    """
    soup = BeautifulSoup(html, "html.parser")

    # -------- Stratégia 1: JSON-LD / inline JSON vo skripte --------
    for script in soup.find_all("script"):
        text = script.string or ""
        # hľadaj pole čísel ako [9,14,19,...] v rozsahu 1-35
        matches = re.findall(r'\[(\s*(?:[1-9]|[12]\d|3[0-5])(?:\s*,\s*(?:[1-9]|[12]\d|3[0-5])){4}\s*)\]', text)
        for m in matches:
            nums = [int(x.strip()) for x in m.split(",")]
            if len(nums) == 5 and all(1 <= n <= 35 for n in nums):
                draw_date = extract_date(soup)
                return nums, draw_date

    # -------- Stratégia 2: CSS selektory pre bežné lottery widgety --------
    selectors = [
        ".lottery-numbers .number",
        ".winning-numbers .ball",
        ".draw-result .number",
        ".loto-cisla span",
        ".loto-numbers span",
        "[class*='ball']",
        "[class*='cislo']",
        "[class*='number']:not(h1):not(h2):not(h3):not(p)",
        ".result-numbers li",
        ".numbers-list li",
    ]
    for sel in selectors:
        items = soup.select(sel)
        nums = []
        for item in items:
            t = item.get_text(strip=True)
            if t.isdigit() and 1 <= int(t) <= 35:
                nums.append(int(t))
        if len(nums) >= 5:
            draw_date = extract_date(soup)
            return nums[:5], draw_date

    # -------- Stratégia 3: hľadaj skupiny čísel v texte stránky --------
    # Hľadá riadky s 5 číslami oddelenými medzerou/čiarkou v rozsahu 1-35
    text = soup.get_text(" ")
    pattern = r'(?<!\d)([1-9]|[12]\d|3[0-5])(?:\s+|\s*,\s*)([1-9]|[12]\d|3[0-5])(?:\s+|\s*,\s*)([1-9]|[12]\d|3[0-5])(?:\s+|\s*,\s*)([1-9]|[12]\d|3[0-5])(?:\s+|\s*,\s*)([1-9]|[12]\d|3[0-5])(?!\d)'
    m = re.search(pattern, text)
    if m:
        nums = [int(g) for g in m.groups()]
        if len(set(nums)) == 5:
            draw_date = extract_date(soup)
            return nums, draw_date

    return None, None


def extract_date(soup: BeautifulSoup) -> str:
    """Pokúsi sa extrahovať dátum žrebovania zo stránky."""
    # hľadaj dátum vo formáte DD.MM.YYYY alebo YYYY-MM-DD
    text = soup.get_text(" ")
    m = re.search(r'\b(\d{1,2}\.\s*\d{1,2}\.\s*\d{4})\b', text)
    if m:
        return m.group(1)
    m = re.search(r'\b(\d{4}-\d{2}-\d{2})\b', text)
    if m:
        return m.group(1)
    return datetime.now().strftime("%d.%m.%Y")


# ---------------------------------------------------------------------------
# Logika výhier
# ---------------------------------------------------------------------------

def evaluate_win(drawn: list[int]) -> tuple[int, set[int]]:
    """
    Vráti (stupeň_výhry, zhoda):
      1 = 1. cena (5 čísel)
      2 = 2. cena (4 čísla)
      3 = 3. cena (3 čísla)
      0 = žiadna výhra
    """
    matches = MY_NUMBERS & set(drawn)
    n = len(matches)
    if n == 5:
        return 1, matches
    if n == 4:
        return 2, matches
    if n == 3:
        return 3, matches
    return 0, matches


# ---------------------------------------------------------------------------
# Notifikácie
# ---------------------------------------------------------------------------

def send_email(prize: int, matches: set[int], drawn: list[int], draw_date: str) -> bool:
    sender = os.environ.get("NOTIFY_EMAIL", "")
    password = os.environ.get("NOTIFY_PASSWORD", "")

    if not sender or not password:
        log.warning("NOTIFY_EMAIL / NOTIFY_PASSWORD nie sú nastavené — email sa neodošle.")
        return False

    prize_names = {1: "1. cenu (JACKPOT)", 2: "2. cenu", 3: "3. cenu"}
    subject = f"Loto 5 z 35 — Vyhral si {prize_names[prize]}!"

    matched_str = " ".join(str(n) for n in sorted(matches))
    drawn_str   = " ".join(str(n) for n in drawn)
    my_str      = " ".join(str(n) for n in sorted(MY_NUMBERS))

    body = f"""Gratulujeme!

Žrebovanie: {draw_date}

Tvoje čísla:       {my_str}
Vyžrebované čísla: {drawn_str}
Zhodné čísla:      {matched_str}

Vyhral si {prize_names[prize]}!

Skontroluj výsledky na: {LOTO_URL}
"""

    msg = MIMEMultipart()
    msg["From"] = sender
    msg["To"] = RECIPIENT_EMAIL
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
            server.starttls()
            server.login(sender, password)
            server.sendmail(sender, RECIPIENT_EMAIL, msg.as_string())
        log.info(f"Email odoslaný na {RECIPIENT_EMAIL}")
        return True
    except Exception as e:
        log.error(f"Chyba pri odosielaní emailu: {e}")
        return False


def send_ntfy(prize: int, matches: set[int], drawn: list[int], draw_date: str) -> bool:
    topic = os.environ.get("NOTIFY_NTFY", "")
    if not topic:
        return False

    prize_names = {1: "JACKPOT - 1. cena", 2: "2. cena", 3: "3. cena"}
    matched_str = " ".join(str(n) for n in sorted(matches))
    drawn_str   = " ".join(str(n) for n in drawn)

    try:
        requests.post(
            f"https://ntfy.sh/{topic}",
            data=f"Zhodné čísla: {matched_str}\nVyžrebované: {drawn_str}\nŽrebovanie: {draw_date}".encode("utf-8"),
            headers={
                "Title": f"Loto 5z35 — {prize_names[prize]}!",
                "Priority": "high" if prize == 1 else "default",
                "Tags": "tada,moneybag",
            },
            timeout=10,
        )
        log.info(f"Push notifikácia odoslaná (ntfy topic: {topic})")
        return True
    except Exception as e:
        log.error(f"Chyba pri ntfy notifikácii: {e}")
        return False


# ---------------------------------------------------------------------------
# Stav (aby sme neposielali dvakrát pre to isté žrebovanie)
# ---------------------------------------------------------------------------

def load_state() -> dict:
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_state(state: dict) -> None:
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Hlavná logika
# ---------------------------------------------------------------------------

def run(dry_run: bool = False, force: bool = False) -> None:
    log.info("=== Kontrola Loto 5 z 35 ===")
    log.info(f"Moje čísla: {sorted(MY_NUMBERS)}")

    html = fetch_page(LOTO_URL)
    if not html:
        log.error("Nepodarilo sa stiahnuť stránku tipos.sk.")
        sys.exit(1)

    drawn, draw_date = parse_drawn_numbers(html)
    if not drawn:
        log.error("Nepodarilo sa nájsť vyžrebované čísla na stránke.")
        log.debug("Prvých 2000 znakov HTML:\n" + html[:2000])
        sys.exit(1)

    log.info(f"Vyžrebované čísla ({draw_date}): {drawn}")

    # Skontroluj, či sme toto žrebovanie už spracovali
    state = load_state()
    state_key = f"{draw_date}_{'-'.join(str(n) for n in sorted(drawn))}"
    if state.get("last_processed") == state_key and not force:
        log.info("Toto žrebovanie sme už spracovali — preskakujem.")
        return

    prize, matches = evaluate_win(drawn)
    log.info(f"Zhoda: {sorted(matches)} ({len(matches)} čísel) → Cena: {prize or 'žiadna'}")

    if prize > 0:
        log.info(f"*** VÝHRA: {prize}. cena! ***")
        if not dry_run:
            send_email(prize, matches, drawn, draw_date)
            send_ntfy(prize, matches, drawn, draw_date)
        else:
            log.info("[dry-run] Notifikácia by sa odoslala, ale neodošle sa.")
    else:
        log.info("Žiadna výhra tentokrát.")

    # Ulož stav
    if not dry_run:
        state["last_processed"] = state_key
        state["last_run"] = datetime.now().isoformat()
        state["last_drawn"] = drawn
        state["last_draw_date"] = draw_date
        save_state(state)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Kontrola Loto 5 z 35 výhier")
    parser.add_argument("--dry-run", action="store_true",
                        help="Iba zobraz výsledok, neposielajte notifikácie")
    parser.add_argument("--force", action="store_true",
                        help="Spracuj aj keď sme toto žrebovanie už skontrolovali")
    parser.add_argument("--test-win", type=int, choices=[1, 2, 3], default=0,
                        help="Otestuj notifikáciu pre danú cenu (1/2/3) bez scrapingu")
    args = parser.parse_args()

    if args.test_win:
        # Testovací režim — simuluj výhru
        test_drawn = {
            1: sorted(MY_NUMBERS),
            2: [9, 14, 19, 27, 5],
            3: [9, 14, 19, 7, 5],
        }[args.test_win]
        prize, matches = evaluate_win(test_drawn)
        log.info(f"[TEST] Vyžrebované: {test_drawn}, Výhra: {prize}. cena, Zhoda: {sorted(matches)}")
        send_email(prize, matches, test_drawn, datetime.now().strftime("%d.%m.%Y"))
        send_ntfy(prize, matches, test_drawn, datetime.now().strftime("%d.%m.%Y"))
    else:
        run(dry_run=args.dry_run, force=args.force)
