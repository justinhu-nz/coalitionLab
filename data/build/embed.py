"""Inline the derived data into electorates.html (between the seatData script tags).

Usage: python3 data/build/embed.py data/notional2023.json data/candidates2026.json electorates.html
"""
import json, re, sys

notional, cands, page = sys.argv[1:4]
N = json.load(open(notional, encoding='utf-8'))
C = json.load(open(cands, encoding='utf-8'))['seats']
P = N['parties']

nat = {p: 0.0 for p in P}
for s in N['seats']:
    for p, v in s['party'].items(): nat[p] += v * s['votes'] / 100
tot = sum(nat.values())

seats = []
for s in N['seats']:
    c = C[s['name']]
    seats.append({
        'n': s['name'], 'm': 1 if s['maori'] else 0, 'v': s['votes'],
        'p': [s['party'].get(p, 0) for p in P],
        'c': s['cand'],
        'f': s['from'],
        'k': [[x['name'], x['party'], 1 if x.get('incumbent') else 0, 1 if x.get('listMP') else 0, x.get('rank', 0), x.get('label', '')] for x in c['candidates']],
        'r': [[x['name'], x['party']] for x in c['retiring']],
        'i': 1 if s['name'] == 'Port Waikato' else 0,   # 2023 candidate vote imputed (poll cancelled)
    })

data = {'parties': P, 'national23': [round(nat[p] / tot * 100, 3) for p in P], 'split': N['split2023'], 'seats': seats,
        'sources': [N['source'], json.load(open(cands, encoding='utf-8'))['source']]}
blob = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
html = open(page, encoding='utf-8').read()
html, n = re.subn(r'(<script type="application/json" id="seatData">)(.*?)(</script>)', lambda m: m.group(1) + blob + m.group(3), html, flags=re.S)
assert n == 1, 'seatData block not found'
open(page, 'w', encoding='utf-8').write(html)
print('embedded', len(blob), 'bytes,', len(seats), 'seats')
