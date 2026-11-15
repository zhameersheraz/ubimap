"""Render the UbiMap slide deck to a PDF and stage it for hosting.

The deck source is deck/index.html, seven 1280 x 720 slides. Chrome prints it
to deck/ubimap-deck.pdf, and the file is copied into public/ so the Vite build
publishes it at /ubimap-deck.pdf on both Cloudflare Pages and GitHub Pages.

    python scripts/build_deck.py
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DECK = os.path.join(ROOT, "deck")
HTML = os.path.join(DECK, "index.html")
PDF = os.path.join(DECK, "ubimap-deck.pdf")
OUT = os.path.join(ROOT, "public", "ubimap-deck.pdf")

CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
]


def find_chrome():
    for c in CANDIDATES:
        if os.path.exists(c):
            return c
    found = shutil.which("chrome") or shutil.which("chromium") or shutil.which("google-chrome")
    if found:
        return found
    sys.exit("No Chrome found. Install Google Chrome or edit CANDIDATES in this script.")


def main():
    if not os.path.exists(HTML):
        sys.exit(f"Missing {HTML}")

    shots = os.path.join(DECK, "shots")
    missing = [
        f for f in os.listdir(shots) if f.endswith(".png")
    ]
    if not missing:
        sys.exit("No screenshots in deck/shots. Run: node scripts/shoot_screenshots.mjs")

    chrome = find_chrome()
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=15000",
        f"--print-to-pdf={PDF}",
        "file:///" + HTML.replace("\\", "/"),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if not os.path.exists(PDF):
        print(r.stdout[-2000:])
        print(r.stderr[-2000:])
        sys.exit("Chrome did not write the PDF")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    shutil.copyfile(PDF, OUT)
    kb = os.path.getsize(OUT) / 1024
    print(f"deck PDF: {PDF} ({kb:.0f} KB)")
    print(f"staged:   {OUT}")


if __name__ == "__main__":
    main()
