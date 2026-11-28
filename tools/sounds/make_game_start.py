"""make_game_start.py - generates GoTV's "Partiebeginn" sound (28.11.2026).

The user chose a mix of a deep electronic gong and a warm low D-major chord
(test files A and C, mixed as D). GoTV's own sound - no third-party
recording. Usage: python3 tools/sounds/make_game_start.py OUT_DIR
Writes D-Gong-und-Akkord.wav (used) and E-Gong-und-Akkord-kurz.wav (a
shorter variant); the app takes D, resampled to 22050 Hz mono:
  ffmpeg -i OUT_DIR/D-Gong-und-Akkord.wav -ar 22050 -ac 1 app/src/lib/sound/start/game-start.wav
"""
import math, struct, wave, sys, os
SR = 44100
out = sys.argv[1]

def write(path, samples):
    peak = max(abs(x) for x in samples) or 1
    data = b''.join(struct.pack('<h', int(x / peak * 0.85 * 32767)) for x in samples)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data)

def gong(t, f0=98.0, length=1.0):
    parts = [(1.0, 1.0, 2.2), (2.01, 0.5, 1.5), (2.76, 0.33, 1.0), (4.1, 0.18, 0.6), (5.4, 0.08, 0.4)]
    v = 0.0
    for ratio, amp, dec in parts:
        f = f0 * ratio
        e = min(1.0, t / 0.008) * math.exp(-t / (dec * length))
        v += amp * e * (math.sin(2 * math.pi * f * t) + 0.5 * math.sin(2 * math.pi * (f + 0.7) * t))
    return v

# D-major voicing under a gong on D (f0 = 73.4 Hz = D2) so both fit together.
NOTES = [73.42, 110.0, 146.83, 185.0]

def chord(t, swell=0.25, hold=0.35, decay=0.9):
    e = min(1.0, t / swell) * math.exp(-max(0.0, t - hold) / decay)
    v = 0.0
    for k, f in enumerate(NOTES):
        for n in range(1, 6):
            v += (1 / n ** 1.6) * (math.sin(2 * math.pi * f * n * t) + math.sin(2 * math.pi * f * 1.003 * n * t)) * (0.9 if k else 1.2)
    return e * v

def mix(dur, gong_amp, chord_amp, length, swell, hold, decay, chord_delay):
    s = []
    for i in range(int(SR * dur)):
        t = i / SR
        v = gong_amp * gong(t, 73.42, length)
        if t >= chord_delay:
            v += chord_amp * chord(t - chord_delay, swell, hold, decay)
        # soft end, no click
        v *= min(1.0, (dur - t) / 0.15)
        s.append(v)
    return s

write(os.path.join(out, 'D-Gong-und-Akkord.wav'), mix(2.6, 3.0, 0.55, 1.0, 0.25, 0.35, 0.9, 0.05))
write(os.path.join(out, 'E-Gong-und-Akkord-kurz.wav'), mix(1.5, 3.0, 0.55, 0.6, 0.12, 0.15, 0.5, 0.0))
