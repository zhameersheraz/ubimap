"""Build the 30 second UbiMap demo video.

Takes the real screen recording captured by scripts/record_demo.mjs, wraps it in
a title card and an end card, burns English subtitles in, and writes a plain
H.264 MP4 that plays anywhere.

    node scripts/record_demo.mjs https://ubimap.pages.dev demo/frames
    python scripts/build_demo_video.py
"""
import glob
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRAMES = os.path.join(ROOT, "demo", "frames")
OUT = os.path.join(ROOT, "demo", "ubimap-demo.mp4")
CARDS = os.path.join(ROOT, "demo", "cards")

W, H = 1280, 720
TOTAL = 30.0

INK = (11, 16, 23)
PANEL = (16, 27, 40)
TEXT = (230, 237, 245)
DIM = (143, 165, 186)
AMBER = (232, 181, 75)
BLUE = (47, 127, 174)
PURPLE = (179, 106, 212)

TEAM = "Team Messiah Project Digital"
NAMES = (
    "Mark John Riel Alforque (Team Owner)  ·  Zhameer Sheraz Tampugao\n"
    "Cathy Untolan  ·  Jerenze Levi Omandam"
)
CHALLENGE = "Field Shift: Adapting Farms with NASA Data"


def pick_font(preferred, size):
    for name in preferred:
        hits = glob.glob(os.path.join("C:/Windows/Fonts", name))
        if hits:
            return ImageFont.truetype(hits[0], size)
    try:
        import matplotlib
        base = os.path.join(os.path.dirname(matplotlib.__file__), "mpl-data", "fonts", "ttf")
        return ImageFont.truetype(os.path.join(base, "DejaVuSans.ttf"), size)
    except Exception:
        return ImageFont.load_default()


SANS = ["segoeui.ttf", "arial.ttf", "ARIAL.TTF"]
SANS_B = ["segoeuib.ttf", "arialbd.ttf", "ARIALBD.TTF"]
MONO = ["segoeui.ttf", "consola.ttf", "cour.ttf", "ARIAL.TTF"]


def text(draw, xy, s, font, fill, anchor="la", spacing=6, align="left"):
    draw.multiline_text(xy, s, font=font, fill=fill, anchor=anchor,
                        spacing=spacing, align=align)


def base_card():
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    # a faint orbital grid, so the card is not a flat rectangle
    for x in range(0, W, 40):
        d.line([(x, 0), (x, H)], fill=(16, 26, 38), width=1)
    for y in range(0, H, 40):
        d.line([(0, y), (W, y)], fill=(16, 26, 38), width=1)
    for cx, cy, r in [(980, 180, 150), (1080, 260, 90), (250, 560, 120)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(20, 34, 50), width=2)
    return img, d


def title_card():
    img, d = base_card()
    logo = os.path.join(ROOT, "public", "logo-ube-256.png")
    if os.path.exists(logo):
        lg = Image.open(logo).convert("RGBA")
        lg = lg.resize((132, 132), Image.LANCZOS)
        img.paste(lg, (W // 2 - 66, 92), lg)

    text(d, (W // 2, 268), "UbiMap", pick_font(SANS_B, 92), (255, 255, 255), anchor="ma")
    text(d, (W // 2, 380),
         "Can my field grow ube, which rotation fits it,\nand when do I plant?",
         pick_font(SANS, 30), (200, 213, 227), anchor="ma", spacing=12, align="center")

    d.rectangle([W // 2 - 60, 478, W // 2 + 60, 481], fill=AMBER)

    text(d, (W // 2, 508), TEAM, pick_font(SANS_B, 26), AMBER, anchor="ma")
    text(d, (W // 2, 546), NAMES, pick_font(SANS, 19), DIM, anchor="ma", spacing=8, align="center")
    text(d, (W // 2, 600),
         "NASA Space Apps Hackathon 2026  ·  " + CHALLENGE,
         pick_font(SANS, 18), (120, 143, 166), anchor="ma")
    return img


def end_card():
    img, d = base_card()
    text(d, (W // 2, 118), "UbiMap", pick_font(SANS_B, 64), (255, 255, 255), anchor="ma")
    text(d, (W // 2, 200),
         "One node per barangay. Ground truth against the satellite.",
         pick_font(SANS, 24), (200, 213, 227), anchor="ma")
    d.rectangle([W // 2 - 60, 250, W // 2 + 60, 253], fill=AMBER)

    text(d, (W // 2, 300), TEAM, pick_font(SANS_B, 24), AMBER, anchor="ma")
    text(d, (W // 2, 338), NAMES, pick_font(SANS, 18), DIM, anchor="ma", spacing=8, align="center")

    rows = [
        ("Live demo", "ubimap.pages.dev"),
        ("Source", "github.com/zhameersheraz/ubimap"),
        ("Slide deck", "ubimap.pages.dev/ubimap-deck.pdf"),
    ]
    y = 412
    for label, value in rows:
        d.rounded_rectangle([W // 2 - 300, y, W // 2 + 300, y + 50], radius=8,
                            fill=PANEL, outline=(28, 44, 62), width=1)
        text(d, (W // 2 - 276, y + 25), label.upper(), pick_font(MONO, 13), (120, 143, 166), anchor="lm")
        text(d, (W // 2 + 276, y + 25), value, pick_font(MONO, 17), (120, 200, 235), anchor="rm")
        y += 62

    text(d, (W // 2, 622),
         "Built with NASA POWER, NASA SRTM, NASA GIBS and ISRIC SoilGrids. Free and open data.",
         pick_font(SANS, 16), (100, 120, 142), anchor="ma")
    return img


def frame_durations(frames):
    """Exact per frame durations from the screencast timestamps."""
    ts = [f["ts"] for f in frames]
    durs = []
    for i in range(len(ts) - 1):
        durs.append(max(0.001, ts[i + 1] - ts[i]))
    if durs:
        durs.append(durs[-1])
    else:
        durs.append(1.0)
    return durs


def build_ass(start, cues, path):
    head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Segoe UI,34,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2.6,1.6,2,60,60,46,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [head]
    for s, e, txt in cues:
        def ts(x):
            h = int(x // 3600)
            m = int((x % 3600) // 60)
            sec = x % 60
            return f"{h:d}:{m:02d}:{sec:05.2f}"
        clean = txt.replace("\n", "\\N")
        lines.append(f"Dialogue: 0,{ts(s)},{ts(e)},Cap,,0,0,0,,{clean}\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write("".join(lines))


def main():
    frames = json.load(open(os.path.join(FRAMES, "frames.json"), encoding="utf-8"))
    mk = json.load(open(os.path.join(FRAMES, "marks.json"), encoding="utf-8"))
    if len(frames) < 30:
        sys.exit("too few frames, re-run the recorder")

    app_dur = frame_durations(frames)
    app_len = sum(app_dur)

    os.makedirs(CARDS, exist_ok=True)
    title_card().save(os.path.join(CARDS, "title.png"))
    end_card().save(os.path.join(CARDS, "end.png"))

    title_len = 3.2
    end_len = TOTAL - title_len - app_len
    if end_len < 1.0:
        # Footage ran long. Trim the tail of the app instead of a short end card.
        end_len = 2.5
        title_len = TOTAL - end_len - app_len
        if title_len < 1.0:
            sys.exit(f"footage is {app_len:.1f}s, too long for a {TOTAL}s cut")

    # Concat list with the exact per frame durations.
    listing = os.path.join(CARDS, "frames.txt")
    with open(listing, "w", encoding="utf-8") as f:
        for fr, d in zip(frames, app_dur):
            f.write(f"file '{os.path.join(FRAMES, fr['name']).replace(chr(92), '/')}'\n")
            f.write(f"duration {d:.4f}\n")
        f.write(f"file '{os.path.join(FRAMES, frames[-1]['name']).replace(chr(92), '/')}'\n")

    # Captions, aligned to the shots the recorder marked. A mark is taken at the
    # END of its shot, so the caption for a shot runs from the previous mark to
    # its own. The marks are wall clock, the frames are epoch, so shift once.
    ts = [f["ts"] for f in frames]
    offset = ts[0] - mk["t0Epoch"]

    def at(label, fallback=0.0):
        for m in mk["marks"]:
            if m["label"] == label:
                return max(0.0, m["at"] - offset)
        return fallback

    order = ["plate", "map, tiles loading", "demo field pinned", "profile",
             "farm card", "live NASA check", "rotations", "validation table"]
    shot_text = [
        ("plate",
         "Ube production in the Philippines has fallen 43% in fifteen years,\n"
         "and the area planted has halved."),
        ("map, tiles loading",
         "Seven NASA datasets stream into the browser.\n"
         "This is live NASA MODIS imagery over Pagadian City."),
        ("demo field pinned",
         "The farmer pins their field, and the app scores the\n"
         "NASA POWER grid cell around it."),
        ("profile",
         "They say what they plant now and what matters most:\n"
         "income, water, soil or work."),
        ("farm card",
         "The Farm Card gives a ube readiness score out of 100,\n"
         "the reasons behind it and the things to watch."),
        ("live NASA check",
         "This button calls the NASA POWER API right now,\n"
         "for this exact field."),
        ("rotations",
         "Four rotations, including the one you farm now, each with\n"
         "why it is suggested, the evidence, the gaps and the risks."),
        ("validation table",
         "We tested against Philippine Statistics Authority data. The first version\n"
         "scored zero against real yield, so we rebuilt the rainfall from GPM IMERG.\n"
         "The correlation went from zero to plus 0.32."),
    ]

    cues = [(0.15, title_len - 0.15,
             "We are Team Messiah Project Digital, from Pagadian City in the Philippines.")]
    prev = 0.0
    for label, txt in shot_text:
        end = at(label)
        if end <= prev:
            end = prev + 0.4
        cues.append((title_len + prev, title_len + end, txt))
        prev = end
    cues.append((title_len + prev, title_len + app_len,
                 "One node per barangay, ground truth against the satellite.\n"
                 "This tool supports the farmer, it does not replace them."))
    cues.append((title_len + app_len + 0.15, TOTAL - 0.1,
                 "One node per barangay, ground truth against the satellite.\n"
                 "This tool supports the farmer, it does not replace them."))

    ass = os.path.join(CARDS, "subs.ass")
    build_ass(0.0, cues, ass)

    # Assemble: title card, the screen recording, end card, then burn the captions.
    # Everything runs from the cards folder with relative names, because the ass
    # filter cannot cope with a Windows path that contains drive letters.
    app_mp4 = os.path.join(CARDS, "app.mp4")
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "concat", "-safe", "0", "-i", "frames.txt",
        "-vf", "scale=1280:720:flags=lanczos,fps=30",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p", "app.mp4",
    ], check=True, cwd=CARDS)

    cmd = [
        "ffmpeg", "-y", "-hide_banner",
        "-loop", "1", "-framerate", "30", "-i", "title.png",
        "-loop", "1", "-framerate", "30", "-i", "end.png",
        "-i", "app.mp4",
        "-i", "subs.ass",
        "-filter_complex",
        f"[0:v]trim=duration={title_len:.3f},setpts=PTS-STARTPTS,scale=1280:720[t];"
        f"[1:v]trim=duration={end_len:.3f},setpts=PTS-STARTPTS,scale=1280:720[e];"
        "[t][2:v][e]concat=n=3:v=1:a=0[v];"
        "[v]ass=subs.ass[out]",
        "-map", "[out]",
        "-c:v", "libx264", "-preset", "slow", "-crf", "21",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-r", "30", "-t", f"{TOTAL:.3f}",
        OUT,
    ]
    r = subprocess.run(cmd, cwd=CARDS, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-3000:])
        sys.exit("ffmpeg failed")

    probe = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration,size",
        "-of", "default=noprint_wrappers=1", OUT,
    ], capture_output=True, text=True)
    print(probe.stdout.strip())
    print(f"wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
