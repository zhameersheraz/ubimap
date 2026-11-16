"""Mix the generated narration into the 30 second demo video.

Trims the silence off each clip, places it at the start of its shot, and muxes
the result under the picture. A clip that would run into the next one is pushed
later rather than allowed to overlap.

    python scripts/mix_narration.py
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUFFIX = sys.argv[1] if len(sys.argv) > 1 else ""
CARDS = os.path.join(ROOT, "demo", "cards" + (f"-{SUFFIX}" if SUFFIX else ""))
VIDEO = os.path.join(CARDS, "silent.mp4")
OUT = os.path.join(ROOT, "demo",
                   "ubimap-demo.mp4" if not SUFFIX else f"ubimap-demo-{SUFFIX}.mp4")
NARR = os.path.join(CARDS, "narration.json")


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2500:])
        sys.exit(f"failed: {' '.join(cmd[:4])}")
    return r.stdout


def dur(path):
    return float(run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "csv=p=0", path,
    ]).strip())


def main():
    narration = json.load(open(NARR, encoding="utf-8"))

    # Trim the leading and trailing silence the generator adds.
    trimmed = []
    for i, line in enumerate(narration, 1):
        src = os.path.join(CARDS, f"nar{i:02d}.mp3")
        dst = os.path.join(CARDS, f"nar{i:02d}.wav")
        run([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", src,
            "-af", "areverse,silenceremove=start_periods=1:start_duration=0.02:"
                   "start_threshold=-45dB,areverse",
            "-ac", "2", "-ar", "44100", dst,
        ])
        trimmed.append((dst, dur(dst), line["start"], line["text"]))
        print(f"  {i:02d}  {trimmed[-1][1]:5.2f}s  slot {line['start']:5.2f}s  {line['text'][:44]}")

    total = sum(d for _, d, _, _ in trimmed)
    print(f"speech total {total:.2f}s")

    # Place each clip at its shot start, pushed later if the previous clip is
    # still speaking.
    places = []
    floor = 0.0
    for path, d, start, text in trimmed:
        at = max(start, floor + 0.06)
        places.append((path, at))
        floor = at + d
    vdur = dur(VIDEO)
    if floor > vdur:
        print(f"WARNING: narration ends at {floor:.2f}s, past the {vdur:.2f}s cut")

    inputs = []
    for path, _ in places:
        inputs += ["-i", path]
    delays = []
    labels = []
    for i, (_, at) in enumerate(places):
        ms = int(round(at * 1000))
        # input 0 is the video, so the first narration clip is input 1
        delays.append(f"[{i + 1}:a]adelay={ms}|{ms}[d{i}]")
        labels.append(f"[d{i}]")
    fc = ";".join(delays) + ";" + "".join(labels) + \
        f"amix=inputs={len(places)}:normalize=0:duration=longest," \
        "loudnorm=I=-16:TP=-1.5:LRA=11[mix]"

    vdur = dur(VIDEO)
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", VIDEO, *inputs,
        "-filter_complex", fc,
        "-map", "0:v", "-map", "[mix]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
        "-t", f"{vdur:.3f}", "-movflags", "+faststart",
        OUT,
    ])

    print(f"wrote {OUT}")
    print(run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration,size",
        "-show_entries", "stream=codec_type,codec_name",
        "-of", "default=noprint_wrappers=1", OUT,
    ]))


if __name__ == "__main__":
    main()
