"""make_countdown.py - candidates for GoTV's "Zeit läuft ab" sound (28.11.2026).

The user found KaTrain's clock beep still too bright and asked for something
deeper, a bit more electronic - perhaps like a meditation (singing) bowl.
Writes, per variant, one tick (seconds 10-4), one "last" tick (the last
three seconds, a bit higher) and a 10-second demo of the whole countdown.
Usage: python3 tools/sounds/make_countdown.py OUT_DIR
"""

import math
import os
import struct
import sys
import wave

SR = 44100


def write(path, samples, gain=0.85):
    peak = max(abs(x) for x in samples) or 1
    data = b"".join(struct.pack("<h", int(x / peak * gain * 32767)) for x in samples)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)


def fade_out(samples, seconds=0.06):
    n = int(SR * seconds)
    for i in range(min(n, len(samples))):
        samples[-1 - i] *= i / n
    return samples


# Singing bowls ring with inharmonic partials (about 1 : 2.7 : 5.1 : 8.4).
BOWL = [(1.0, 1.0, 0.75), (2.71, 0.45, 0.45), (5.15, 0.18, 0.25), (8.4, 0.06, 0.15)]


def bowl(f0, dur=0.9, shimmer=0.0, sub=0.0):
    out = []
    for i in range(int(SR * dur)):
        t = i / SR
        strike = min(1.0, t / 0.012)
        v = 0.0
        for ratio, amp, decay in BOWL:
            f = f0 * ratio
            beat = 0.5 * math.sin(2 * math.pi * (f + 1.8) * t)  # the slow wobble of a bowl
            v += amp * math.exp(-t / decay) * (math.sin(2 * math.pi * f * t) + beat)
        if shimmer:
            # electronic: a ring-modulated copy of the fundamental
            v += shimmer * math.exp(-t / 0.35) * math.sin(2 * math.pi * f0 * t) * math.sin(2 * math.pi * 7.5 * t)
        if sub:
            v += sub * math.exp(-t / 0.3) * math.sin(2 * math.pi * f0 / 2 * t)
        out.append(strike * v)
    return fade_out(out)


def pulse(f0, dur=0.6):
    out = []
    ph = 0.0
    for i in range(int(SR * dur)):
        t = i / SR
        freq = f0 * (1 + 0.35 * math.exp(-t / 0.02))
        ph += 2 * math.pi * freq / SR
        mod = math.sin(ph * 2) * 0.8 * math.exp(-t / 0.08)  # soft FM edge
        v = math.sin(ph + mod) + 0.25 * math.sin(ph / 2)
        out.append(min(1.0, t / 0.005) * math.exp(-t / 0.18) * v)
    return fade_out(out)


def demo(tick, last):
    total = [0.0] * int(SR * 10.5)
    for second in range(10, 0, -1):
        sound = last if second <= 3 else tick
        start = int(SR * (10 - second))
        for i, x in enumerate(sound):
            if start + i < len(total):
                total[start + i] += x
    return total


VARIANTS = {
    "A-Klangschale": (lambda: bowl(150.0), lambda: bowl(200.0)),
    "B-Elektronische-Schale": (
        lambda: bowl(130.0, shimmer=0.6, sub=0.5),
        lambda: bowl(173.0, shimmer=0.6, sub=0.5),
    ),
    "C-Tiefer-Puls": (lambda: pulse(110.0), lambda: pulse(147.0)),
}

if __name__ == "__main__":
    out_dir = sys.argv[1]
    for name, (make_tick, make_last) in VARIANTS.items():
        tick, last = make_tick(), make_last()
        write(os.path.join(out_dir, name + "-tick.wav"), tick)
        write(os.path.join(out_dir, name + "-last.wav"), last)
        write(os.path.join(out_dir, name + "-Ablauf-10-Sekunden.wav"), demo(tick, last))
