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
- [x] PostgreSQL + Prisma ORM
- [x] Dátový model: DocumentBundle + Attachment
- [x] Upload príloh (PDF, max 10MB, s typmi)
- [x] Tlačidlo "Podať žiadosť" → uloženie do DB s prílohami
- [x] Potvrdenie po podaní + návrat na úvodnú obrazovku
- [x] Admin rozhranie na /admin (HTTP Basic Auth)
- [x] Zoznam žiadostí s filtrom podľa stavu a typu
- [x] Detail žiadosti – zobrazenie vyplnených dát (JSON)
- [x] Generovanie skutočného XML zo žiadosti v DB
- [x] Stiahnutie ZIP balíka (XML + prílohy)
- [x] Stiahnutie jednotlivých príloh
- [x] Zmena stavu žiadosti (Nová → Skontrolovaná → Odoslaná → Vybavená)
- [x] Poznámka správcu ku každej žiadosti

---

## Fáza 1 – Stabilizácia základu 🔧

- [ ] Zobrazenie chýb XSD validácie priamo vo formulári (UI feedback)
- [ ] Dokončenie PDF pre formulár Uplatniteľná legislatíva
- [ ] Testovanie na reálnych podaniach (overenie akceptácie SP)

---

## Fáza 2 – Vylepšenia UX 🎨

- [ ] Potvrdzovacie okno pred podaním žiadosti
- [ ] Zobrazenie detailu vyplnených dát v admin rozhraní (nie surový JSON)
- [ ] Filtrovanie žiadostí podľa dátumu
- [ ] Vyhľadávanie žiadostí podľa IČO / mena

---

## Fáza 3 – Notifikácie 📬 *(voliteľná)*

- [ ] Email SZČO: potvrdenie o prijatí žiadosti
- [ ] Email správcu: notifikácia o novej žiadosti
- [ ] Email SZČO: informácia o stave (odoslaná / vybavená)
- [ ] Nodemailer alebo SendGrid

---

## Fáza 4 – Autentifikácia používateľov 🔐 *(voliteľná)*

- [ ] Registrácia / prihlásenie (email + heslo)
- [ ] Prepojenie žiadostí s účtom
- [ ] Dashboard SZČO – história podaní a ich stav
- [ ] Prípadne: prihlásenie cez eID / login.gov.sk

---

## Fáza 5 – Platobný systém 💳 *(voliteľná)*

- [ ] Výber platobnej brány (Stripe alebo GP WebPay)
- [ ] Cenový model: *per žiadosť* alebo *predplatné*
- [ ] Platba pred podaním žiadosti
- [ ] Automatická faktúrácia

---

## Technologický stack

| Vrstva | Stav |
|---|---|
| Frontend | React + TypeScript + Tailwind ✅ |
| Backend | Express.js + multer ✅ |
| PDF gen | Python + pypdf ✅ |
| XML gen | TypeScript (frontend + backend) ✅ |
| XML validácia | Python + lxml + XSD ✅ |
| Databáza | PostgreSQL + Prisma ORM ✅ |
| Prílohy | Uložené ako Bytes v DB ✅ |
| Admin | /admin + HTTP Basic Auth ✅ |
| ZIP export | archiver ✅ |
| Email | Nodemailer / SendGrid ⬜ |
| Používateľský auth | JWT alebo session ⬜ |
| eID | login.gov.sk ⬜ |
| Platby | Stripe alebo GP WebPay ⬜ |

---

*Naposledy aktualizované: 2026-04-24*
