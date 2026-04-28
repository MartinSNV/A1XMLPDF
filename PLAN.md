# Plán vývoja – A1 XMLPDF

> Aplikácia pre SZČO na podanie žiadostí na Sociálnu poisťovňu.
> SZČO vyplní formulár a priloží prílohy. Správca následne vygeneruje XML a odošle podanie na SP.

---

## Skutočný flow aplikácie (aktualizovaný)

```
SZČO                          Správca (ty)
────────────────────          ─────────────────────────
1. Vyplní formulár            6. Vidí zoznam žiadostí
2. Priloží prílohy            7. Vygeneruje XML
3. Podpíše splnomocnenie      8. Stiahne ZIP (XML + prílohy + splnomocnenie)
4. Podá žiadosť               9. Odošle na SP
5. Uloží sa do DB
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
- [x] Upload príloh (PDF, max 20MB, s typmi, kamera)
- [x] Tlačidlo "Podať žiadosť" → uloženie do DB s prílohami
- [x] Potvrdenie po podaní + návrat na úvodnú obrazovku
- [x] Admin rozhranie na /admin (HTTP Basic Auth)
- [x] Zoznam žiadostí s filtrom podľa stavu a typu
- [x] Generovanie skutočného XML zo žiadosti v DB
- [x] Stiahnutie ZIP balíka (XML + prílohy)
- [x] Stiahnutie jednotlivých príloh
- [x] Zmena stavu žiadosti
- [x] Poznámka správcu ku každej žiadosti
- [x] Splnomocnenie pred odoslaním (PD A1)
  - dynamický text z dát formulára (meno, IČO, adresa, typ žiadosti)
  - canvas podpis myšou aj prstom (touch events)
  - krok medzi prílohami a odoslaním; "Podať žiadosť" dostupné až po podpise
  - signatureBase64 sa posiela na backend pri odoslaní

---

## Blok A – Nasadenie a testovanie v produkcii 🚀

> Cieľ: Aplikácia beží na Northflank s reálnou DB

- [ ] A1 – Trigger nový deploy na Northflank po posledných zmenách
- [ ] A2 – Overiť že DATABASE_URL, ADMIN_USER, ADMIN_PASS sú nastavené
- [ ] A3 – Otestovať podanie žiadosti v produkcii (vrátane splnomocnenia)
- [ ] A4 – Otestovať admin rozhranie v produkcii (ZIP, XML, prílohy)
- [ ] A5 – Skontrolovať logy ak niečo nefunguje

---

## Blok B – Stabilizácia formulárov 🔧

> Cieľ: Formuláre sú spoľahlivé a dávajú feedback

- [x] B1 – Zobraziť chyby XSD validácie priamo vo formulári po kliknutí "Podať žiadosť"
- [x] B2 – Potvrdzovacie okno pred podaním ("Naozaj chcete podať žiadosť?")
- [ ] B3 – Dokončenie PDF pre formulár Uplatniteľná legislatíva
- [ ] B4 – Splnomocnenie aj pre formulár Uplatniteľná legislatíva
- [ ] B5 – Uloženie podpisu (signatureBase64) do DB (pole v modeli DocumentBundle)
- [ ] B6 – Testovanie na reálnych podaniach (overenie akceptácie SP)

---

## Blok C – Vylepšenie admin rozhrania 🛠️

> Cieľ: Admin rozhranie je prehľadné a použiteľné

- [ ] C1 – Detail žiadosti: čitateľný prehľad dát (nie surový JSON)
- [ ] C2 – Zobraziť/stiahnuť podpis splnomocnenia v detaile žiadosti
- [ ] C3 – Filtrovanie podľa dátumu (od/do)
- [ ] C4 – Vyhľadávanie podľa IČO alebo mena
- [ ] C5 – Počet nových žiadostí v hlavičke (badge)
- [ ] C6 – Možnosť zmazať žiadosť (s potvrdením)

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

*Naposledy aktualizované: 2026-04-28*
