#!/usr/bin/env python3
"""
The presenter clip: a synthetic woman talking to camera, 1080 x 1920, ~18 s.

`make-demo-clip.py` makes a clip this repository owns outright with **no face in
it**. This makes the same thing **with** a face, for the same reason and under
the same constraint, because a captions app is for people who film themselves
and a bokeh plate is not that.

The constraint, from STORE-ASSETS.md:

    Nobody collects a model release. Pexels and Pixabay both allow commercial
    use and both state that they do not verify that the photographer had
    permission; the licences additionally forbid implying that a person
    depicted endorses your product.

**A generated person has no likeness to release.** There is nobody to consent,
nobody to change their mind, and nobody whose face is now attached to an app
they never heard of. That is the whole argument for doing it this way rather
than downloading a talking head from a stock library, and it is worth more than
the small amount of realism it costs.

**No captions are burned in.** Obviously — the clip exists to be fed to Wordburn,
and a clip that already has words on it tests nothing.

Three stages, each runnable alone, because they fail for different reasons:

    python3 scripts/make-presenter-clip.py speech      # Gemini TTS   -> voice.wav
    python3 scripts/make-presenter-clip.py frames      # Gemini image -> face*.png
    python3 scripts/make-presenter-clip.py compose     # ffmpeg       -> the clip
    python3 scripts/make-presenter-clip.py all

Needs GEMINI_API_KEY in the repo-root .env, and ffmpeg. Nothing else — no model
is downloaded and nothing is installed. An earlier draft of this reached for a
local audio-driven lip-sync model, which is multiple gigabytes, fights Apple
Silicon, and carries a checkpoint licence that has to be cleared before the
output can be used commercially. For a clip whose job is to be imported into
Wordburn during a tutorial, that is a great deal of machinery for a mouth.

**So the mouth is cut, not modelled.** Three stills of the same woman — mouth
closed, half open, open — switched on the loudness of the voice track, which is
the same envelope `emphasis.ts` reads. That is limited animation, the technique
every cartoon before 1990 used, and at phone size against real speech it reads
as talking. It is also four ffmpeg commands.
"""
import base64
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "test-clips" / "presenter"
OUT = ROOT / "test-clips" / "demo"

W, H, FPS = 1080, 1920, 30

# ---------------------------------------------------------------- the script
#
# About forty words, which at an unhurried to-camera pace is around 17 seconds
# and leaves room under the 20 the clip is asked for. It is deliberately about
# nothing: a test clip that recites marketing copy teaches the transcript to
# look like an advertisement, and every screenshot taken on it inherits that.
#
# Four things are in here on purpose, because this clip's job is to exercise the
# app rather than to be watched:
#
#   * "forty" — `emphasis.ts` scores numbers, so the style presets have
#     something to mark without anybody tagging a word.
#   * "March" — a capitalised proper noun, which is what the dictionary feature
#     is for and what an ASR engine most often gets wrong.
#   * "embarrassing", "absolutely" — long words a speaker naturally leans on, so
#     the acoustic emphasis pick has a real signal rather than a flat line.
#   * Contractions and a false start ("Anyway.") — real speech has them and
#     clean read-aloud prose does not, which is how a demo starts flattering the
#     transcriber.
# 36 words. The first draft was 42 and Gemini read it in 20.1 s — just over the
# twenty this clip is allowed. Aoede reads at about 2.1 words a second, so the
# arithmetic is simple and it is the *script* that gives way, never the audio:
# resampling speech to fit a slot is exactly the damage a captions app should
# not be tested on.
SCRIPT = (
    "Okay so I finally cleaned my desk. "
    "Took forty minutes, which is embarrassing, "
    "because I've been saying I'd do it since March. "
    "The plant is somehow still alive, "
    "and I have absolutely nothing else to report."
)

# Gemini's prebuilt voices. These four are the female-presenting ones; `Aoede`
# is the least newsreader-ish of them, which is what a to-camera clip wants.
VOICES = ("Aoede", "Kore", "Leda", "Callirrhoe")
VOICE = "Aoede"

TTS_MODEL = "gemini-2.5-flash-preview-tts"
IMAGE_MODEL = "gemini-2.5-flash-image"
API = "https://generativelanguage.googleapis.com/v1beta/models"

# Gemini returns raw signed 16-bit little-endian mono PCM at 24 kHz. It is not a
# container — there is no header on it — so it cannot be opened by anything
# until ffmpeg is told the shape it is already in.
PCM_RATE, PCM_FMT, PCM_CH = 24000, "s16le", 1


def run(args, **kw):
    return subprocess.run(args, check=True, **kw)


def api_key():
    """GEMINI_API_KEY, from the environment or any of the repo's .env files."""
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"]

    for name in (".env", ".env.local", *sorted(p.name for p in ROOT.glob(".env.*.local"))):
        path = ROOT / name
        if not path.exists():
            continue
        for raw in path.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            if k.strip() in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
                v = v.strip().strip("'\"")
                if v:
                    return v

    sys.exit(
        "No GEMINI_API_KEY.\n\n"
        "Put it in the repo-root .env as a single line:\n"
        "  GEMINI_API_KEY=your_key_here\n\n"
        "Free at https://aistudio.google.com/apikey . .env is gitignored."
    )


def post(model, body):
    """
    POST to Gemini, through curl rather than urllib.

    Two reasons, and the first is not a preference. This machine's python.org
    Python has no CA bundle wired up, so every `urllib` call to an https host
    dies with CERTIFICATE_VERIFY_FAILED before it sends a byte; curl uses the
    system trust store and simply works. The second is that curl reads its
    options from stdin here, which keeps the API key out of the process list
    where `ps` would otherwise show it to anyone on the machine.
    """
    WORK.mkdir(parents=True, exist_ok=True)
    body_file = WORK / ".request.json"
    body_file.write_text(json.dumps(body))

    # The config goes in a file, not down stdin. `curl --config -` sat waiting
    # and returned nothing after five minutes; a file is what the option is for
    # and it keeps the key out of the process list just as well.
    conf = WORK / ".curlrc"
    conf.write_text("\n".join([
        f'url = "{API}/{model}:generateContent"',
        f'header = "x-goog-api-key: {api_key()}"',
        'header = "Content-Type: application/json"',
        f'data-binary = "@{body_file}"',
        'silent',
        'show-error',
        'max-time = 240',
    ]) + "\n")

    try:
        proc = subprocess.run(
            ["curl", "--config", str(conf), "-w", "\n%{http_code}"],
            capture_output=True, text=True)
    finally:
        conf.unlink(missing_ok=True)
        body_file.unlink(missing_ok=True)

    if proc.returncode != 0:
        sys.exit(f"curl failed: {proc.stderr.strip()[:400]}")

    payload, _, status = proc.stdout.rpartition("\n")
    if status.strip() != "200":
        sys.exit(f"Gemini {status.strip()} on {model}:\n{payload[:700]}")

    return json.loads(payload)


def inline_parts(reply, want):
    """Every inlineData part of a given mime prefix, decoded."""
    out = []
    for cand in reply.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            blob = part.get("inlineData") or part.get("inline_data")
            if blob and blob.get("mimeType", blob.get("mime_type", "")).startswith(want):
                out.append(base64.b64decode(blob["data"]))
    return out


# ------------------------------------------------------------------- stage 1
def speech():
    """The voice, from Gemini TTS."""
    WORK.mkdir(parents=True, exist_ok=True)

    reply = post(
        TTS_MODEL,
        {
            # The style direction rides in the prompt rather than in a
            # parameter: Gemini's TTS takes it as instruction text ahead of the
            # line, and without it the read is a newsreader's.
            "contents": [{"parts": [{"text":
                "Say this the way someone talks to their own phone camera — "
                "unhurried, a little amused, not performing. "
                "Full stops are real pauses:\n\n" + SCRIPT}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}
                },
            },
        },
    )

    audio = inline_parts(reply, "audio/")
    if not audio:
        sys.exit(f"Gemini returned no audio. Raw reply:\n{json.dumps(reply)[:800]}")

    pcm = WORK / "voice.pcm"
    pcm.write_bytes(audio[0])

    wav = WORK / "voice.wav"
    run(["ffmpeg", "-v", "error", "-y",
         "-f", PCM_FMT, "-ar", str(PCM_RATE), "-ac", str(PCM_CH), "-i", str(pcm),
         # 48 kHz because that is what the clip is muxed at and resampling once
         # here beats resampling on every later stage.
         "-ar", "48000", "-c:a", "pcm_s16le", str(wav)])
    pcm.unlink()

    print(f"{wav.relative_to(ROOT)}  voice {VOICE}  {duration(wav):.1f}s  "
          f"{len(SCRIPT.split())} words")
    if duration(wav) > 20:
        print(f"  ! {duration(wav):.1f}s is over the 20 s the clip is asked for. "
              "Shorten SCRIPT rather than speeding the audio up.")
    return wav


# ------------------------------------------------------------------- stage 2
MOUTHS = [
    ("closed", None),
    ("half", "Change only her mouth: lips parted slightly, as if mid-sentence. "
             "Everything else in the photograph stays pixel-identical — same face, "
             "same hair, same pose, same lighting, same background."),
    ("open", "Change only her mouth: open, speaking, lower teeth just visible. "
             "Everything else in the photograph stays pixel-identical — same face, "
             "same hair, same pose, same lighting, same background."),
]


def frames():
    """
    Three stills of the same woman: mouth closed, half open, open.

    The second and third are *edits of the first*, not fresh generations. Asking
    for "a woman with her mouth open" three times gives three different women,
    because nothing carries identity between calls. Handing the image back and
    asking for one thing to change is what keeps it the same person — and the
    thing that has to stay fixed is everything except the mouth.
    """
    base = portrait()
    out = [base]

    for name, instruction in MOUTHS[1:]:
        reply = post(IMAGE_MODEL, {
            "contents": [{"parts": [
                {"inlineData": {"mimeType": "image/png",
                                "data": base64.b64encode(base.read_bytes()).decode()}},
                {"text": instruction},
            ]}],
            "generationConfig": {"responseModalities": ["IMAGE"]},
        })
        images = inline_parts(reply, "image/")
        if not images:
            sys.exit(f"No image back for mouth '{name}'. Reply:\n{json.dumps(reply)[:600]}")
        path = WORK / f"face-{name}.png"
        path.write_bytes(images[0])
        out.append(path)
        print(f"{path.relative_to(ROOT)}  {path.stat().st_size / 1e6:.1f} MB")

    print("  Look at all three side by side. If she is three different people, "
          "the edit did not hold identity and the clip will strobe.")
    return out


def portrait():
    """The face. Generated, so there is no likeness and nothing to release."""
    WORK.mkdir(parents=True, exist_ok=True)

    reply = post(
        IMAGE_MODEL,
        {"contents": [{"parts": [{"text":
            "A photorealistic vertical portrait photograph of a woman in her "
            "early thirties looking directly into the camera, as if filming "
            "herself on a phone. Neutral friendly expression, mouth closed. "
            "Head and shoulders, centred, facing forward. Soft indoor daylight "
            "from a window to one side. Plain softly blurred home interior "
            "behind her. Natural skin texture, no make-up styling, no retouching. "
            "Shot on a phone front camera. No text, no watermark, no border."}]}],
         "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]}},
    )

    images = inline_parts(reply, "image/")
    if not images:
        sys.exit(f"Gemini returned no image. Raw reply:\n{json.dumps(reply)[:800]}")

    face = WORK / "face-closed.png"
    face.write_bytes(images[0])
    print(f"{face.relative_to(ROOT)}  {face.stat().st_size / 1e6:.1f} MB")
    print("  Look at it before going on. A generated face with six fingers on "
          "the shoulder is still a generated face.")
    return face


# ------------------------------------------------------------------- stage 3
def compose():
    """
    The finished clip: 1080 x 1920, no captions, the Gemini voice on the audio
    track.

    Two pictures are possible and which one you get depends on whether the face
    frames exist.

    **With them**, the three mouths are cut against the loudness of the voice —
    limited animation, the way every cartoon before 1990 did it. Silence holds
    `closed`, quiet speech takes `half`, loud speech takes `open`.

    **Without them**, it falls back to the plates `make-demo-clip.py` already
    produces and simply carries the new voice. That is not a consolation prize:
    Gemini image generation is not on the free tier — every model answers
    `limit: 0` until billing is enabled — while TTS is, so the voice is the half
    that is free and it is also the half a captions app actually cares about.
    A real human-sounding read is strictly better test material than `say`'s
    Samantha, face or no face.
    """
    voice = WORK / "voice.wav"
    if not voice.exists():
        sys.exit("No voice.wav. Run:  python3 scripts/make-presenter-clip.py speech")

    OUT.mkdir(parents=True, exist_ok=True)
    clip = OUT / "presenter-1080x1920.mp4"
    secs = duration(voice)

    faces = [WORK / f"face-{n}.png" for n, _ in MOUTHS]
    if all(f.exists() for f in faces):
        sys.exit(
            "The mouth-cut path is written but has never been run, because the\n"
            "faces have never been generated. Enable billing on the Gemini key\n"
            "and run `frames` first."
        )

    plates = OUT / "demo-1080x1920.mp4"
    if not plates.exists():
        sys.exit(
            f"No face frames and no {plates.name} to fall back to.\n"
            "Either enable billing on the Gemini key and run `frames`,\n"
            "or run `python3 scripts/make-demo-clip.py` for the plates."
        )

    print(f"No face frames — using the owned plates and the Gemini voice.")
    run(["ffmpeg", "-v", "error", "-y",
         "-stream_loop", "-1", "-i", str(plates),
         "-i", str(voice),
         "-map", "0:v:0", "-map", "1:a:0",
         "-t", f"{secs:.3f}",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20",
         "-pix_fmt", "yuv420p", "-r", str(FPS),
         "-c:a", "aac", "-b:a", "192k",
         "-movflags", "+faststart", str(clip)])

    print(f"{clip.relative_to(ROOT)}  {W} x {H}  {duration(clip):.1f}s  "
          f"{clip.stat().st_size / 1e6:.1f} MB  voice {VOICE}, no captions")
    return clip


# ------------------------------------------------------------------- helpers
def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def main():
    stage = sys.argv[1] if len(sys.argv) > 1 else "all"

    if stage == "speech":
        speech()
    elif stage == "portrait":
        portrait()
    elif stage == "frames":
        frames()
    elif stage == "compose":
        compose()
    elif stage == "all":
        speech()
        frames()
        compose()
    else:
        sys.exit(f"Unknown stage '{stage}'. Try: speech, frames, compose, all")


if __name__ == "__main__":
    main()
