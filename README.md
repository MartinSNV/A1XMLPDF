# A1 SZČO – Generátor žiadosti o vystavenie PD A1

Webová aplikácia pre vyplnenie a stiahnutie žiadosti o vystavenie prenosného dokumentu A1 pre samostatne zárobkovo činnú osobu vyslanú do iného členského štátu EÚ.

## Funkcie

- Automatické vyplnenie údajov z RPO (Registra právnických osôb) podľa IČO
- Export do XML (pre elektronické podanie)
- Export do PDF (vyplnený formulár Sociálnej poisťovne)

## Lokálny vývoj

### Požiadavky
- Node.js 22+
- Python 3.10+
- pypdf: `pip install pypdf`

### Spustenie
```bash
npm install
npm run dev
```

Aplikácia beží na http://localhost:3000

## Produkčné nasadenie (Docker)

```bash
docker build -t a1-szco .
docker run -p 3000:3000 -e NODE_ENV=production a1-szco
```

## Premenné prostredia

| Premenná | Popis | Povinná |
|---|---|---|
| `PORT` | Port servera (default: 3000) | Nie |
| `BROWSERLESS_API_KEY` | API kľúč pre Browserless proxy | Nie |
