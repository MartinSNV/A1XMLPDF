#!/usr/bin/env python3
"""
Generuje PDF splnomocnenia zo vstupného JSON (stdin).
Výstup: binárne PDF bajty na stdout.
"""
import sys
import json
import base64
import tempfile
import os
from fpdf import FPDF

FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")

AGENT_NAME = "Vaša firma s.r.o."
AGENT_ICO = "12345678"

FORM_NAME = {
    "PD_A1": "PD A1 – Žiadosť o vystavenie prenosného dokumentu A1 z dôvodu vyslania SZČO",
    "UPLATNITELNA_LEGISLATIVA": "Žiadosť o určenie uplatniteľnej legislatívy pre SZČO",
}


def main():
    data = json.loads(sys.stdin.buffer.read().decode('utf-8'))

    meno = data.get("meno", "")
    obchodne_meno = data.get("obchodneMeno", "")
    ico = data.get("ico", "")
    adresa_str = data.get("adresaStr", "")
    obec = data.get("obec", "")
    form_type = data.get("formType", "PD_A1")
    form_name = FORM_NAME.get(form_type, form_type)
    signature_b64 = data.get("signatureBase64", "")
    datum = data.get("datum", "")

    pdf = FPDF()
    pdf.add_page()
    pdf.set_margins(20, 20, 20)

    pdf.add_font("DejaVu", fname=os.path.join(FONTS_DIR, "DejaVuSans.ttf"))
    pdf.add_font("DejaVu", style="B", fname=os.path.join(FONTS_DIR, "DejaVuSans-Bold.ttf"))

    # ── Nadpis ──────────────────────────────────────────────────────────────
    pdf.set_font("DejaVu", style="B", size=18)
    pdf.cell(0, 12, "SPLNOMOCNENIE", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # ── Splnomocniteľ ───────────────────────────────────────────────────────
    pdf.set_font("DejaVu", style="B", size=8)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 5, "SPLNOMOCNITEĽ", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)

    pdf.set_font("DejaVu", style="B", size=11)
    pdf.cell(0, 7, meno or "(meno a priezvisko)", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("DejaVu", size=10)
    if obchodne_meno:
        pdf.cell(0, 6, obchodne_meno, new_x="LMARGIN", new_y="NEXT")
    if ico:
        pdf.cell(0, 6, f"IČO: {ico}", new_x="LMARGIN", new_y="NEXT")
    if adresa_str:
        pdf.cell(0, 6, adresa_str, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # ── "týmto splnomocňujem" ───────────────────────────────────────────────
    pdf.set_font("DejaVu", size=10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 7, "týmto splnomocňujem", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(4)

    # ── Splnomocnenec ───────────────────────────────────────────────────────
    pdf.set_font("DejaVu", style="B", size=8)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 5, "SPLNOMOCNENEC", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)

    pdf.set_font("DejaVu", style="B", size=11)
    pdf.cell(0, 7, AGENT_NAME, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVu", size=10)
    pdf.cell(0, 6, f"IČO: {AGENT_ICO}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # ── Účel splnomocnenia ──────────────────────────────────────────────────
    pdf.set_fill_color(245, 245, 245)
    pdf.set_font("DejaVu", size=10)
    pdf.cell(0, 6, "na zastupovanie a podanie žiadosti typu:", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVu", style="B", size=10)
    pdf.multi_cell(0, 6, form_name, fill=True, padding=(3, 4, 3, 4))
    pdf.set_font("DejaVu", size=10)
    pdf.cell(0, 6, "na Sociálnu poisťovňu v mojom mene.", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)

    # ── Rozsah splnomocnenia ────────────────────────────────────────────────
    pdf.set_font("DejaVu", size=10)
    pdf.cell(0, 6, "Splnomocnenie sa vzťahuje na:", new_x="LMARGIN", new_y="NEXT")
    for item in [
        "podanie formulára na Sociálnu poisťovňu SR",
        "komunikáciu so Sociálnou poisťovňou vo veci tejto žiadosti",
        "prevzatie písomností a rozhodnutí v danej veci",
    ]:
        pdf.cell(6, 6, "•")
        pdf.cell(0, 6, item, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)

    # ── Dátum a miesto ──────────────────────────────────────────────────────
    pdf.set_font("DejaVu", size=10)
    pdf.cell(0, 6, f"V {obec or '___________'}, dňa {datum}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)

    # ── Meno podpisateľa ────────────────────────────────────────────────────
    pdf.set_font("DejaVu", size=9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 5, "Splnomocniteľ:", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("DejaVu", style="B", size=10)
    pdf.cell(0, 6, meno or "______________________", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # ── Podpis ──────────────────────────────────────────────────────────────
    if signature_b64:
        sig = signature_b64
        if "," in sig:
            sig = sig.split(",", 1)[1]
        img_bytes = base64.b64decode(sig)
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            f.write(img_bytes)
            tmp_path = f.name
        try:
            pdf.image(tmp_path, w=80, h=25)
        finally:
            os.unlink(tmp_path)
        pdf.ln(2)

    # Linka pod podpisom
    y = pdf.get_y()
    pdf.set_draw_color(160, 160, 160)
    pdf.line(pdf.l_margin, y, pdf.l_margin + 80, y)
    pdf.ln(3)
    pdf.set_font("DejaVu", size=8)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 5, "vlastnoručný podpis", new_x="LMARGIN", new_y="NEXT")

    sys.stdout.buffer.write(pdf.output())


if __name__ == "__main__":
    main()
