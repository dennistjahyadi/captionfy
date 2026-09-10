#!/usr/bin/env python3
"""
Mix a music bed under speech at a stated signal-to-noise ratio.

The `music-under-voice` half of the Stage 0 gate needs clips where music sits
under the voice. Found footage gives you an unknown amount of music, so a bad word
error rate tells you nothing about how much music the model can survive. Mixing it
yourself turns the music into a dial: run the same sentence at several ratios and
the number that comes back is the point where accuracy falls over.

Standard library only, so there is nothing to install and no ffmpeg anywhere near
this project. Both inputs must be 16-bit PCM WAV; convert with macOS's own
afconvert first:

    afconvert -f WAVE -d LEI16 input.mp3 output.wav

Usage:
    ./mix-music-bed.py speech.wav music.wav out.wav --snr 5
    ./mix-music-bed.py speech.wav music.wav out-dir/ --snr 15 10 5 0
"""
import argparse
import array
import math
import pathlib
import sys
import wave


def read_wav(path):
    """Returns (samples as a float list scaled to +/-1, sample rate)."""
    with wave.open(str(path), "rb") as w:
        if w.getsampwidth() != 2:
            raise SystemExit(f"{path}: needs 16-bit PCM, found {w.getsampwidth() * 8}-bit")
        channels, rate, frames = w.getnchannels(), w.getframerate(), w.getnframes()
        raw = array.array("h")
        raw.frombytes(w.readframes(frames))
        if sys.byteorder == "big":
            raw.byteswap()

    if channels == 1:
        return [s / 32768.0 for s in raw], rate
    # Downmix, so the ratio below is computed on what the model will actually hear.
    return [
        sum(raw[i + c] for c in range(channels)) / (channels * 32768.0)
        for i in range(0, len(raw) - channels + 1, channels)
    ], rate


def write_wav(path, samples, rate):
    clipped = array.array(
        "h", (max(-32768, min(32767, int(round(s * 32767)))) for s in samples)
    )
    if sys.byteorder == "big":
        clipped.byteswap()
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(clipped.tobytes())


def rms(samples):
    if not samples:
        return 0.0
    return math.sqrt(sum(s * s for s in samples) / len(samples))


def speech_rms(samples, rate):
    """
    RMS of the loud part only.

    Measuring across the whole file counts the pauses between sentences as signal,
    which quietly makes the mix louder than the ratio claims.
    """
    window = max(1, int(rate * 0.02))
    energies = sorted(
        rms(samples[i : i + window]) for i in range(0, len(samples) - window + 1, window)
    )
    if not energies:
        return rms(samples)
    # The top third of 20 ms frames is speech; the rest is breath and room.
    loud = energies[int(len(energies) * 0.66) :]
    return math.sqrt(sum(e * e for e in loud) / len(loud)) if loud else rms(samples)


def loop_to_length(samples, length):
    if not samples:
        raise SystemExit("music file is empty")
    repeats = -(-length // len(samples))
    return (samples * repeats)[:length]


def mix(speech_path, music_path, out_path, snr_db):
    speech, speech_rate = read_wav(speech_path)
    music, music_rate = read_wav(music_path)

    if music_rate != speech_rate:
        raise SystemExit(
            f"sample rates differ: speech {speech_rate} Hz, music {music_rate} Hz.\n"
            f"Resample first:  afconvert -f WAVE -d LEI16@{speech_rate} "
            f"{music_path} resampled.wav"
        )

    music = loop_to_length(music, len(speech))
    signal, noise = speech_rms(speech, speech_rate), rms(music)
    if noise == 0:
        raise SystemExit("music file is silent")

    gain = signal / (noise * (10 ** (snr_db / 20.0)))
    mixed = [s + m * gain for s, m in zip(speech, music)]

    # Attenuate rather than clip, and say so, because clipping is distortion the
    # ratio does not account for.
    peak = max(abs(s) for s in mixed) if mixed else 0.0
    headroom = ""
    if peak > 0.999:
        scale = 0.999 / peak
        mixed = [s * scale for s in mixed]
        headroom = f", scaled by {20 * math.log10(scale):.1f} dB to stop clipping"

    write_wav(out_path, mixed, speech_rate)
    print(
        f"{out_path.name}: {len(speech) / speech_rate:.1f} s at {snr_db:+g} dB SNR"
        f", music gain {20 * math.log10(gain):.1f} dB{headroom}"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("speech", type=pathlib.Path, help="16-bit PCM WAV of the voice")
    parser.add_argument("music", type=pathlib.Path, help="16-bit PCM WAV of the bed, looped to fit")
    parser.add_argument("output", type=pathlib.Path, help="output WAV, or a directory when several ratios are given")
    parser.add_argument(
        "--snr",
        type=float,
        nargs="+",
        default=[5.0],
        help="signal-to-noise ratio in dB. Lower is more music. 20 is barely there, 0 is equal loudness",
    )
    args = parser.parse_args()

    for path in (args.speech, args.music):
        if not path.is_file():
            raise SystemExit(f"no such file: {path}")

    if len(args.snr) == 1 and args.output.suffix.lower() == ".wav":
        args.output.parent.mkdir(parents=True, exist_ok=True)
        mix(args.speech, args.music, args.output, args.snr[0])
        return

    args.output.mkdir(parents=True, exist_ok=True)
    for snr in args.snr:
        mix(args.speech, args.music, args.output / f"{args.speech.stem}-snr{snr:g}dB.wav", snr)


if __name__ == "__main__":
    main()
