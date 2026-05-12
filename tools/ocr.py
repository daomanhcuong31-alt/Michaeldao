"""
tools/ocr.py — Multi-format text extraction (single + multi-file)
"""

from pathlib import Path
from typing import List, Dict
import json
import csv

def _result_template(path: str) -> dict:
    return {
        "path": path,
        "text": "",
        "pages": 0,
        "method": None,
        "quality": None,
        "warnings": [],
    }

def _read_text_file(path: Path, result: dict) -> dict:
    encodings = ["utf-8", "utf-16", "latin-1"]
    for enc in encodings:
        try:
            result["text"] = path.read_text(encoding=enc)
            result["method"] = f"text:{enc}"
            result["pages"] = 1
            result["quality"] = "GOOD" if result["text"].strip() else "EMPTY"
            return result
        except Exception:
            continue
    result["warnings"].append("Could not decode text file")
    result["quality"] = "FAILED"
    return result

def _read_csv(path: Path, result: dict) -> dict:
    try:
        rows = []
        with open(path, "r", encoding="utf-8", newline="") as f:
            reader = csv.reader(f)
            for i, row in enumerate(reader):
                rows.append(" | ".join(str(c) for c in row))
                if i >= 2000:
                    rows.append("[TRUNCATED_ROWS]")
                    break
        result["text"] = "\n".join(rows)
        result["method"] = "csv"
        result["pages"] = 1
        result["quality"] = "GOOD" if result["text"].strip() else "EMPTY"
    except Exception as e:
        result["warnings"].append(f"CSV read failed: {e}")
        result["quality"] = "FAILED"
    return result

def _read_json(path: Path, result: dict) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        result["text"] = json.dumps(data, ensure_ascii=False, indent=2)
        result["method"] = "json"
        result["pages"] = 1
        result["quality"] = "GOOD"
    except Exception as e:
        result["warnings"].append(f"JSON read failed: {e}")
        result["quality"] = "FAILED"
    return result

def _read_docx(path: Path, result: dict) -> dict:
    try:
        from docx import Document
        doc = Document(str(path))
        lines = [p.text for p in doc.paragraphs if p.text and p.text.strip()]
        result["text"] = "\n".join(lines)
        result["method"] = "docx"
        result["pages"] = 1
        result["quality"] = "GOOD" if result["text"].strip() else "EMPTY"
    except Exception as e:
        result["warnings"].append(f"DOCX read failed: {e}")
        result["quality"] = "FAILED"
    return result

def _read_excel(path: Path, result: dict) -> dict:
    try:
        import pandas as pd
        xls = pd.ExcelFile(path)
        blocks = []
        for sheet in xls.sheet_names[:20]:
            df = pd.read_excel(path, sheet_name=sheet)
            blocks.append(f"## SHEET: {sheet}")
            blocks.append(df.head(200).to_csv(index=False))
        result["text"] = "\n".join(blocks)
        result["method"] = "excel"
        result["pages"] = len(xls.sheet_names)
        result["quality"] = "GOOD" if result["text"].strip() else "EMPTY"
    except Exception as e:
        result["warnings"].append(f"Excel read failed: {e}")
        result["quality"] = "FAILED"
    return result

def _read_image_ocr(path: Path, result: dict) -> dict:
    try:
        import pytesseract
        from PIL import Image
        text = pytesseract.image_to_string(Image.open(path), lang="eng")
        result["text"] = text
        result["method"] = "image_ocr"
        result["pages"] = 1
        result["quality"] = "GOOD" if text.strip() else "POOR"
        if not text.strip():
            result["warnings"].append("Image OCR produced empty text")
    except Exception as e:
        result["warnings"].append(f"Image OCR failed: {e}")
        result["quality"] = "FAILED"
    return result

def _read_pdf(path: Path, result: dict) -> dict:
    try:
        import pdfplumber
        full_text = []
        with pdfplumber.open(str(path)) as pdf:
            result["pages"] = len(pdf.pages)
            for i, page in enumerate(pdf.pages):
                t = page.extract_text()
                if t:
                    full_text.append(t)
                else:
                    result["warnings"].append(f"PDF page {i+1}: no text extracted")
        if full_text:
            result["text"] = "\n\n".join(full_text)
            result["method"] = "pdfplumber"
            chars_per_page = len(result["text"]) / max(result["pages"], 1)
            result["quality"] = "GOOD" if chars_per_page > 200 else "PARTIAL"
            return result
    except Exception as e:
        result["warnings"].append(f"pdfplumber failed: {e}")

    # OCR fallback
    try:
        import pytesseract
        from pdf2image import convert_from_path
        images = convert_from_path(str(path))
        result["pages"] = len(images)
        ocr_text = []
        for i, img in enumerate(images):
            t = pytesseract.image_to_string(img, lang="eng")
            if t.strip():
                ocr_text.append(t)
            else:
                result["warnings"].append(f"OCR PDF page {i+1}: no text detected")
        result["text"] = "\n\n".join(ocr_text)
        result["method"] = "pdf_ocr"
        result["quality"] = "PARTIAL" if ocr_text else "POOR"
    except Exception as e:
        result["warnings"].append(f"PDF OCR fallback failed: {e}")
        result["quality"] = "FAILED"
    return result

def extract_text_from_path(file_path: str) -> dict:
    path = Path(file_path)
    result = _result_template(str(path))
    if not path.exists():
        result["warnings"].append("File not found")
        result["quality"] = "FAILED"
        return result

    ext = path.suffix.lower()
    if ext == ".pdf":
        return _read_pdf(path, result)
    if ext in {".txt", ".md", ".markdown", ".log"}:
        return _read_text_file(path, result)
    if ext == ".csv":
        return _read_csv(path, result)
    if ext == ".json":
        return _read_json(path, result)
    if ext == ".docx":
        return _read_docx(path, result)
    if ext in {".xlsx", ".xls"}:
        return _read_excel(path, result)
    if ext in {".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"}:
        return _read_image_ocr(path, result)

    # Fallback: try plain text
    result["warnings"].append(f"Unknown extension {ext}; trying text read")
    return _read_text_file(path, result)

def extract_text_from_files(file_paths: List[str]) -> dict:
    items = []
    all_warnings = []
    merged_parts = []

    for fp in file_paths:
        r = extract_text_from_path(fp)
        items.append(r)
        all_warnings.extend([f"{Path(fp).name}: {w}" for w in r.get("warnings", [])])
        text = (r.get("text") or "").strip()
        if text:
            merged_parts.append(
                f"[SOURCE_FILE: {fp} | method={r.get('method')} | quality={r.get('quality')}]"
            )
            merged_parts.append(text)

    merged = "\n\n".join(merged_parts)
    return {
        "text": merged,
        "files": items,
        "count": len(items),
        "warnings": all_warnings,
        "quality": "GOOD" if merged.strip() else "FAILED",
    }

def extract_text_from_string(text: str) -> dict:
    return {
        "text": text.strip(),
        "pages": 1,
        "method": "direct_input",
        "quality": "GOOD" if text.strip() else "EMPTY",
        "warnings": [] if text.strip() else ["Empty input provided"]
    }
