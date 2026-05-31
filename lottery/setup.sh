#!/bin/bash
# =============================================================================
# Nastavenie automatickej kontroly Loto 5 z 35
# Spusti tento skript raz na svojom počítači / serveri.
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="$(which python3)"

echo "=== Loto 5 z 35 — Inštalácia ==="
echo "Adresár skriptov: $SCRIPT_DIR"

# ---- 1. Závislosti ----
echo ""
echo "[1/3] Inštalácia Python závislostí..."
pip3 install --user requests beautifulsoup4

# ---- 2. .env súbor ----
ENV_FILE="$SCRIPT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo ""
    echo "[2/3] Vytváram .env súbor..."
    cat > "$ENV_FILE" << 'EOF'
# Gmail adresa, z ktorej sa budú posielať notifikácie
NOTIFY_EMAIL=your_gmail@gmail.com

# Gmail App Password (nie bežné heslo!)
# Vygeneruj na: https://myaccount.google.com/apppasswords
# (Potrebuješ zapnuté 2-faktorové overenie)
NOTIFY_PASSWORD=xxxx_xxxx_xxxx_xxxx

# Voliteľné: ntfy.sh push notifikácie na telefón
# 1. Nainštaluj aplikáciu ntfy (Android/iOS)
# 2. Zadaj unikátny topic nižšie (napr. mato-loto-abc123)
# 3. V aplikácii sa prihlásiť na rovnaký topic
NOTIFY_NTFY=
EOF
    echo "   Vytvorený: $ENV_FILE"
    echo "   !!! UPRAV .env súbor — vyplň NOTIFY_EMAIL a NOTIFY_PASSWORD !!!"
else
    echo "[2/3] .env súbor už existuje — preskakujem."
fi

# ---- 3. Cron job ----
echo ""
echo "[3/3] Nastavenie cron jobu (St, Pi, Ne o 20:00)..."

# Cron: minúta hodina * * deň_v_týždni (0=Nedeľa, 3=Streda, 5=Piatok)
CRON_CMD="0 20 * * 0,3,5 source $SCRIPT_DIR/.env && $PYTHON $SCRIPT_DIR/lottery_checker.py >> $SCRIPT_DIR/lottery.log 2>&1"

# Pridaj ak ešte neexistuje
( crontab -l 2>/dev/null | grep -v "lottery_checker.py" ; echo "$CRON_CMD" ) | crontab -

echo "   Cron job pridaný!"
echo ""
echo "=== Hotovo! ==="
echo ""
echo "Aktuálne cron joby:"
crontab -l | grep lottery_checker
echo ""
echo "Ďalšie kroky:"
echo "  1. Uprav $ENV_FILE — vyplň email a heslo"
echo "  2. Otestuj skript:   python3 $SCRIPT_DIR/lottery_checker.py --dry-run"
echo "  3. Otestuj email:    python3 $SCRIPT_DIR/lottery_checker.py --test-win 3"
echo ""
