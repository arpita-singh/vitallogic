"""
Ingests a scanned PDF into the VitalLogic knowledge_base table using OCR.

Requirements:
    pip install pdf2image pytesseract supabase requests

System binaries (Windows):
    Tesseract: https://github.com/UB-Mannheim/tesseract/wiki
               Install to C:\\Program Files\\Tesseract-OCR\\
    Poppler:   https://github.com/oschwartz10612/poppler-windows/releases
               Extract and add the bin/ folder to PATH

Credentials:
    set SUPABASE_URL=http://127.0.0.1:54321
    set SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase status`>
"""

import os
import sys
import time
import requests
import pytesseract
from pdf2image import convert_from_path, pdfinfo_from_path
from pdf2image.exceptions import PDFInfoNotInstalledError, PDFPageCountError
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────

PDF_PATH = "charaka_samhita.pdf"
POPPLER_PATH = r'C:\Users\poppler\Library\bin' 
OLLAMA_URL = "http://localhost:11434/api/embed"
EMBED_MODEL = "mxbai-embed-large:latest"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 100
START_PAGE = 1  # resume point — reset to 1 for a full re-ingest

SUPABASE_URL = os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Windows default Tesseract install path
pytesseract.pytesseract.tesseract_cmd = (
    os.environ.get("TESSERACT_CMD")
    or r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def ocr_page(img) -> str:
    try:
        return pytesseract.image_to_string(img, lang="eng")
    except pytesseract.TesseractNotFoundError:
        print(
            f"Error: Tesseract not found.\n"
            f"  tesseract_cmd = {pytesseract.pytesseract.tesseract_cmd}\n"
            f"  Verify that tesseract.exe exists at that path.\n"
            f"  Download: https://github.com/UB-Mannheim/tesseract/wiki"
        )
        sys.exit(1)


def chunk_text(text: str, size: int, overlap: int) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        start += size - overlap
    return chunks


def embed(text: str) -> list[float]:
    resp = requests.post(
        OLLAMA_URL,
        json={"model": EMBED_MODEL, "input": text},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["embeddings"][0]


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not os.path.exists(os.path.join(POPPLER_PATH, 'pdftoppm.exe')):
        print(f"ERROR: pdftoppm.exe not found in {POPPLER_PATH}\n"
              f"  Download Poppler for Windows: https://github.com/oschwartz10612/poppler-windows/releases\n"
              f"  Extract it and update POPPLER_PATH in this script to point to the bin/ folder.")
        sys.exit(1)

    if not SUPABASE_KEY:
        print(
            "Error: SUPABASE_SERVICE_ROLE_KEY is not set.\n"
            "Run `supabase status` to get the service_role key, then:\n"
            "  set SUPABASE_SERVICE_ROLE_KEY=<key>   (Windows)\n"
            "  export SUPABASE_SERVICE_ROLE_KEY=<key> (bash)"
        )
        sys.exit(1)

    if not os.path.exists(PDF_PATH):
        print(f"Error: '{PDF_PATH}' not found in {os.getcwd()}")
        sys.exit(1)

    # Verify Tesseract is reachable before doing expensive PDF conversion
    try:
        pytesseract.get_tesseract_version()
    except pytesseract.TesseractNotFoundError:
        print(
            "Error: Tesseract not found.\n"
            f"Expected at: {pytesseract.pytesseract.tesseract_cmd}\n"
            "Download from: https://github.com/UB-Mannheim/tesseract/wiki\n"
            "Or set TESSERACT_CMD env var to its path."
        )
        sys.exit(1)

    try:
        info = pdfinfo_from_path(PDF_PATH, poppler_path=POPPLER_PATH)
        total_pages = info["Pages"]
    except Exception as e:
        print(f"Error reading PDF info: {e}")
        sys.exit(1)

    print(f"Processing {PDF_PATH} ({total_pages} pages) — one page at a time...")

    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    total_inserted = 0
    total_errors = 0

    for page_num in range(START_PAGE, total_pages + 1):
        try:
            images = convert_from_path(
                PDF_PATH, dpi=200, poppler_path=POPPLER_PATH,
                first_page=page_num, last_page=page_num,
            )
        except (PDFInfoNotInstalledError, PDFPageCountError) as e:
            print(f"  [page {page_num}/{total_pages}] Poppler error: {e}")
            total_errors += 1
            continue
        except Exception as e:
            print(f"  [page {page_num}/{total_pages}] PDF conversion error: {e}")
            total_errors += 1
            continue

        text = ocr_page(images[0])
        if not text.strip():
            print(f"  [page {page_num}/{total_pages}] No text extracted, skipping.")
            continue

        chunks = [c.strip() for c in chunk_text(text, CHUNK_SIZE, CHUNK_OVERLAP) if c.strip()]
        page_inserted = 0

        for i, chunk in enumerate(chunks):
            chunk_id = f"{PDF_PATH}_p{page_num}_c{i}"

            try:
                embedding = embed(chunk)
            except requests.RequestException as e:
                print(f"  [page {page_num}/{total_pages}] Ollama error: {e}")
                total_errors += 1
                continue

            try:
                db.table("knowledge_base").upsert({
                    "chunk_id": chunk_id,
                    "content": chunk,
                    "embedding": embedding,
                    "metadata": {
                        "source": PDF_PATH,
                        "page": page_num,
                        "model": EMBED_MODEL,
                    },
                }, on_conflict="chunk_id").execute()
                page_inserted += 1
                total_inserted += 1
                time.sleep(0.1)
            except Exception as e:
                print(f"  [page {page_num}/{total_pages}] DB insert error: {e}")
                total_errors += 1

        print(f"Saved page {page_num}/{total_pages} - {page_inserted} chunks added")

    print(f"\nDone. {total_inserted} total chunks inserted, {total_errors} errors.")


if __name__ == "__main__":
    main()
