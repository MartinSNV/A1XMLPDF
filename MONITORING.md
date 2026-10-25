# Monitoring a agent pre RPO sync

Dve vrstvy. Telegram príde **len pri probléme**.

## 1. Denná kontrola zdravia (bez AI)

`.github/workflows/health_check.yml` → `scripts/health_check.py`, denne o 06:30 UTC.

| Kontrola | Alert keď |
|---|---|
| stav sync-u v DB (`rpo_sync_state`) | sa nezmenil viac ako 9 dní (cron nebeží) |
| posledný dokončený beh sync-u | nie je `success`, je starší ako 9 dní, alebo trval viac ako 2 h |
| počet riadkov `rpo_fo` (len pondelok) | klesol pod 98 % poslednej známej hodnoty alebo je 0 |
| produkčná appka | `/` nevracia 200, alebo `/api/rpo/entity` bez kľúča nevracia 401 |

Nekontroluje kvóty API kľúčov – tie sú v DB na Northflank, do ktorej GitHub Actions
zámerne nemá prístup. Ručné spustenie (`Run workflow`) vždy skontroluje aj počet riadkov.

Skript vytvorí v CockroachDB malú tabuľku `defaultdb.rpo_health` (základ pre počet riadkov).

## 2. Agent po zlyhaní sync-u

`.github/workflows/sync_failure_agent.yml` – po zlyhaní „RPO FO Sync" agent prečíta log:

| Príčina | Čo agent urobí |
|---|---|
| prechodná (sieť, API, DB timeout, segfault) | raz znova spustí sync (pokračuje od uloženého stavu) |
| chyba v kóde | otvorí PR s opravou – **na tvoje schválenie, nič nemerguje** |
| nejasná | nič nemení, len nahlási |

Potom pošle report na Telegram. **Nemá prístup k DB ani k secretom**, nemôže pushnúť do `main`
ani meniť `.github/`. Poistka proti slučke: beh, ktorý spustil sám agent, agenta znova nespúšťa.

### Jednorazové nastavenie

1. **Secret `ANTHROPIC_API_KEY`** – GitHub → Settings → Secrets and variables → Actions.
   Bez neho sa agent nespustí a na Telegram príde len správa, že chýba kľúč.
2. **Claude GitHub App** nainštalovaná na repo (z Claude Code: `/install-github-app`).
3. **Settings → Actions → General → Workflow permissions**: zapnúť
   „Allow GitHub Actions to create and approve pull requests" (inak agent PR neotvorí).

### Test bez rizika

Spusti sync s neplatným vstupom – skončí hneď pri načítaní stavu, bez zásahu do dát:

```bash
gh workflow run sync_rpo_fo.yml -f since_override=zly-vstup
```

Beh zlyhá, agent sa spustí a mal by to zaradiť ako chybu vstupu (nič nemení, nič nespúšťa).

### Čo to nerieši

- Agent opravuje len `sync_rpo_fo.py`. Problémy appky na Northflank nerieši.
- Kontrola zdravia je sama plánovaná úloha: GitHub vypína plánované workflowy v repách
  bez aktivity 60 dní. Bežné commity to držia nažive.
