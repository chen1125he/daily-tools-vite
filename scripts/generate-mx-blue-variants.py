#!/usr/bin/env python3
"""Create MX Blue key variants from public/sounds/type-mx-blue.mp3 (decoded WAV)."""

from __future__ import annotations

import os
import struct
import wave

RATE = 44100
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "public", "sounds", "_src-mx-blue.wav")
OUT_DIR = os.path.join(ROOT, "public", "sounds")


def clamp(value: float) -> float:
    return max(-1.0, min(1.0, value))


def read_wav(path: str) -> list[float]:
    with wave.open(path, "rb") as wav_file:
        assert wav_file.getnchannels() == 1
        assert wav_file.getsampwidth() == 2
        frames = wav_file.readframes(wav_file.getnframes())
    samples = []
    for i in range(0, len(frames), 2):
        samples.append(struct.unpack_from("<h", frames, i)[0] / 32768.0)
    return samples


def write_wav(path: str, samples: list[float]) -> None:
    peak = max(abs(sample) for sample in samples) or 1.0
    gain = 0.92 / peak
    with wave.open(path, "w") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(RATE)
        frames = b"".join(struct.pack("<h", int(clamp(sample * gain) * 32767)) for sample in samples)
        wav_file.writeframes(frames)


def resample(samples: list[float], ratio: float) -> list[float]:
    if ratio <= 0:
        raise ValueError("ratio must be positive")
    out_n = max(1, int(len(samples) / ratio))
    out: list[float] = []
    last = len(samples) - 1
    for i in range(out_n):
        src = i * ratio
        i0 = int(src)
        frac = src - i0
        i1 = min(i0 + 1, last)
        out.append(samples[i0] * (1 - frac) + samples[i1] * frac)
    return out


def lowpass(samples: list[float], cutoff_hz: float) -> list[float]:
    rc = 1.0 / (2 * 3.141592653589793 * cutoff_hz)
    dt = 1.0 / RATE
    alpha = dt / (rc + dt)
    out: list[float] = []
    prev = 0.0
    for sample in samples:
        prev = prev + alpha * (sample - prev)
        out.append(prev)
    return out


def highpass(samples: list[float], cutoff_hz: float) -> list[float]:
    rc = 1.0 / (2 * 3.141592653589793 * cutoff_hz)
    dt = 1.0 / RATE
    alpha = rc / (rc + dt)
    out: list[float] = []
    prev_x = 0.0
    prev_y = 0.0
    for sample in samples:
        y = alpha * (prev_y + sample - prev_x)
        out.append(y)
        prev_x = sample
        prev_y = y
    return out


def gain(samples: list[float], amount: float) -> list[float]:
    return [sample * amount for sample in samples]


def mix(a: list[float], b: list[float]) -> list[float]:
    n = max(len(a), len(b))
    out = [0.0] * n
    for i, sample in enumerate(a):
        out[i] += sample
    for i, sample in enumerate(b):
        out[i] += sample
    return out


def offset(samples: list[float], delay_s: float) -> list[float]:
    return [0.0] * int(RATE * delay_s) + samples


def pad(samples: list[float], extra_s: float) -> list[float]:
    return samples + [0.0] * int(RATE * extra_s)


def main() -> None:
    src = read_wav(SRC)
    variants = {
        "mx-blue-key-low.wav": resample(src, 0.94),
        "mx-blue-key-high.wav": highpass(resample(src, 1.08), 180),
        "mx-blue-key-sharp.wav": highpass(resample(src, 1.14), 280),
        "mx-blue-punct.wav": highpass(resample(src, 1.18), 320),
        "mx-blue-enter.wav": pad(
            mix(lowpass(resample(src, 0.84), 4200), gain(offset(src, 0.012), 0.18)),
            0.02,
        ),
    }
    for name, samples in variants.items():
        path = os.path.join(OUT_DIR, name)
        write_wav(path, samples)
        print(path, round(len(samples) / RATE, 3))


if __name__ == "__main__":
    main()
