#!/usr/bin/env python3
"""Render SPEECH Module 1 student PDFs into high-res flipbook pages + thumbs."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parents[3]  # modulo-01
OUT = Path(__file__).resolve().parents[1]
PAGES_DIR = OUT / "pages"
THUMBS_DIR = OUT / "thumbs"
LESSONS_TS = ROOT / "source-app-business" / "lessons-ts"

# High quality for print-like reading (~2x A4 @ 96dpi ≈ 150–170 DPI)
DPI = 160
ZOOM = DPI / 72.0
THUMB_WIDTH = 160

UNITS = {
    1: "Introductions",
    2: "Work and leisure",
    3: "Problems",
    4: "Travel",
    5: "Food and entertaining",
    6: "Buying and selling",
    7: "People",
    8: "Advertising",
}

REVIEW_TITLES = {
    1: "Review 1 · Units 1–2 warm-up block",
    2: "Review 2 · Mid-module check",
    3: "Review 3 · Progress check",
    4: "Review 4 · Progress check",
    5: "Review 5 · Progress check",
}


def lesson_meta(n: int) -> dict:
    path = LESSONS_TS / f"lesson{n}.ts"
    unit = ((n - 1) // 4) + 1
    title = f"Lesson {n}"
    unit_title = UNITS.get(unit, f"Unit {unit}")
    if path.exists():
        text = path.read_text(encoding="utf-8")
        m = re.search(r"unit:\s*(\d+)", text)
        if m:
            unit = int(m.group(1))
        m = re.search(r'unitTitle:\s*"([^"]+)"', text)
        if m:
            unit_title = m.group(1)
        m = re.search(r'title:\s*"([^"]+)"', text)
        if m:
            title = m.group(1)
    return {
        "n": n,
        "type": "lesson",
        "key": f"licao-{n:02d}",
        "title": title,
        "short": f"Unit {unit} · {unit_title}",
        "unit": unit,
        "unitTitle": unit_title,
    }


def review_meta(n: int) -> dict:
    return {
        "n": n,
        "type": "review",
        "key": f"review-{n:02d}",
        "title": f"Review {n}",
        "short": REVIEW_TITLES.get(n, f"Review {n}"),
        "unit": None,
        "unitTitle": None,
    }


def build_order() -> list[dict]:
    """L1–6, R1, L7–12, R2, … L25–30, R5, L31–32 (matches digital workbook pattern)."""
    items: list[dict] = []
    lesson = 1
    for rev in range(1, 6):
        for _ in range(6):
            if lesson <= 30:
                items.append(lesson_meta(lesson))
                lesson += 1
        items.append(review_meta(rev))
    while lesson <= 32:
        items.append(lesson_meta(lesson))
        lesson += 1
    return items


def resolve_pdf(item: dict) -> Path:
    """Prefer Fluency Studio FFB-*.pdf (branded high-quality), then lesson.pdf."""
    folder = ROOT / item["key"] / "student"
    if item["type"] == "lesson":
        ffb = sorted(folder.glob("FFB-*.pdf"))
        if ffb:
            return ffb[0]
        preferred = folder / "lesson.pdf"
        if preferred.exists():
            return preferred
        pdfs = sorted(folder.glob("*.pdf"))
        if not pdfs:
            raise FileNotFoundError(f"No PDF for {item['key']}")
        return pdfs[0]
    preferred = folder / "lesson.pdf"
    if preferred.exists():
        return preferred
    pdfs = sorted(folder.glob("*.pdf"))
    if not pdfs:
        raise FileNotFoundError(f"No PDF for {item['key']}")
    return pdfs[0]


def strip_teacher_overlay(doc: fitz.Document, page: fitz.Page) -> None:
    """FFB lesson PDFs stamp a full-page Form XObject (/X7) of the unit
    teacher overview on page 1, hiding the student lesson. Remove it."""
    xrefs = page.get_contents()
    if not xrefs:
        return
    cont = b"".join(doc.xref_stream(x) or b"" for x in xrefs)
    if b"/X7 Do" not in cont:
        return
    cleaned = cont.replace(b"/X7 Do", b"")
    doc.update_stream(xrefs[0], cleaned)
    for xref in xrefs[1:]:
        doc.update_stream(xref, b"")


def render_pdf(pdf: Path, start_page: int) -> tuple[int, list[str]]:
    doc = fitz.open(pdf)
    matrix = fitz.Matrix(ZOOM, ZOOM)
    paths: list[str] = []
    for i in range(doc.page_count):
        page_no = start_page + i
        page = doc.load_page(i)
        strip_teacher_overlay(doc, page)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        name = f"page-{page_no:02d}.png"
        out = PAGES_DIR / name
        pix.save(out.as_posix())

        # thumbnail
        scale = THUMB_WIDTH / max(pix.width, 1)
        thumb = page.get_pixmap(matrix=fitz.Matrix(ZOOM * scale, ZOOM * scale), alpha=False)
        thumb.save((THUMBS_DIR / name).as_posix())
        paths.append(f"pages/{name}")
        print(f"  [{page_no:02d}] {pdf.name} p{i+1}/{doc.page_count} → {name} ({pix.width}x{pix.height})")
    count = doc.page_count
    doc.close()
    return count, paths


def main() -> int:
    PAGES_DIR.mkdir(parents=True, exist_ok=True)
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)

    # clean old pages
    for p in PAGES_DIR.glob("page-*.png"):
        p.unlink()
    for p in THUMBS_DIR.glob("page-*.png"):
        p.unlink()

    order = build_order()
    lessons_map: list[dict] = []
    page = 1
    total_rendered = 0

    print(f"Rendering {len(order)} sections @ {DPI} DPI → {OUT}")
    for item in order:
        pdf = resolve_pdf(item)
        print(f"\n== {item['key']} · {item['title']} ({pdf.name})")
        start = page
        count, _paths = render_pdf(pdf, start)
        kinds = ["a"] + (["b"] * (count - 1) if count > 1 else [])
        entry = {
            **item,
            "start": start,
            "count": count,
            "kinds": kinds,
            "source": str(pdf.relative_to(ROOT)).replace("\\", "/"),
        }
        lessons_map.append(entry)
        page += count
        total_rendered += count

    total_pages = page - 1
    book = {
        "id": "corporate-speech-m1-student",
        "title": "Corporate Speech",
        "subtitle": "Módulo 1 · Student Book · Units 1–8",
        "brand": "The Fluency Studio",
        "pages": total_pages,
        "pagePattern": "pages/page-{nn}.png",
        "logo": "logo.png",
        "viewer": {
            "engine": "St.PageFlip",
            "pageTurn": "magazine-3d-page-flip",
            "dpi": DPI,
        },
    }
    (OUT / "book.json").write_text(json.dumps(book, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "page-map.json").write_text(
        json.dumps({"lessons": lessons_map, "totalPages": total_pages}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # compact lessons.js for the viewer
    js_lessons = []
    for L in lessons_map:
        js_lessons.append(
            {
                "n": L["n"],
                "type": L["type"],
                "key": L["key"],
                "title": L["title"],
                "short": L["short"],
                "start": L["start"],
                "count": L["count"],
                "kinds": L["kinds"],
                "unit": L.get("unit"),
                "unitTitle": L.get("unitTitle"),
            }
        )
    (OUT / "lessons.js").write_text(
        "window.FLIPBOOK_LESSONS = "
        + json.dumps(js_lessons, ensure_ascii=False, indent=2)
        + ";\nwindow.FLIPBOOK_TOTAL_PAGES = "
        + str(total_pages)
        + ";\n",
        encoding="utf-8",
    )

    print(f"\nDone: {total_rendered} pages → {PAGES_DIR}")
    print(f"book.json / page-map.json / lessons.js written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
