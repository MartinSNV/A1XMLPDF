# Plán vývoja – A1 XMLPDF

> Aplikácia pre SZČO na podanie žiadostí na Sociálnu poisťovňu.
> SZČO vyplní formulár a priloží prílohy. Správca následne vygeneruje XML a odošle podanie na SP.

---

## Skutočný flow aplikácie

```
SZČO                          Správca (ty)
────────────────────          ─────────────────────────
1. Vyplní formulár            5. Vidí zoznam žiadostí
2. Priloží prílohy            6. Vygeneruje XML
3. Podá žiadosť               7. Stiahne ZIP (XML + prílohy)
4. Uloží sa do DB             8. Odošle na SP
```

> Generovanie XML/PDF priamo pre klienta je **dočasná funkcia** určená len na testovanie — v produkcii sa nepoužije.

---

## Aktuálny stav ✅

- [x] Formulár PD A1 – vyslanie SZČO do EÚ (XML + PDF)
- [x] Formulár Žiadosť o určenie uplatniteľnej legislatívy (XML)
- [x] Načítanie údajov z RPO podľa IČO
- [x] Výber formulára po načítaní IČO
- [x] Generovanie PDF cez Python/pypdf backend
- [x] Deploy na Northflank cez Docker
- [x] XSD validácia XML voči schémam slovensko.sk (v12.0)
- [x] Endpoint POST /api/validate-xml

---

## Fáza 1 – Stabilizácia základu 🔧

> Cieľ: Formuláre sú funkčné, validované a pripravené na napojenie na DB

- [ ] Zobrazenie chýb XSD validácie priamo vo formulári (UI feedback)
- [ ] Dokončenie PDF pre formulár Uplatniteľná legislatíva
- [ ] Testovanie na reálnych podaniach (overenie akceptácie SP)

---

## Fáza 2 – Uloženie žiadosti do databázy 💾

> Cieľ: SZČO podá žiadosť → uloží sa do DB aj s prílohami

### 2a – Databáza
- [ ] PostgreSQL + Prisma ORM (pridať do Docker/Northflank)
- [ ] Dátový model:
  - `Submission` – žiadosť (typ, dátumy, stav, JSON dát formulára)
  - `Attachment` – príloha (názov, typ, binárne dáta alebo S3 URL)
- [ ] Stavy žiadosti: `nová → skontrolovaná → odoslaná → vybavená`

### 2b – Upload príloh
- [ ] Definovať maticu: *typ žiadosti → povinné/voliteľné prílohy*
- [ ] UI pre upload príloh (živnostenský list, zmluvy, iné)
- [ ] Validácia formátu (PDF) a veľkosti
- [ ] Uloženie príloh do DB alebo objektového úložiska

### 2c – Podanie žiadosti
- [ ] Tlačidlo "Podať žiadosť" namiesto "Stiahnuť XML"
- [ ] Potvrdzovacie okno pred podaním
- [ ] Potvrdenie pre SZČO po úspešnom podaní (stránka / email)

---

## Fáza 3 – Admin rozhranie 🛠️

> Cieľ: Ty ako správca vidíš žiadosti a môžeš ich spracovať

- [ ] Jednoduché admin rozhranie (samostatná URL, napr. `/admin`)
- [ ] Základná ochrana adminu (HTTP Basic Auth alebo env token)
- [ ] Zoznam žiadostí s filtrom podľa stavu a typu
- [ ] Detail žiadosti – zobrazenie vyplnených dát
- [ ] Generovanie XML zo žiadosti (zo dát v DB)
- [ ] Stiahnutie ZIP balíka (XML + všetky prílohy)
- [ ] Zmena stavu žiadosti (skontrolovaná / odoslaná / vybavená)
- [ ] Poznámka správcu ku každej žiadosti

---

## Fáza 4 – Notifikácie 📬

> Cieľ: SZČO dostane potvrdenie, správca dostane upozornenie

- [ ] Email SZČO: potvrdenie o prijatí žiadosti
- [ ] Email správcu: notifikácia o novej žiadosti
- [ ] Email SZČO: informácia o stave (odoslaná / vybavená)
- [ ] Nodemailer alebo SendGrid

---

## Fáza 5 – Autentifikácia používateľov 🔐 *(voliteľná)*

> Cieľ: SZČO sa prihlási a vidí históriu svojich žiadostí

- [ ] Registrácia / prihlásenie (email + heslo)
- [ ] Prepojenie žiadostí s účtom
- [ ] Dashboard SZČO – história podaní a ich stav
- [ ] Prípadne: prihlásenie cez eID / login.gov.sk

---

## Fáza 6 – Platobný systém 💳 *(voliteľná)*

> Cieľ: Monetizácia aplikácie

- [ ] Výber platobnej brány (Stripe alebo GP WebPay)
- [ ] Cenový model: *per žiadosť* alebo *predplatné*
- [ ] Platba pred podaním žiadosti
- [ ] Automatická faktúrácia

---

## Technologický stack

| Vrstva | Súčasný stav | Plánované |
|---|---|---|
| Frontend | React + TypeScript + Tailwind | + upload príloh, admin UI |
| Backend | Express.js | + Prisma, file handling |
| PDF gen | Python + pypdf | zachovať |
| XML validácia | Python + lxml + XSD | zachovať |
| Databáza | — | PostgreSQL + Prisma ORM |
| Úložisko príloh | — | DB blob alebo S3/R2 |
| Email | — | Nodemailer / SendGrid |
| Admin auth | — | HTTP Basic / env token |
| Používateľský auth | — | JWT alebo session (neskôr) |
| eID | — | login.gov.sk (neskôr) |
| Platby | — | Stripe alebo GP WebPay (neskôr) |

---

## Odporúčané poradie

```
Fáza 1 → Fáza 2 → Fáza 3 → Fáza 4 → Fáza 5 → Fáza 6
```

---

*Naposledy aktualizované: 2026-04-24*
