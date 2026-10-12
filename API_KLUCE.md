# Prístup k `/api/rpo/*`

Endpoint je chránený. Existujú dve cesty prístupu a **bez jednej z nich vráti 401**.

| Kto | Overenie | Limit |
|---|---|---|
| Appka A1XMLPDF (prehliadač) | `X-App-Token` – server ho sám vloží do HTML | na IP (60 / 5 min) |
| Ostatné projekty (VBA, backendy) | `X-API-Key` | **denná kvóta na kľúč** + na IP |
| Hocikto iný | ❌ 401 | — |

Overenie beží bez databázového dotazu (HMAC, resp. kľúče v pamäti), takže na rýchlosť
nemá merateľný vplyv – latenciu určuje samotný RPO lookup.

---

## Nastavenie (jednorazovo)

V Northflank ENV pridaj:

```
APP_TOKEN_SECRET=<náhodný reťazec, min. 32 znakov>
```

Vygenerovať sa dá takto:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Bez tejto premennej server použije náhodný dočasný secret: appka bude fungovať,
> ale po každom reštarte prestanú platiť vydané tokeny (a pri viacerých instanciách
> by si tokeny navzájom neuznali). V logu sa objaví varovanie.

---

## Správa API kľúčov

```bash
# zoznam kľúčov aj s vyťažením
npx tsx scripts/api_key.ts list

# nový kľúč (názov + denná kvóta, default 200)
npx tsx scripts/api_key.ts create "Projekt XY – VBA" 500

# dočasné vypnutie / zapnutie
npx tsx scripts/api_key.ts disable <id>
npx tsx scripts/api_key.ts enable  <id>

# trvalé zmazanie
npx tsx scripts/api_key.ts delete <id>
```

Plaintext kľúč sa zobrazí **iba raz** pri vytvorení – v DB je len SHA-256 hash.
Keď sa stratí, vytvor nový a starý zmaž.

Zmeny (vypnutie, zmazanie) sa prejavia **do 1 minúty** – server drží kľúče v pamäti
a obnovuje ich raz za minútu.

### Prečo kľúč pre každý projekt zvlášť

Kľúč vo VBA sa dá z makra vytiahnuť (ochrana VBA projektu heslom sa láme ľahko).
Preto ochrana nestojí na jeho utajení, ale na tom, že:

- každý projekt má **vlastný** kľúč → unikne len jeden a zrušíš práve ten,
- každý kľúč má **dennú kvótu** → aj ukradnutý kľúč nevyťaží celý register,
- vidíš **vyťaženie** každého kľúča → zneužitie si všimneš.

Pri VBA klientoch je limit na IP takmer bezcenný (každý používateľ má inú IP),
takže skutočný strop je kvóta na kľúč.

---

## Použitie z VBA (Excel / Access)

```vba
Option Explicit

Private Const API_BASE As String = "https://p01--a1xmlpdf--zvrnypvb9jkl.code.run"
Private Const API_KEY  As String = "a1k_SEM_VLOZ_SVOJ_KLUC"

' Vráti JSON z RPO pre dané IČO, alebo "" pri chybe.
Public Function RpoEntity(ByVal ico As String) As String
    Dim http As Object
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")

    http.Open "GET", API_BASE & "/api/rpo/entity?ico=" & ico, False
    http.setRequestHeader "X-API-Key", API_KEY
    http.setRequestHeader "Accept", "application/json"
    http.send

    Select Case http.Status
        Case 200
            RpoEntity = http.responseText
        Case 400
            MsgBox "IČO musí mať presne 8 číslic.", vbExclamation
        Case 401
            MsgBox "Neplatný API kľúč.", vbCritical
        Case 403
            MsgBox "API kľúč je deaktivovaný.", vbCritical
        Case 429
            MsgBox "Vyčerpaná denná kvóta alebo príliš veľa dotazov.", vbExclamation
        Case Else
            MsgBox "Chyba " & http.Status & ": " & http.responseText, vbCritical
    End Select
End Function

' Príklad použitia
Public Sub Test()
    Debug.Print RpoEntity("32484500")
End Sub
```

Poznámky:

- `MSXML2.ServerXMLHTTP.6.0` je pre makrá lepšie než `XMLHTTP` – nekešuje
  a na aktuálnych Windows podporuje TLS 1.2+.
- Kľúč posielaj **v hlavičke, nie v URL**. Query string sa inak zapíše do logov
  a histórie proxy.
- VBA nemá CORS ani preflight, takže netreba nič ďalšie riešiť.

---

## Použitie z curl / backendu

```bash
curl -H "X-API-Key: a1k_..." \
  "https://p01--a1xmlpdf--zvrnypvb9jkl.code.run/api/rpo/entity?ico=32484500"
```

## Odpovede

| Kód | Význam |
|---|---|
| 200 | OK |
| 400 | IČO nie je 8 číslic |
| 401 | chýbajúci / neplatný kľúč alebo app token |
| 403 | kľúč je deaktivovaný |
| 429 | vyčerpaná denná kvóta kľúča, alebo IP limit (60 / 5 min) |
| 503 | API kľúče nie sú nakonfigurované (chýba DB) |

---

## Čo to nerieši

Determinovaný útočník, ktorý si pustí headless prehliadač na tvoju appku, si app token
vytiahne. Cieľom tejto ochrany je spraviť **lacné zneužitie nepraktickým** a predovšetkým
**ohraničiť škodu kvótami** – nie dosiahnuť nepriestrelnosť.

Ak by si potreboval viac, ďalší krok je Cloudflare pred appkou (bot detection a
rate-limiting na edge) – proti scrapingu z mnohých IP je to jediná reálne účinná vrstva,
keďže limit na IP tam nepomôže.
