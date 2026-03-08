#!/usr/bin/env python3
"""
fill_a1_pdf.py  –  Fills the Slovak A1 SZCO form with data from a JSON file.
Usage: python fill_a1_pdf.py <input.pdf> <data.json> <output.pdf>

Requires: pypdf  (pip install pypdf)
"""
import json
import sys
import os

try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    print("ERROR: pypdf is not installed. Run: pip install pypdf", file=sys.stderr)
    sys.exit(2)


def fmt_date(val: str) -> str:
    """Converts yyyy-mm-dd (HTML date input) to dd.mm.yyyy for the PDF."""
    if not val:
        return ""
    if len(val) == 10 and val[4] == "-" and val[7] == "-":
        return val[8:10] + "." + val[5:7] + "." + val[0:4]
    return val  # already in another format, return as-is


def fill(input_pdf: str, data_json: str, output_pdf: str):
    with open(data_json, encoding="utf-8") as f:
        d = json.load(f)

    reader = PdfReader(input_pdf)
    writer = PdfWriter(clone_from=reader)

    # ── helpers ──────────────────────────────────────────────────────────────
    def p1(fields):
        writer.update_page_form_field_values(writer.pages[0], fields, auto_regenerate=True)

    def p2(fields):
        writer.update_page_form_field_values(writer.pages[1], fields, auto_regenerate=True)

    def p3(fields):
        writer.update_page_form_field_values(writer.pages[2], fields, auto_regenerate=True)

    def addr_line(a):
        cislo = "/".join(filter(None, [a.get("supisneCislo",""), a.get("orientacneCislo","")]))
        return " ".join(filter(None, [a.get("ulica",""), cislo]))

    # ── Page 1 ───────────────────────────────────────────────────────────────
    addr = d.get("adresaPobytu", {})
    p1({
        "topmostSubform[0].Page1[0].fill_1[0]":  d.get("pobocka", ""),
        "topmostSubform[0].Page1[0].Group1[0]":  "/0" if d.get("pohlavie") == "Muž" else "/1",
        "topmostSubform[0].Page1[0].Text1[0]":   d.get("titulPred", ""),
        "topmostSubform[0].Page1[0].Text2[0]":   d.get("meno", ""),
        "topmostSubform[0].Page1[0].Text3[0]":   d.get("priezvisko", ""),
        "topmostSubform[0].Page1[0].Text4[0]":   d.get("titulZa", ""),
        "topmostSubform[0].Page1[0].Text5[0]":   fmt_date(d.get("datumNarodenia", "")),
        "topmostSubform[0].Page1[0].Text6[0]":   d.get("miestoNarodenia", ""),
        "topmostSubform[0].Page1[0].Text7[0]":   d.get("statnaPrislusnost", ""),
        "topmostSubform[0].Page1[0].Text8[0]":   d.get("rodnePriezvisko", ""),
        "topmostSubform[0].Page1[0].Text9[0]":   d.get("rodneCislo", ""),
        "topmostSubform[0].Page1[0].Text10[0]":  d.get("ico", ""),
        "topmostSubform[0].Page1[0].Text11[0]":  addr_line(addr),
        "topmostSubform[0].Page1[0].Text12[0]":  addr.get("obec", ""),
        "topmostSubform[0].Page1[0].Text13[0]":  addr.get("psc", ""),
        "topmostSubform[0].Page1[0].Text14[0]":  addr.get("stat", ""),
        "topmostSubform[0].Page1[0].Text15[0]":  d.get("telefon", ""),
        "topmostSubform[0].Page1[0].Text16[0]":  d.get("email", ""),
        "topmostSubform[0].Page1[0].Text17[0]":  "",
        "topmostSubform[0].Page1[0].Text18[0]":  _koresp(d),
        "topmostSubform[0].Page1[0].Text19[0]":  "",
        "topmostSubform[0].Page1[0].Text20[0]":  fmt_date(d.get("datumZaciatkuCinnosti", "")),
        "topmostSubform[0].Page1[0].Text21[0]":  d.get("cinnostSZCONaSlovensku", ""),
    })

    # ── Page 2 ───────────────────────────────────────────────────────────────
    va = d.get("adresaVyslania", {})
    omvc = d.get("obvykleMiestoVykonuCinnosti", False)
    p2({
        "topmostSubform[0].Page2[0].Tetx23[0]":  d.get("popisCinnosti", ""),
        "topmostSubform[0].Page2[0].Group3[0]":  "/0" if omvc else "/1",
        "topmostSubform[0].Page2[0].Group4[0]":  "/0" if omvc else "/1",
        "topmostSubform[0].Page2[0].Tetx24[0]":  d.get("obchodneMenoPrijimajucejOsoby", ""),
        "topmostSubform[0].Page2[0].Tetx25[0]":  d.get("icoPrijimajucejOsoby", ""),
        "topmostSubform[0].Page2[0].Tetx26[0]":  addr_line(va),
        "topmostSubform[0].Page2[0].Tetx27[0]":  va.get("obec", ""),
        "topmostSubform[0].Page2[0].Tetx28[0]":  va.get("psc", ""),
        "topmostSubform[0].Page2[0].Tetx29[0]":  va.get("stat", "") or d.get("statVyslania", ""),
        "topmostSubform[0].Page2[0].Tetx30[0]":  "",
        "topmostSubform[0].Page2[0].Text31[0]":  "",
        "topmostSubform[0].Page2[0].od[0]":      fmt_date(d.get("datumZaciatkuVyslania", "")),
        "topmostSubform[0].Page2[0].do[0]":      fmt_date(d.get("datumKoncaVyslania", "")),
        "topmostSubform[0].Page2[0].Text32[0]":  d.get("skNace", ""),
        "topmostSubform[0].Page2[0].Group5[0]":  "/1",
        "topmostSubform[0].Page2[0].od_1[0]":    "",
        "topmostSubform[0].Page2[0].do_1[0]":    "",
        "topmostSubform[0].Page2[0].Group6[0]":  "/1",
        "topmostSubform[0].Page2[0].od_2[0]":    "",
        "topmostSubform[0].Page2[0].do_2[0]":    "",
        "topmostSubform[0].Page2[0].Text33[0]":  "",
        "topmostSubform[0].Page2[0].Text34[0]":  "",
        "topmostSubform[0].Page2[0].Text35[0]":  d.get("poznamka", ""),
    })

    # ── Page 3 ───────────────────────────────────────────────────────────────
    from datetime import date
    today = date.today()
    today_str = f"{today.day:02d}.{today.month:02d}.{today.year}"
    p3({
        "topmostSubform[0].Page3[0].Text36[0]": d.get("miestoNarodenia", ""),
        "topmostSubform[0].Page3[0].Text37[0]": today_str,
    })

    writer.set_need_appearances_writer(True)
    with open(output_pdf, "wb") as f:
        writer.write(f)
    print("OK")


def _koresp(d):
    if not d.get("zadatKorespodencnuAdresu"):
        return ""
    ka = d.get("korespodencnaAdresa", {})
    cislo = "/".join(filter(None, [ka.get("supisneCislo",""), ka.get("orientacneCislo","")]))
    return ", ".join(filter(None, [
        ka.get("ulica",""), cislo, ka.get("obec",""), ka.get("psc","")
    ]))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: fill_a1_pdf.py <input.pdf> <data.json> <output.pdf>", file=sys.stderr)
        sys.exit(1)
    fill(sys.argv[1], sys.argv[2], sys.argv[3])
