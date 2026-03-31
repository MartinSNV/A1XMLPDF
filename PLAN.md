# Plán vývoja – A1 XMLPDF

> Aplikácia pre SZČO na generovanie, podpisovanie a odosielanie žiadostí na Sociálnu poisťovňu.

---

## Aktuálny stav ✅

- [x] Formulár PD A1 – vyslanie SZČO do EÚ (XML + PDF)
- [x] Formulár Žiadosť o určenie uplatniteľnej legislatívy (XML)
- [x] Načítanie údajov z RPO podľa IČO
- [x] Výber formulára po načítaní IČO
- [x] Generovanie PDF cez Python/pypdf backend
- [x] Deploy na Northflank cez Docker

---

## Fáza 1 – Dokončenie základu 🔧

> Cieľ: Stabilná a validovaná generácia XML/PDF

### Úlohy
- [ ] Validácia vstupov voči XSD schémam pred generovaním
- [ ] Unit testy XML výstupu (porovnanie s referenčnými súbormi)
- [ ] Zobrazenie chýb validácie priamo vo formulári
- [ ] Dokončenie PDF pre formulár Uplatniteľná legislatíva
- [ ] Testovanie na reálnych podaniach (overenie akceptácie SP)

---

## Fáza 2 – Prílohy a správa dokumentov 📎

> Cieľ: Systém príloh podľa typu žiadosti + uloženie celého podacieho balíka

### 2a – Prílohy
- [ ] Definovať maticu: *typ žiadosti → povinné/voliteľné prílohy*
- [ ] Upload príloh používateľom (živnostenský list, zmluvy, iné)
- [ ] Validácia formátu (len PDF) a veľkosti
- [ ] Automatické predvyplnenie príloh z už zadaných údajov kde je to možné
- [ ] UI: zoznam príloh s indikátorom povinné/voliteľné/nahraté

### 2b – Uloženie balíka
- [ ] Databáza žiadostí (PostgreSQL + Prisma ORM)
- [ ] Dátový model: žiadosť = XML + PDF + prílohy + metadata
- [ ] Stavy žiadosti: `rozpracovaná → pripravená → odoslaná → vybavená`
- [ ] Základná autentifikácia pre SZČO (email + heslo)
- [ ] Dashboard: prehľad žiadostí používateľa

---

## Fáza 3 – Poloautomatické odoslanie (manuálny most) 🖐️

> Cieľ: Používateľ odošle sám, ale systém mu maximálne pomôže

- [ ] Krok-za-krokom inštrukcie pre odoslanie na eformulare.socpoist.sk
- [ ] Export celého balíka do ZIP (XML + PDF + prílohy)
- [ ] Checklist pred odoslaním (všetky prílohy, validácia, dátumy)
- [ ] Manuálne zaznačenie stavu "odoslané" + dátum odoslania
- [ ] História pokusov o odoslanie

---

## Fáza 4 – Integrácia eID + eFormulare 🔐

> Cieľ: Prihlásenie cez eID na eformulare.socpoist.sk a automatická príprava

### 4a – Autentifikácia
- [ ] Integrácia **eID / login.gov.sk** (OAuth2/SAML)
- [ ] Prepojenie identity SZČO s jej žiadosťami v systéme
- [ ] Bezpečné ukladanie session tokenov

### 4b – Automatická príprava na portáli
- [ ] Browser automation (Playwright) – automatické vyplnenie formulára
- [ ] Priloženie príloh cez automatizáciu
- [ ] Overenie pred odoslaním (náhľad vyplneného formulára)
- [ ] Fallback na manuálny postup pri zlyhaní automatizácie

> ⚠️ Táto fáza závisí od stability portálu eformulare.socpoist.sk a dostupnosti API.

---

## Fáza 5 – Podpisovanie cez D.Suite / D.Signer ✍️

> Cieľ: Kvalifikovaný elektronický podpis dokumentov

- [ ] Integrácia **D.Suite / D.Signer API** pre KEP (kvalifikovaný el. podpis)
- [ ] Podpis XML súboru pred odoslaním
- [ ] Podpis PDF príloh
- [ ] Overenie platnosti podpisu pred odoslaním
- [ ] Uloženie podpísanej verzie do balíka
- [ ] UI: indikátor stavu podpisu (nepodpísané / podpisuje sa / podpísané)

---

## Fáza 6 – Sledovanie stavu a doručenie potvrdenia 📬

> Cieľ: Automatické zachytenie odpovede od Sociálnej poisťovne

### 6a – Slovensko.sk / GovBox
- [ ] Integrácia **GovBox API** (elektronická schránka na slovensko.sk)
- [ ] Monitoring schránky na nové správy týkajúce sa odoslaných žiadostí
- [ ] Automatické párovanie správ so žiadosťami v systéme
- [ ] Parsovanie potvrdenia o prijatí

### 6b – Notifikácie
- [ ] E-mail SZČO: potvrdenie o podaní (automaticky po odoslaní)
- [ ] E-mail SZČO: doručený dokument A1 (príloha PDF)
- [ ] Voliteľne: SMS notifikácia
- [ ] In-app notifikácie (badge, toast)

---

## Fáza 7 – Platobný systém 💳

> Cieľ: Monetizácia aplikácie

- [ ] Výber platobnej brány (Stripe alebo GP WebPay)
- [ ] Cenový model: *per žiadosť* alebo *predplatné* (mesačné/ročné)
- [ ] Automatická faktúrácia (pre účtovníkov/sprostredkovateľov)
- [ ] Free tier: napr. 1 žiadosť zadarmo pre nových používateľov
- [ ] Správa predplatného (zrušenie, zmena plánu)
- [ ] Webhook pre platobné udalosti

---

## Technologický stack – plánované rozšírenie

| Vrstva | Súčasný stav | Plánované |
|---|---|---|
| Frontend | React + TypeScript + Tailwind | + dashboard, upload |
| Backend | Express.js | + REST API, auth, WebSocket |
| PDF gen | Python + pypdf | zachovať |
| Databáza | — | PostgreSQL + Prisma ORM |
| Auth | — | eID OAuth2 + lokálna session |
| Podpis | — | D.Suite / D.Signer API |
| Schránka | — | GovBox API |
| Notifikácie | — | Nodemailer / SendGrid |
| Platby | — | Stripe alebo GP WebPay |
| Automation | — | Playwright |

---

## Odporúčané poradie priorít

```
Fáza 1 (dokončenie) → Fáza 2 → Fáza 3 → Fáza 5 → Fáza 4 → Fáza 6 → Fáza 7
```

> **Prečo Fáza 3 pred Fázou 4?**
> Manuálny most umožní reálne používanie aplikácie oveľa skôr, kým sa dokončí
> plná automatizácia. Fáza 4 závisí od stability portálu SP a dostupnosti API.

---

## Ako prispieť / sledovať postup

Každá fáza bude rozdelená na GitHub Issues s labelmi:
- `faza-1`, `faza-2`, ... `faza-7`
- `bug`, `enhancement`, `research`
- `blocked` – úlohy čakajúce na externú závislosť (API SP, GovBox, eID)

---

*Naposledy aktualizované: 2026-03-31*
