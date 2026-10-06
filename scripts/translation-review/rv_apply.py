import json, re, sys, io, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
RV = r"WORK/rv/"
lang = sys.argv[1]
write = '--write' in sys.argv
show = '--show' in sys.argv
skip = set()
try:
    skip = set(json.load(open(RV + f'skip-{lang}.json', encoding='utf-8')))
except FileNotFoundError:
    pass
p = f'src/data/story-{lang}.js'
src = open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in src else '\n'
lines = src.split(nl)
row = re.compile(r'^  ("[^"]+"): (\{.*\}),$')
at = {}
for i, line in enumerate(lines):
    m = row.match(line)
    if m:
        at[json.loads(m.group(1))] = (i, json.loads(m.group(2)))
fixes, bad = [], []
for f in sorted(glob.glob(RV + f'fix-{lang}-*.json')):
    try:
        fixes += [(f[-6], n, x) for n, x in enumerate(json.load(open(f, encoding='utf-8')))]
    except Exception as e:
        bad.append((f, str(e)[:80]))
done = 0
kinds = {}
for b, n, x in fixes:
    key = f'{b}:{n}'
    if key in skip:
        continue
    k, field = x.get('id'), x.get('field')
    if k not in at or field not in ('story', 'esg') or field not in at[k][1]:
        bad.append((key, 'no such entry/field', k)); continue
    cur = at[k][1][field]
    if cur.count(x['find']) != 1 or x['find'] == x['replace'] or not x['replace'].strip():
        bad.append((key, f"find x{cur.count(x['find'])}", k)); continue
    at[k][1][field] = cur.replace(x['find'], x['replace'], 1)
    done += 1
    kinds[x.get('kind')] = kinds.get(x.get('kind'), 0) + 1
    if show:
        print(f"[{key}] {k}.{field} ({x.get('kind')}) {x.get('why')}\n   - {x['find']}\n   + {x['replace']}")
print(lang, 'fixes', len(fixes), 'applied', done, kinds, 'bad', len(bad))
for x in bad:
    print(' !', x)
if write:
    for k, (i, v) in at.items():
        lines[i] = f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},"
    open(p, 'w', encoding='utf-8', newline='').write(nl.join(lines))
    print('written')
