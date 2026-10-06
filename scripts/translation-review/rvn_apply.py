import json, re, sys, io, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
RV = r"WORK/rvn/"
lang = sys.argv[1]
write = '--write' in sys.argv; show = '--show' in sys.argv
try: skip = set(json.load(open(RV + f'skip-{lang}.json', encoding='utf-8')))
except FileNotFoundError: skip = set()
row = re.compile(r'^  ("[^"]+"): (\{.*\}),$')
files = {}
at = {}
for p in glob.glob(f'src/data/notes/notes-{lang}-*.js'):
    src = open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in src else '\n'
    lines = src.split(nl)
    files[p] = (lines, nl)
    for i, line in enumerate(lines):
        m = row.match(line)
        if m: at[json.loads(m.group(1))] = (p, i, json.loads(m.group(2)))
URL = re.compile(r'https?://[A-Za-z0-9\-._~:/?#\[\]@!$&\'()*+,;=%]+')
HAN = re.compile(r'[가-힣]{3,}')
urls = lambda t: sorted(re.sub(r"[).,;:'\"”]+$", '', u) for u in URL.findall(t))
SUB = 'done/' if '--redo' in sys.argv else ''
fixes, bad = [], []
for f in sorted(glob.glob(RV + SUB + f'fix-{lang}-*.json')):
    try: fixes += [(f[-7:-5], n, x) for n, x in enumerate(json.load(open(f, encoding='utf-8')))]
    except Exception as e: bad.append((f, str(e)[:80]))
done = 0; kinds = {}
def get(v, field):
    if field in ('vegan', 'halal'): return v.get(field)
    if field.startswith('cert.'): return (v.get('cert') or {}).get(field[5:])
    if field.startswith('timeline.'):
        t = v.get('timeline') or []; i = int(field[9:]); return t[i] if i < len(t) else None
def put(v, field, s):
    if field in ('vegan', 'halal'): v[field] = s
    elif field.startswith('cert.'): v['cert'][field[5:]] = s
    else: v['timeline'][int(field[9:])] = s
for b, n, x in fixes:
    key = f'{b}:{n}'
    if key in skip: continue
    k, field = x.get('id'), str(x.get('field'))
    cur = get(at[k][2], field) if k in at else None
    if not isinstance(cur, str): bad.append((key, 'no such entry/field', k, field)); continue
    if x['replace'] in cur and (x['find'] in x['replace'] or x['find'] not in cur): continue
    if cur.count(x['find']) != 1 or x['find'] == x['replace'] or not x['replace'].strip(): bad.append((key, f"find x{cur.count(x['find'])}", k)); continue
    new = cur.replace(x['find'], x['replace'], 1)
    if urls(new) != urls(cur): bad.append((key, 'url changed', k)); continue
    if lang != 'ko' and sorted(HAN.findall(new)) != sorted(HAN.findall(cur)): bad.append((key, 'hangul changed', k, x['find'][:30], x['replace'][:30])); continue
    put(at[k][2], field, new); done += 1; kinds[x.get('kind')] = kinds.get(x.get('kind'), 0) + 1
    if show: print(f"[{key}] {k}.{field} ({x.get('kind')}) {x.get('why')}\n   - {x['find']}\n   + {x['replace']}")
print(lang, 'fixes', len(fixes), 'applied', done, kinds, 'bad', len(bad))
for x in bad: print(' !', x)
if write:
    for k, (p, i, v) in at.items(): files[p][0][i] = f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},"
    for p, (lines, nl) in files.items(): open(p, 'w', encoding='utf-8', newline='').write(nl.join(lines))
    print('written')
