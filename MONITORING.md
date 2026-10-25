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

> **Stav: VYPNUTÝ** (`gh workflow disable sync_failure_agent.yml`). Pripravený workflow
> je v repe, ale nebeží. Dôvod: token z predplatného (`claude setup-token`) Anthropic
> odmieta aj lokálne, aj na GitHub runneri (`401 Not logged in`). Overené: secret má správnu
> dĺžku (110 znakov), zlyháva aj čisté Claude CLI bez `claude-code-action`, takže chyba je
> v tokene alebo v účte, z ktorého vznikol – nie vo workflowe.
>
> **Znova zapnúť:** získať funkčnú autentifikáciu (token, ktorý prejde lokálne:
> `$env:CLAUDE_CODE_OAUTH_TOKEN=$t; claude -p "OK"`, alebo API kľúč z Claude Console –
> vtedy vo workflowe vymeniť `claude_code_oauth_token` za `anthropic_api_key`), uložiť
> ho do GitHub secretu a potom `gh workflow enable sync_failure_agent.yml`.
> Kým je vypnutý, o zlyhaní sync-u ťa informuje len Telegram z workflowu "RPO FO Sync".


`.github/workflows/sync_failure_agent.yml` – po zlyhaní „RPO FO Sync" agent prečíta log:

| Príčina | Čo agent urobí |
|---|---|
| prechodná (sieť, API, DB timeout, segfault) | raz znova spustí sync (pokračuje od uloženého stavu) |
| chyba v kóde | otvorí PR s opravou – **na tvoje schválenie, nič nemerguje** |
| nejasná | nič nemení, len nahlási |

Potom pošle report na Telegram. **Nemá prístup k DB ani k secretom**, nemôže pushnúť do `main`
ani meniť `.github/`. Poistka proti slučke: beh, ktorý spustil sám agent, agenta znova nespúšťa.

### Jednorazové nastavenie

1. **Secret `CLAUDE_CODE_OAUTH_TOKEN`** – jednoročný token z tvojho predplatného
   (Pro, Max, Team alebo Enterprise). Vygeneruješ ho príkazom `claude setup-token`:
   otvorí prehliadač, po schválení vypíše token do terminálu. Ulož ho bez zobrazenia:

   ```powershell
   gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo MartinSNV/A1XMLPDF
   ```

   Bez neho sa agent nespustí a na Telegram príde len správa, že token chýba.
   Token vyprší po roku – vtedy agent prestane fungovať, tak si to zaznač.
   Behy sa počítajú do limitov predplatného. Alternatíva je API kľúč z Claude Console
   (v workflowe vstup `anthropic_api_key`, secret `ANTHROPIC_API_KEY`).
2. **Claude GitHub App** nainštalovaná len na toto repo: `https://github.com/apps/claude`.
   Aplikácia žiada široké oprávnenia (vrátane Actions a Workflows zápis), GitHub neumožňuje
   prijať len časť. Obmedzenie agenta (nepushuje do `main`, nemení `.github/`) preto stojí
   na zozname povolených príkazov vo workflowe, nie na oprávneniach tokenu.
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
