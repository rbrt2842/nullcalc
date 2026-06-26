import json, re, sys

INPUT = "scripts/data/Trainer Battles.txt"
OUTPUT = "src/js/data/sets/gen9.js"
SETS_VAR = "SETDEX_SV"

entries = {}
seen = set()
index = 0
current_trainer = ""

with open(INPUT, "r", encoding="utf-8-sig") as f:
    for raw in f:
        line = raw.rstrip("\n\r").strip()
        if not line or line.startswith("-"):
            continue
        if line.startswith("------"):
            current_trainer = ""
            continue
        if "Lv." not in line:
            current_trainer = line
            # Merge slot-based pool trainers under their base name
            current_trainer = re.sub(r'\s+Slot\s+\d+$', '', current_trainer)
            continue

        # Parse: MonName Lv.XX @Item: Move1, Move2, ...  [Nature|Ability]
        m = re.match(
            r'^(\S+(?:-\S+)*)\s+Lv\.(\d+)\s+@([^:]+):\s*(.*?)\s*\[(\w+)\|([^\]]+)\]$',
            line
        )
        if not m:
            print(f"WARNING: couldn't parse: {line[:120]}", file=sys.stderr)
            continue

        mon_name = m.group(1)
        level = int(m.group(2))
        item = m.group(3).strip()
        moves_str = m.group(4)
        nature = m.group(5)
        ability = m.group(6)

        # Clean moves - filter out empties and strip whitespace
        moves = [mv.strip() for mv in moves_str.split(",") if mv.strip()]

        key = (mon_name, current_trainer)
        if key in seen:
            continue
        seen.add(key)

        index += 1

        if mon_name not in entries:
            entries[mon_name] = []
        entries[mon_name].append({
            "trainer": current_trainer,
            "level": level,
            "ability": ability,
            "moves": moves,
            "nature": nature,
            "item": item,
            "index": index
        })

with open(OUTPUT, "w", encoding="utf-8") as out:
    out.write(f"var {SETS_VAR} = {{")
    first_mon = True
    for mon_name in sorted(entries.keys()):
        if not first_mon:
            out.write(",")
        first_mon = False
        out.write(f"\n\"{mon_name}\":{{")
        first_tr = True
        for e in entries[mon_name]:
            if not first_tr:
                out.write(",")
            first_tr = False
            out.write(f"\"{e['trainer']}\":{{\"level\":{e['level']},\"ability\":\"{e['ability']}\",\"moves\":{json.dumps(e['moves'])},\"nature\":\"{e['nature']}\",\"item\":\"{e['item']}\",\"index\":{e['index']}}}")
        out.write("}")
    out.write("\n};\n")

print(f"Written {index} entries across {len(entries)} Pokemon to {OUTPUT}")
