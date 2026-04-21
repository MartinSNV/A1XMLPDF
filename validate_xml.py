#!/usr/bin/env python3
"""
validate_xml.py – Validuje XML žiadosti voči XSD schémam slovensko.sk
Použitie: python validate_xml.py <xml_file> <typ>
  typ: vyslanie | uplatnitelna
Výstup: JSON { "valid": bool, "errors": [...] }
"""
import sys
import json
import os

try:
    from lxml import etree
except ImportError:
    print(json.dumps({"valid": False, "errors": ["lxml nie je nainštalovaný. Spustite: pip install lxml"]}))
    sys.exit(1)

SCHEMAS_DIR = os.path.join(os.path.dirname(__file__), "schemas")

SCHEMA_FILES = {
    "vyslanie": "pda1_vyslanie.xsd",
    "uplatnitelna": "pda1_uplatnitelna.xsd",
}

def validate(xml_string: str, typ: str) -> dict:
    if typ not in SCHEMA_FILES:
        return {"valid": False, "errors": [f"Neznámy typ formulára: {typ}. Použite: {list(SCHEMA_FILES.keys())}"]}

    xsd_path = os.path.join(SCHEMAS_DIR, SCHEMA_FILES[typ])
    if not os.path.exists(xsd_path):
        return {"valid": False, "errors": [f"XSD schéma nenájdená: {xsd_path}"]}

    try:
        with open(xsd_path, "rb") as f:
            schema = etree.XMLSchema(etree.parse(f))
    except Exception as e:
        return {"valid": False, "errors": [f"Chyba pri načítaní XSD schémy: {e}"]}

    try:
        doc = etree.fromstring(xml_string.encode("utf-8"))
    except etree.XMLSyntaxError as e:
        return {"valid": False, "errors": [f"Neplatný XML: {e}"]}

    is_valid = schema.validate(doc)
    errors = []
    if not is_valid:
        for err in schema.error_log:
            errors.append(f"Riadok {err.line}: {err.message}")

    return {"valid": is_valid, "errors": errors}

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({"valid": False, "errors": ["Použitie: validate_xml.py <xml_file> <typ>"]}))
        sys.exit(1)

    xml_file, typ = sys.argv[1], sys.argv[2]

    try:
        with open(xml_file, "r", encoding="utf-8") as f:
            xml_string = f.read()
    except Exception as e:
        print(json.dumps({"valid": False, "errors": [f"Chyba pri čítaní súboru: {e}"]}))
        sys.exit(1)

    result = validate(xml_string, typ)
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result["valid"] else 2)
