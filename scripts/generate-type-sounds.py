#!/usr/bin/env python3
"""Generate short keyboard click WAV samples for the typing demo."""

from __future__ import annotations

import math
import os
import random
import struct
import wave

RATE = 44100
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "sounds")


def clamp(value: float) -> float:
    return max(-1.0, min(1.0, value))


def write_wav(path: str, samples: list[float]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, "w") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(RATE)
        frames = b"".join(struct.pack("<h", int(clamp(sample) * 32767)) for sample in samples)
        wav_file.writeframes(frames)


def highpass(samples: list[float], cutoff_hz: float) -> list[float]:
    rc = 1.0 / (2 * math.pi * cutoff_hz)
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


def lowpass(samples: list[float], cutoff_hz: float) -> list[float]:
    rc = 1.0 / (2 * math.pi * cutoff_hz)
    dt = 1.0 / RATE
    alpha = dt / (rc + dt)
    out: list[float] = []
    prev = 0.0
    for sample in samples:
        prev = prev + alpha * (sample - prev)
        out.append(prev)
    return out


def mix(*parts: list[float]) -> list[float]:
    length = max(len(part) for part in parts)
    out = [0.0] * length
    for part in parts:
        for i, sample in enumerate(part):
            out[i] += sample
    peak = max(abs(sample) for sample in out) or 1.0
    return [sample / peak * 0.85 for sample in out]


def noise_burst(rng: random.Random, duration: float, decay: float, amp: float) -> list[float]:
    n = int(RATE * duration)
    samples = []
    for i in range(n):
        t = i / RATE
        env = math.exp(-t / decay)
        samples.append(rng.uniform(-1, 1) * env * amp)
    return samples


def tone(freq: float, duration: float, decay: float, amp: float, kind: str = "sine") -> list[float]:
    n = int(RATE * duration)
    samples = []
    for i in range(n):
        t = i / RATE
        phase = 2 * math.pi * freq * t
        if kind == "triangle":
            wave_val = 2 * abs(2 * ((t * freq) % 1) - 1) - 1
        elif kind == "square":
            wave_val = 1.0 if math.sin(phase) >= 0 else -1.0
        else:
            wave_val = math.sin(phase)
        samples.append(wave_val * math.exp(-t / decay) * amp)
    return samples


def pad(samples: list[float], extra: float = 0.02) -> list[float]:
    return samples + [0.0] * int(RATE * extra)


def offset(samples: list[float], delay_s: float) -> list[float]:
    return [0.0] * int(RATE * delay_s) + samples


def make_mx_blue() -> list[float]:
    """Cherry MX Blue-like: sharp click-jacket snap, then a quieter bottom-out."""
    rng = random.Random(42)
    snap = lowpass(highpass(noise_burst(rng, 0.02, 0.002, 1.2), 3000), 9500)
    click_ring = mix(
        tone(3350, 0.05, 0.007, 0.58, "triangle"),
        tone(2480, 0.055, 0.008, 0.36),
        tone(4720, 0.03, 0.004, 0.24, "triangle"),
    )
    leaf = offset(highpass(noise_burst(rng, 0.014, 0.0018, 0.75), 2200), 0.0022)
    leaf_tone = offset(tone(1780, 0.028, 0.004, 0.3, "square"), 0.0022)
    bottom_noise = offset(lowpass(highpass(noise_burst(rng, 0.045, 0.008, 0.32), 350), 1700), 0.016)
    bottom_thud = offset(tone(205, 0.08, 0.016, 0.16), 0.016)
    housing = offset(tone(1020, 0.045, 0.01, 0.1, "triangle"), 0.016)
    return pad(mix(snap, click_ring, leaf, leaf_tone, bottom_noise, bottom_thud, housing), 0.04)


def make_click() -> list[float]:
    rng = random.Random(7)
    noise = highpass(noise_burst(rng, 0.045, 0.006, 0.9), 2200)
    tick = tone(2400, 0.03, 0.004, 0.28, "triangle")
    body = tone(420, 0.05, 0.01, 0.12)
    return pad(mix(noise, tick, body), 0.03)


def make_soft() -> list[float]:
    rng = random.Random(21)
    noise = lowpass(highpass(noise_burst(rng, 0.06, 0.012, 0.55), 900), 3800)
    body = tone(220, 0.08, 0.018, 0.18)
    return pad(mix(noise, body), 0.04)


def make_thock() -> list[float]:
    rng = random.Random(33)
    noise = lowpass(highpass(noise_burst(rng, 0.07, 0.01, 0.7), 600), 2500)
    thud = tone(95, 0.12, 0.025, 0.45)
    mid = tone(380, 0.07, 0.014, 0.22, "triangle")
    return pad(mix(noise, thud, mid), 0.04)


def make_typewriter() -> list[float]:
    rng = random.Random(99)
    attack = highpass(noise_burst(rng, 0.035, 0.004, 1.0), 1800)
    clack = tone(1650, 0.04, 0.006, 0.35, "square")
    bar = tone(140, 0.09, 0.02, 0.28)
    return pad(mix(attack, clack, bar), 0.05)


def main() -> None:
    out_dir = os.path.abspath(OUT_DIR)
    sounds = {
        "type-mx-blue.wav": make_mx_blue(),
        "type-click.wav": make_click(),
        "type-soft.wav": make_soft(),
        "type-thock.wav": make_thock(),
        "type-typewriter.wav": make_typewriter(),
    }
    for name, samples in sounds.items():
        path = os.path.join(out_dir, name)
        write_wav(path, samples)
        print(path, len(samples) / RATE)


if __name__ == "__main__":
    main()
