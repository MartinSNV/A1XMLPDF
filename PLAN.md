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
- [x] PostgreSQL + Prisma ORM + Attachment model
- [x] Upload príloh (PDF, max 10MB, s typmi)
- [x] Tlačidlo "Podať žiadosť" → uloženie do DB s prílohami
- [x] Potvrdenie po podaní + návrat na úvodnú obrazovku
- [x] Admin rozhranie na /admin (HTTP Basic Auth)
- [x] Zoznam žiadostí s filtrom podľa stavu a typu
- [x] Generovanie skutočného XML zo žiadosti v DB
- [x] Stiahnutie ZIP balíka (XML + prílohy)
- [x] Stiahnutie jednotlivých príloh
- [x] Zmena stavu žiadosti
- [x] Poznámka správcu ku každej žiadosti

---

## Blok A – Nasadenie a testovanie v produkcii 🚀

> Cieľ: Aplikácia beží na Northflank s reálnou DB

- [ ] A1 – Trigger nový deploy na Northflank po posledných zmenách
- [ ] A2 – Overiť že DATABASE_URL, ADMIN_USER, ADMIN_PASS sú nastavené
- [ ] A3 – Otestovať podanie žiadosti v produkcii
- [ ] A4 – Otestovať admin rozhranie v produkcii (ZIP, XML, prílohy)
- [ ] A5 – Skontrolovať logy ak niečo nefunguje

---

## Blok B – Stabilizácia formulárov 🔧

> Cieľ: Formuláre sú spoľahlivé a dávajú feedback

- [ ] B1 – Zobraziť chyby XSD validácie priamo vo formulári po kliknutí "Podať žiadosť"
- [ ] B2 – Potvrdzovacie okno pred podaním ("Naozaj chcete podať žiadosť?")
- [ ] B3 – Dokončenie PDF pre formulár Uplatniteľná legislatíva
- [ ] B4 – Testovanie na reálnych podaniach (overenie akceptácie SP)

---

## Blok C – Vylepšenie admin rozhrania 🛠️

> Cieľ: Admin rozhranie je prehľadné a použiteľné

- [ ] C1 – Detail žiadosti: čitateľný prehľad dát (nie surový JSON)
- [ ] C2 – Filtrovanie podľa dátumu (od/do)
- [ ] C3 – Vyhľadávanie podľa IČO alebo mena
- [ ] C4 – Počet nových žiadostí v hlavičke (badge)
- [ ] C5 – Možnosť zmazať žiadosť (s potvrdením)

---

## Blok D – Notifikácie emailom 📬 *(voliteľný)*

> Cieľ: Automatické emaily pri podaní a zmene stavu

- [ ] D1 – Nastaviť Nodemailer + SMTP (Gmail alebo SendGrid)
- [ ] D2 – Email SZČO: potvrdenie o prijatí žiadosti (s ID)
- [ ] D3 – Email správcu: notifikácia o novej žiadosti
- [ ] D4 – Email SZČO: informácia keď je žiadosť odoslaná / vybavená

---

## Blok E – Autentifikácia SZČO 🔐 *(voliteľný)*

> Cieľ: SZČO sa prihlási a vidí históriu svojich žiadostí

- [ ] E1 – Registrácia / prihlásenie (email + heslo)
- [ ] E2 – Prepojenie žiadostí s účtom SZČO
- [ ] E3 – Dashboard SZČO – história podaní a ich stav
- [ ] E4 – Prípadne: prihlásenie cez eID / login.gov.sk

---

## Blok F – Platobný systém 💳 *(voliteľný)*

> Cieľ: Monetizácia aplikácie

- [ ] F1 – Výber platobnej brány (Stripe alebo GP WebPay)
- [ ] F2 – Cenový model: *per žiadosť* alebo *predplatné*
- [ ] F3 – Platba pred podaním žiadosti
- [ ] F4 – Automatická faktúrácia

---

## Odporúčané poradie

```
Blok A → Blok B → Blok C → Blok D → Blok E → Blok F
```

---

*Naposledy aktualizované: 2026-04-24*
