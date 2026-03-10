#!/usr/bin/env python3
"""
fill_a1_pdf.py  –  Fills the Slovak A1 SZCO form with data from a JSON file.
Usage: python fill_a1_pdf.py <input.pdf> <data.json> <output.pdf>

Requires: pypdf  (pip install pypdf)
"""
import json
import sys
from datetime import date

try:
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import NameObject, TextStringObject, BooleanObject
except ImportError:
    print("ERROR: pypdf is not installed. Run: pip install pypdf", file=sys.stderr)
    sys.exit(2)


def fmt_date(val: str) -> str:
    """Converts yyyy-mm-dd (HTML date input) to dd.mm.yyyy for the PDF."""
    if not val:
        return ""
    if len(val) == 10 and val[4] == "-" and val[7] == "-":
        return val[8:10] + "." + val[5:7] + "." + val[0:4]
    return val


def addr_line(a: dict) -> str:
    cislo = "/".join(filter(None, [a.get("supisneCislo", ""), a.get("orientacneCislo", "")]))
    return " ".join(filter(None, [a.get("ulica", ""), cislo]))


def koresp(d: dict) -> str:
    if not d.get("zadatKorespodencnuAdresu"):
        return ""
    ka = d.get("korespodencnaAdresa", {})
    cislo = "/".join(filter(None, [ka.get("supisneCislo", ""), ka.get("orientacneCislo", "")]))
    return ", ".join(filter(None, [
        ka.get("ulica", ""), cislo, ka.get("obec", ""), ka.get("psc", "")
    ]))


def fill(input_pdf: str, data_json: str, output_pdf: str):
    with open(data_json, encoding="utf-8") as f:
        d = json.load(f)

    reader = PdfReader(input_pdf)
    writer = PdfWriter(clone_from=reader)

    addr  = d.get("adresaPobytu", {})
    va    = d.get("adresaVyslania", {})
    today = date.today()
    today_str = f"{today.day:02d}.{today.month:02d}.{today.year}"

    # Map field names to values
    values = {
        # Page 1
        "pobocka":               d.get("pobocka", ""),
        "titulPred":             d.get("titulPred", ""),
        "meno":                  d.get("meno", ""),
        "priezvisko":            d.get("priezvisko", ""),
        "titulZa":               d.get("titulZa", ""),
        "datumNarodenia":        fmt_date(d.get("datumNarodenia", "")),
        "miestoNarodenia":       d.get("miestoNarodenia", ""),
        "statnaPrislusnost":     d.get("statnaPrislusnost", ""),
        "rodnePriezvisko":       d.get("rodnePriezvisko", ""),
        "rodneCislo":            d.get("rodneCislo", ""),
        "ico":                   d.get("ico", ""),
        "adresaUlica":           addr_line(addr),
        "adresaObec":            addr.get("obec", ""),
        "adresaPsc":             addr.get("psc", ""),
        "adresaStat":            addr.get("stat", ""),
        "telefon":               d.get("telefon", ""),
        "email":                 d.get("email", ""),
        "korespondencia":        koresp(d),
        "adresaDoručenia":       d.get("adresaPrechodnehoPobytu", ""),
        "datumZaciatkuCinnosti": fmt_date(d.get("datumZaciatkuCinnosti", "")),
        "cinnostPredVyslanim":   d.get("cinnostSZCONaSlovensku", ""),
        # Page 2
        "popisCinnosti":         d.get("popisCinnosti", ""),
        "nazovSubjektu":         d.get("obchodneMenoPrijimajucejOsoby", ""),
        "icoSubjektu":           d.get("icoPrijimajucejOsoby", ""),
        "vyslanieUlica":         addr_line(va),
        "vyslanieObec":          va.get("obec", ""),
        "vyslaniePsc":           va.get("psc", ""),
        "vyslanieStat":          va.get("stat", "") or d.get("statVyslania", ""),
        "kontaktnaOsoba":        "",
        "lod":                   "",
        "vyslanieOd":            fmt_date(d.get("datumZaciatkuVyslania", "")),
        "vyslanieDo":            fmt_date(d.get("datumKoncaVyslania", "")),
        "skNace":                d.get("skNace", ""),
        "predoslaOd":            fmt_date(d.get("cinnostVStatePredOd", "")),
        "predoslaDo":            fmt_date(d.get("cinnostVStatePredDo", "")),
        "e101Od":                fmt_date(d.get("vydanyVInejKrajineOd", "")),
        "e101Do":                fmt_date(d.get("vydanyVInejKrajineDo", "")),
        "e101Dna":               fmt_date(d.get("vydanyVInejKrajineDatum", "")),
        "e101Institucia":        d.get("vydanyVInejKrajineInstitucia", ""),
        "poznamka":              d.get("poznamka", ""),
        # Page 3
        "miestoVyslania":        d.get("miestoNarodenia", ""),
        "datumPodpisu":          today_str,
    }

    # Set /V directly on each annotation (avoids /DR font resource bug in pypdf)
    for page in writer.pages:
        if "/Annots" not in page:
            continue
        for annot_ref in page["/Annots"]:
            annot = annot_ref.get_object()
            fname = str(annot.get("/T", ""))
            if fname in values:
                annot[NameObject("/V")] = TextStringObject(values[fname])

    # NeedAppearances = True → PDF viewer renders field values on open
    root = writer._root_object
    if "/AcroForm" in root:
        root["/AcroForm"].get_object()[NameObject("/NeedAppearances")] = BooleanObject(True)

    with open(output_pdf, "wb") as f:
        writer.write(f)
    print("OK")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: fill_a1_pdf.py <input.pdf> <data.json> <output.pdf>", file=sys.stderr)
        sys.exit(1)
    fill(sys.argv[1], sys.argv[2], sys.argv[3])