import json, re, sys, io, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
RV = r"WORK/rvm/"
lang = sys.argv[1]
write = '--write' in sys.argv
show = '--show' in sys.argv
p = f'src/data/menu-{lang}.js'
src = open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in src else '\n'
lines = src.split(nl)
row = re.compile(r'^  ("(?:[^"\\]|\\.)*"): ("(?:[^"\\]|\\.)*"),$')
at = {}
for i, line in enumerate(lines):
    m = row.match(line)
    if m:
        at[json.loads(m.group(1))] = i
VEGAN = re.compile(r'vegan|ヴィーガン|ビーガン|纯素|純素|全素|비건', re.I)
HALAL = re.compile(r'halal|ハラール|ハラル|清真|할랄', re.I)
NV = re.compile(r'비건|vegan|\bvg\b', re.I)
NH = re.compile(r'할랄|halal', re.I)
done, bad, kinds = 0, [], {}
for f in sorted(glob.glob(RV + f'fix-{lang}-*.json')):
    for x in json.load(open(f, encoding='utf-8')):
        name, gloss = x.get('name'), (x.get('gloss') or '').strip()
        if name not in at or not gloss:
            bad.append(('no such name', name)); continue
        if (VEGAN.search(gloss) and not NV.search(name)) or (HALAL.search(gloss) and not NH.search(name)):
            bad.append(('diet word not in name', name, gloss)); continue
        old = json.loads(row.match(lines[at[name]]).group(2))
        if old == gloss: continue
        lines[at[name]] = f"  {json.dumps(name, ensure_ascii=False)}: {json.dumps(gloss, ensure_ascii=False)},"
        done += 1; kinds[x.get('kind')] = kinds.get(x.get('kind'), 0) + 1
        if show: print(f"{name}\n   - {old}\n   + {gloss}   ({x.get('kind')}: {x.get('why')})")
print(lang, 'applied', done, kinds, 'bad', len(bad))
for b in bad: print(' !', b)
if write:
    open(p, 'w', encoding='utf-8', newline='').write(nl.join(lines))
    print('written')
