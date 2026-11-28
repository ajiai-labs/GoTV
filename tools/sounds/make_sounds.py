"""make_sounds.py - GoTV's own sounds for "Partiebeginn" and "Chatnachricht"
(28.11.2026): four variants each, chosen in the settings. The user asked for
deeper, more electronic sounds (gong, singing bowl, bass) for the game start
and, in the same family but brighter, for chat messages - so each purpose is
recognised by ear. No third-party recordings. Writes 22050 Hz mono WAV files:

  python3 tools/sounds/make_sounds.py app/src/lib/sound

  start/<variant>.wav : gong-chord, deep-gong, bowl, bass-pulse
  chat/<variant>.wav  : ding-dong, small-bowl, two-bowls, drop
(start/game-start.wav, the first gong with chord, comes from make_game_start.py.)
"""

import math
import os
import struct
import sys
import wave

SR = 22050


def write(path, samples, gain=0.85):
    peak = max(abs(x) for x in samples) or 1
    data = b"".join(struct.pack("<h", int(x / peak * gain * 32767)) for x in samples)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)


def fade_out(samples, seconds=0.08):
    n = int(SR * seconds)
    for i in range(min(n, len(samples))):
        samples[-1 - i] *= i / n
    return samples


def silence(seconds):
    return [0.0] * int(SR * seconds)


def add(target, sound, at):
    start = int(SR * at)
    for i, x in enumerate(sound):
        if start + i < len(target):
            target[start + i] += x
    return target


# Inharmonic partials of a struck gong and of a singing bowl.
GONG = [(1.0, 1.0, 2.2), (2.01, 0.5, 1.5), (2.76, 0.33, 1.0), (4.1, 0.18, 0.6), (5.4, 0.08, 0.4)]
BOWL = [(1.0, 1.0, 0.75), (2.71, 0.45, 0.45), (5.15, 0.18, 0.25), (8.4, 0.06, 0.15)]


def struck(f0, partials, dur, length=1.0, beat=1.8, sub=0.0):
    out = []
    for i in range(int(SR * dur)):
        t = i / SR
        v = 0.0
        for ratio, amp, decay in partials:
            f = f0 * ratio
            if f > SR / 2 - 200:
                continue
            v += amp * math.exp(-t / (decay * length)) * (
                math.sin(2 * math.pi * f * t) + 0.5 * math.sin(2 * math.pi * (f + beat) * t)
            )
        if sub:
            v += sub * math.exp(-t / (0.9 * length)) * math.sin(2 * math.pi * f0 / 2 * t)
        out.append(min(1.0, t / 0.01) * v)
    return fade_out(out)


def bass_pulse():
    out = silence(1.3)
    for start, f, amp in [(0.0, 55.0, 0.8), (0.30, 73.4, 1.0)]:
        hit = []
        ph = 0.0
        for i in range(int(SR * 0.9)):
            t = i / SR
            freq = f * (1 + 1.6 * math.exp(-t / 0.025))
            ph += 2 * math.pi * freq / SR
            body = math.sin(ph) + 0.3 * math.sin(2 * ph) + 0.12 * math.sin(3 * ph)
            hit.append(amp * min(1.0, t / 0.004) * math.exp(-t / 0.28) * body)
        add(out, hit, start)
    return fade_out(out)


def sine(f, dur, volume=1.0):
    return fade_out(
        [volume * math.exp(math.log(0.0001) * (i / SR) / dur) * math.sin(2 * math.pi * f * i / SR)
         for i in range(int(SR * dur))],
        0.02,
    )


def ding_dong():
    # The former chat sound: 988 Hz, then 740 Hz - twice, as it always was.
    out = silence(1.3)
    for at in (0.0, 0.6):
        add(out, sine(988, 0.3), at)
        add(out, sine(740, 0.4), at + 0.22)
    return out


def drop():
    out = []
    ph = 0.0
    for i in range(int(SR * 0.35)):
        t = i / SR
        freq = 700 + 900 * (1 - math.exp(-t / 0.03))
        ph += 2 * math.pi * freq / SR
        out.append(math.exp(-t / 0.07) * math.sin(ph))
    second = [0.5 * x for x in out]
    return fade_out(add(add(silence(0.6), out, 0.0), second, 0.16), 0.03)


START = {
    "deep-gong": lambda: struck(61.7, GONG, 3.0, length=1.3, sub=0.6),
    "bowl": lambda: struck(110.0, BOWL, 3.0, length=3.5, beat=1.2),
    "bass-pulse": bass_pulse,
}

CHAT = {
    "ding-dong": ding_dong,
    "small-bowl": lambda: struck(523.0, BOWL, 1.0, length=1.0, beat=3.0),
    "two-bowls": lambda: add(
        add(silence(1.0), struck(440.0, BOWL, 0.8, beat=3.0), 0.0),
        struck(659.0, BOWL, 0.8, beat=3.0),
        0.18,
    ),
    "drop": drop,
}

if __name__ == "__main__":
    root = sys.argv[1]
    for name, make in START.items():
        write(os.path.join(root, "start", name + ".wav"), make())
    for name, make in CHAT.items():
        write(os.path.join(root, "chat", name + ".wav"), make())
