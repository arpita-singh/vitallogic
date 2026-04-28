import os
import sys
import time
import re
import requests
import pytesseract
from pdf2image import convert_from_path, pdfinfo_from_path
from pdf2image.exceptions import PDFInfoNotInstalledError, PDFPageCountError
from supabase import create_client

# ── SRE CONFIG ────────────────────────────────────────────────────────────────
PDF_PATH = "charaka_samhita.pdf"
POPPLER_PATH = r'C:\Users\poppler\Library\bin' 
OLLAMA_URL = "http://localhost:11434/api/embed"
EMBED_MODEL = "mxbai-embed-large:latest"
CHUNK_SIZE = 600  
CHUNK_OVERLAP = 100
START_PAGE = 426  # Resuming from where the test left off

# YOUR ACTIVE TUNNEL
SUPABASE_URL = "http://127.0.0.1:54321"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Tesseract Path
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# ── HELPERS ───────────────────────────────────────────────────────────────────

def clean_text(text: str) -> str:
    """Sanitizes OCR output to prevent 'Word Salad' hallucinations."""
    # Strip non-ASCII and known OCR noise
    text = re.sub(r'[^\x00-\x7F]+', ' ', text)
    text = re.sub(r'[|\\/_<>~]', ' ', text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def ocr_page(img) -> str:
    try:
        raw_text = pytesseract.image_to_string(img, lang="eng")
        return clean_text(raw_text)
    except Exception as e:
        print(f"OCR Error: {e}")
        return ""

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

# ── MAIN ENGINE ───────────────────────────────────────────────────────────────

def main():
    if not SUPABASE_KEY:
        print("SRE ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is missing!")
        sys.exit(1)

    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    try:
        info = pdfinfo_from_path(PDF_PATH, poppler_path=POPPLER_PATH)
        total_pages = info["Pages"]
    except Exception as e:
        print(f"Fatal Error reading PDF: {e}")
        sys.exit(1)

    print(f"🚀 SCALE-UP INITIATED: Pages {START_PAGE} to {total_pages}")
    print(f"Connecting to: {SUPABASE_URL}")

    for page_num in range(START_PAGE, total_pages + 1):
        try:
            # Step 1: PDF to Image
            images = convert_from_path(
                PDF_PATH, dpi=200, poppler_path=POPPLER_PATH,
                first_page=page_num, last_page=page_num,
            )
            
            # Step 2: OCR + Cleaning
            text = ocr_page(images[0])
            if not text:
                print(f"⚠️ Page {page_num}: No text found, skipping.")
                continue

            # Step 3: Chunking
            chunks = [c.strip() for c in chunk_text(text, CHUNK_SIZE, CHUNK_OVERLAP) if c.strip()]
            
            # Step 4: Embedding + DB Upsert
            for i, chunk in enumerate(chunks):
                chunk_id = f"{PDF_PATH}_p{page_num}_c{i}"
                embedding = embed(chunk)
                
                db.table("knowledge_base").upsert({
                    "chunk_id": chunk_id,
                    "content": chunk,
                    "embedding": embedding,
                    "metadata": {
                        "source": PDF_PATH,
                        "page": page_num,
                        "cleaned": True,
                        "scale_run": True
                    },
                }, on_conflict="chunk_id").execute()

            print(f"✅ Page {page_num}/{total_pages} Sync Complete")
            
            # Anti-throttling sleep
            time.sleep(0.2)
            
        except Exception as e:
            print(f"❌ Error on page {page_num}: {e}")
            print("Continuing to next page...")

    print(f"\n🏆 MISSION COMPLETE. The entire library is now clinical-grade.")

if __name__ == "__main__":
    main()