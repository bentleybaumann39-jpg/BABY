"""
Single source of truth for OPPOSITE DAY: storyboard + asset manifest.

    python3 opposite/gen_storyboard.py [--out DIR]

Writes /home/user/BABY/opposite/STORYBOARD.md and /home/user/BABY/opposite/assets.json
and checks that:
  * every asset a shot references is in the manifest and every manifest asset is used;
  * the runtime is inside 280-320 s;
  * real scares are >= 45 s apart and grow (duration and frame fill);
  * subliminal frames are >= 1 s apart; 4-6 hidden figures; at most 3 digital silences.

The content lives in opposite/sb/*.py, executed in order into this module's namespace:
  assets_rooms.py  assets_art.py  assets_audio.py   (asset definitions)
  shots_1.py shots_2.py shots_3.py shots_4.py       (the shot list)
  beats.py                                          (scare map, subliminals, hidden figures, changes)
  text.py                                           (prose sections of STORYBOARD.md)
Edit those, not the generated files.
"""
import json
import os
import sys
from collections import OrderedDict, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = HERE
if "--out" in sys.argv:
    BASE = sys.argv[sys.argv.index("--out") + 1]
SB = os.path.join(HERE, "sb")


def run_part(name):
    path = os.path.join(SB, name)
    code = compile(open(path, encoding="utf-8").read(), path, "exec")
    exec(code, globals())


# ---------------------------------------------------------------------------
# Asset registries (filled by the parts)
# ---------------------------------------------------------------------------
ROOMS, CHAR, MISC, AUDIO = [], [], [], []
VOICE_SPECS = OrderedDict()


def room(name, size, description, camera, lighting, notes):
    ROOMS.append(dict(name=name, size=size, description=description, camera=camera, lighting=lighting, notes=notes))


def char(name, size, transparent, description):
    CHAR.append(dict(name=name, size=size, transparent=transparent, description=description))


def misc(name, size, transparent, description, text=""):
    MISC.append(dict(name=name, size=size, transparent=transparent, description=description, text=text))


def aud(name, kind, description, text="", voice="", seconds=None):
    AUDIO.append(dict(name=name, kind=kind, description=description, text=text, voice=voice, seconds=seconds))


def vo(name, voice, text, seconds, extra=""):
    spk, deliv, _ = VOICE_SPECS[voice]
    desc = f"{spk} - {deliv}. Preset '{voice}' (STORYBOARD.md section 6). {extra}".strip()
    aud(name, "voice", desc, text=text, voice=voice, seconds=seconds)


run_part("assets_rooms.py")
run_part("assets_art.py")
run_part("assets_audio.py")

PATH = {}
for r in ROOMS:
    PATH[r["name"]] = f"build/rooms/{r['name']}.png"
for p in CHAR:
    PATH[p["name"]] = f"build/art/char/{p['name']}.png"
for m in MISC:
    PATH[m["name"]] = f"build/art/misc/{m['name']}.png"
for a in AUDIO:
    PATH[a["name"]] = f"build/audio/{a['name']}.wav"
AUD = {a["name"]: a for a in AUDIO}
assert len(PATH) == len(ROOMS) + len(CHAR) + len(MISC) + len(AUDIO), "duplicate asset name"

# ---------------------------------------------------------------------------
# Shot-list helpers
# ---------------------------------------------------------------------------
USED = defaultdict(list)
SEGMENTS, SHOTS = [], []
cur = None
curseg = None


def seg(sid, title, summary, act):
    global curseg
    curseg = dict(id=sid, title=title, summary=summary, act=act, shots=[])
    SEGMENTS.append(curseg)


def sh(sid, dur, title):
    global cur
    cur = dict(id=sid, dur=dur, title=title, seg=curseg["id"], picture="", camera="", vhs="",
               audio=[], text="", notes="", refs=[], cues=[], scare="")
    SHOTS.append(cur)
    curseg["shots"].append(cur)


def ref(name):
    path = PATH[name]  # KeyError = undefined asset
    if path not in cur["refs"]:
        cur["refs"].append(path)
    if cur["id"] not in USED[path]:
        USED[path].append(cur["id"])
    return f"`{path}`"


R = ref


def VO(n, at, extra=""):
    a = AUD[n]
    spk, deliv, _ = VOICE_SPECS[a["voice"]]
    ats = at if isinstance(at, (list, tuple)) else [at]
    for x in ats:
        cur["cues"].append((x, PATH[n]))
    when = "/".join(f"+{x:.1f}" for x in ats)
    s = f"{when} s {ref(n)} **{spk}** ({deliv}): “{a['text']}”"
    if extra:
        s += f" - {extra}"
    return s


def SFX(n, at, note):
    ats = at if isinstance(at, (list, tuple)) else [at]
    for x in ats:
        cur["cues"].append((x, PATH[n]))
    when = "/".join(f"+{x:.1f}" for x in ats)
    return f"{when} s {ref(n)} - {note}"


def pic(s): cur["picture"] = s
def cam(s): cur["camera"] = s
def vhs(s): cur["vhs"] = s
def txt(s): cur["text"] = s
def note(s): cur["notes"] = s
def scare(s): cur["scare"] = s


def au(*lines):
    cur["audio"].extend(lines)

    def key(l):
        if l.startswith("+"):
            return float(l[1:l.index(" s ")].split("/")[0].lstrip("+"))
        return -1.0
    cur["audio"].sort(key=key)


for part in ("shots_1.py", "shots_2.py", "shots_3.py", "shots_4.py"):
    run_part(part)

# ---------------------------------------------------------------------------
# Timing
# ---------------------------------------------------------------------------
t = 0.0
for s in SHOTS:
    s["start"] = round(t, 3)
    t = round(t + s["dur"], 3)
    s["end"] = t
for g in SEGMENTS:
    g["start"] = g["shots"][0]["start"]
    g["end"] = g["shots"][-1]["end"]
TOTAL = t
SHOT = {s["id"]: s for s in SHOTS}
assert len(SHOT) == len(SHOTS), "duplicate shot id"


def tc(x):
    m = int(x // 60)
    return f"{m}:{x - 60 * m:04.1f}"


def at(sid, off=0.0):
    return SHOT[sid]["start"] + off


run_part("beats.py")

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
unused = sorted(set(PATH.values()) - set(USED))
assert not unused, f"assets never used in a shot: {unused}"
assert 280 <= TOTAL <= 320, TOTAL
scare_times = [at(sid) for _, sid, *_ in SCARES]
gaps = [b - a for a, b in zip(scare_times, scare_times[1:])]
assert all(g >= 45 for g in gaps), gaps
durs = [SHOT[sid]["dur"] for _, sid, *_ in SCARES]
fills = [x[2] for x in SCARES]
assert durs == sorted(durs) and fills == sorted(fills) and len(set(fills)) == len(fills), (durs, fills)
sub_times = sorted(at(sid, off) for _, sid, off, _, _ in SUBLIMINALS)
assert all(b - a >= 1.0 for a, b in zip(sub_times, sub_times[1:])), sub_times
for _, sid, off, n, _ in SUBLIMINALS:
    assert off + n / 30.0 <= SHOT[sid]["dur"] + 1e-6, sid
assert 4 <= len(HIDDEN) <= 6, len(HIDDEN)
assert len(SILENCES) <= 3
for sid in [x[1] for x in SILENCES] + [x[1] for x in HIDDEN] + [x[0] for x in CHANGES] + [x[1] for x in DREAD]:
    assert sid in SHOT, sid
for s in SHOTS:
    for x, p in s["cues"]:
        assert 0 <= x < s["dur"] + 1e-6, (s["id"], x, p)
for a in AUDIO:
    if a["kind"] == "voice":
        assert a["text"], a["name"]

run_part("text.py")

# ---------------------------------------------------------------------------
# assets.json
# ---------------------------------------------------------------------------


def used_in(name):
    return USED[PATH[name]]


manifest = OrderedDict()
manifest["rooms"] = [OrderedDict([("file", PATH[r["name"]]), ("description", r["description"]), ("camera", r["camera"]),
                                  ("lighting", r["lighting"]), ("notes", r["notes"]), ("size", r["size"]),
                                  ("used_in", used_in(r["name"]))]) for r in ROOMS]
manifest["char_art"] = [OrderedDict([("file", PATH[p["name"]]), ("description", p["description"]),
                                     ("transparent", p["transparent"]), ("size", p["size"]),
                                     ("used_in", used_in(p["name"]))]) for p in CHAR]
manifest["misc_art"] = [OrderedDict([("file", PATH[m["name"]]), ("description", m["description"]),
                                     ("text", m["text"]), ("transparent", m["transparent"]), ("size", m["size"]),
                                     ("used_in", used_in(m["name"]))]) for m in MISC]
manifest["audio"] = []
for a in AUDIO:
    e = OrderedDict([("file", PATH[a["name"]]), ("kind", a["kind"]), ("description", a["description"]),
                     ("text", a["text"]), ("voice", a["voice"]), ("target_seconds", a["seconds"])])
    if a["voice"]:
        e["voice_recipe"] = VOICE_SPECS[a["voice"]][2]
    e["used_in"] = used_in(a["name"])
    manifest["audio"].append(e)

os.makedirs(BASE, exist_ok=True)
with open(os.path.join(BASE, "STORYBOARD.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(MD) + "\n")
with open(os.path.join(BASE, "assets.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=1, ensure_ascii=False)
    f.write("\n")

print(f"runtime {TOTAL:.1f} s ({tc(TOTAL)}), {len(SEGMENTS)} segments, {len(SHOTS)} shots")
print(f"rooms {len(ROOMS)}, char_art {len(CHAR)}, misc_art {len(MISC)}, audio {len(AUDIO)}")
print("scares:", ", ".join(f"{n} {tc(x)}" for (n, *_), x in zip(SCARES, scare_times)), "gaps", [round(g, 1) for g in gaps])
print("subliminals:", ", ".join(tc(x) for x in sub_times))
