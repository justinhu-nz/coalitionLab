"""Notional 2023 results on the 2025 (2026-election) electorate boundaries.

Usage (needs shapely + pyshp):
  python data/build/notional.py <booth-inspector dir> data/notional2023.json

Method
  1. Every 2023 voting place is located (NZTM) in its 2020 general electorate,
     its 2025 general electorate and its 2025 Māori electorate.
  2. "Located" votes: votes cast by electorate E's voters at a place that lies inside
     E's own area. They go to the 2025 electorate containing that place.
     General: inside E's 2020 boundary. Māori (no 2020 Māori shapes on hand):
     election-day places only, since election-day voting outside your own
     electorate is a special vote, plus advance places in the same-named 2025 seat.
  3. Everything else (specials, overseas, out-of-area advance votes, places without
     coordinates, places with <6 votes) is shared across E's 2025 pieces in the
     same proportions as that party's / candidate's located votes.
  4. Port Waikato's 2023 electorate poll was cancelled (by-election). Its candidate
     vote is imputed from its party vote with the national split-vote matrix.
  Party totals are conserved exactly (up to float rounding); checked at the end.
"""
import csv, io, json, os, re, sys
from collections import defaultdict
import shapefile
from shapely.geometry import shape, Point
from shapely.strtree import STRtree

BI, OUT = sys.argv[1], sys.argv[2]
S25 = os.path.join(BI, 'raw/statsnz/2025boundaries/statsnz-new-zealand-2layers-SHP (1)')

def read(path):
    return list(csv.reader(io.StringIO(open(path, encoding='utf-8-sig').read())))

def full(n): return re.sub(r'^Mt ', 'Mount ', n.strip())

def load_shapes(path, name_field):
    r = shapefile.Reader(path)
    fields = [f[0] for f in r.fields[1:]]
    ni = fields.index(name_field)
    names, geoms = [], []
    for sr in r.iterShapeRecords():
        names.append(full(sr.record[ni])); geoms.append(shape(sr.shape.__geo_interface__).buffer(0))
    return names, geoms, STRtree(geoms)

def locate(pt, shapes):
    names, geoms, tree = shapes
    for i in tree.query(pt):
        if geoms[i].contains(pt): return names[i]
    # coastal / wharf places can sit just offshore: take the nearest within 2 km
    i = tree.nearest(pt)
    return names[i] if geoms[i].distance(pt) < 2000 else None

G20 = load_shapes(os.path.join(BI, 'raw/statsnz/general-electorates-2020'), 'GED2020__1')
G25 = load_shapes(os.path.join(S25, 'general-electorates-2025/general-electorates-2025'), 'GED2025__1')
M25 = load_shapes(os.path.join(S25, 'maori-electorates-2025/maori-electorates-2025'), 'MED2025__1')

nztm = {}
for row in read(os.path.join(BI, 'raw/voting-place-coordinates.csv'))[1:]:
    nztm[int(row[2])] = (float(row[8]), float(row[9]))

B = json.load(open(os.path.join(BI, 'build/booths.json'), encoding='utf-8'))
PARTIES = B['parties']
place_loc = []
miss = 0
for p in B['places']:
    xy = nztm.get(p['id'])
    if not xy: place_loc.append(None); miss += 1; continue
    pt = Point(*xy)
    place_loc.append({'g20': locate(pt, G20), 'g25': locate(pt, G25), 'm25': locate(pt, M25)})
print('places', len(B['places']), 'without NZTM', miss)

# party label normalisation (2023 file names -> short keys used by the app)
PK = {'National Party': 'NAT', 'Labour Party': 'LAB', 'Green Party': 'GRN', 'ACT New Zealand': 'ACT',
      'New Zealand First Party': 'NZF', 'Te Pāti Māori': 'TPM', 'The Opportunities Party (TOP)': 'TOP'}
def pkey(name): return PK.get(name.strip(), 'OTH')

# national split-vote matrix: party-vote party -> share of its voters backing each candidate party
sv = read(os.path.join(BI, 'evenmore/csv-splitvote/split-votes-all.csv'))
sv_cols = [c.strip() for c in sv[0][2:]]
SPLIT_RAW = defaultdict(lambda: defaultdict(float))   # weighted by each party's vote, so minor parties pool into OTH
for r in sv[1:]:
    if len(r) < 3 or not r[0].strip(): continue
    n = float(r[1].replace(',', '') or 0)
    for c, x in zip(sv_cols, r[2:]):
        if not x.strip() or c.startswith('Total') or c.startswith('Candidate Vote Only') or c.startswith('Party Vote Only') or 'Informal' in c: continue
        SPLIT_RAW[pkey(r[0])][pkey(c)] += n * float(x) / 100
SPLIT = {}
for k, row in SPLIT_RAW.items():
    s = sum(row.values()) or 1
    SPLIT[k] = {kk: v / s for kk, v in row.items()}

def add(d, k, v):
    d[k] = d.get(k, 0.0) + v

new_party = defaultdict(dict)   # new electorate -> party key -> votes
new_cand = defaultdict(dict)    # new electorate -> candidate party key -> votes
compo = defaultdict(dict)       # new electorate -> old electorate -> party votes contributed
old_totals = {}
checks = []

for e in B['electorates']:
    name, maori = full(e['name']), e['maori']
    cparty = [pkey(c['party']) if c['party'] != 'Independent' else 'IND' for c in e['cands']]
    loc_p = defaultdict(lambda: [0.0] * len(PARTIES))   # new seat -> party vector
    loc_c = defaultdict(lambda: [0.0] * len(cparty))
    rest_p = [0.0] * len(PARTIES); rest_c = [0.0] * len(cparty)
    for r in e['rows']:
        target = None
        if r['k'] in ('A', 'E') and r['p'] >= 0 and place_loc[r['p']]:
            L = place_loc[r['p']]
            if not maori and L['g20'] == name: target = L['g25']
            if maori and L['m25'] and (r['k'] == 'E' or L['m25'] == name): target = L['m25']
        if target:
            for j, v in enumerate(r['pv']): loc_p[target][j] += v
            if r.get('cv'):
                for j, v in enumerate(r['cv']): loc_c[target][j] += v
        else:
            for j, v in enumerate(r['pv']): rest_p[j] += v
            if r.get('cv'):
                for j, v in enumerate(r['cv']): rest_c[j] += v
    seats = list(loc_p)
    tot_loc = {s: sum(loc_p[s]) for s in seats}; T = sum(tot_loc.values())
    def share(vecs, j, s):
        col = sum(vecs[x][j] for x in seats)
        return vecs[s][j] / col if col else tot_loc[s] / T
    pv_out = {s: [loc_p[s][j] + rest_p[j] * share(loc_p, j, s) for j in range(len(PARTIES))] for s in seats}
    if e['cancelled']:
        # impute candidate vote from party vote with the national split matrix
        cv_out = {}
        for s in seats:
            d = {}
            for j, v in enumerate(pv_out[s]):
                for k, w in SPLIT.get(pkey(PARTIES[j]), SPLIT['OTH']).items(): add(d, k, v * w)
            cv_out[s] = d
    else:
        cv_out = {}
        for s in seats:
            d = {}
            for j in range(len(cparty)):
                add(d, cparty[j], loc_c[s][j] + rest_c[j] * share(loc_c, j, s) if any(loc_c[x][j] for x in seats) else rest_c[j] * tot_loc[s] / T)
            cv_out[s] = d
    for s in seats:
        for j, v in enumerate(pv_out[s]): add(new_party[s], pkey(PARTIES[j]), v)
        for k, v in cv_out[s].items(): add(new_cand[s], k, v)
        compo[s][name] = sum(pv_out[s])
    tot = [sum(r['pv'][j] for r in e['rows']) for j in range(len(PARTIES))]
    old_totals[name] = sum(tot)
    checks.append((name, sum(tot), sum(sum(v) for v in pv_out.values())))

bad = [c for c in checks if abs(c[1] - c[2]) > 0.5]
print('conservation failures', bad)
nat = defaultdict(float)
for s in new_party:
    for k, v in new_party[s].items(): nat[k] += v
grand = sum(nat.values())
print('national party %', {k: round(v / grand * 100, 2) for k, v in sorted(nat.items(), key=lambda x: -x[1])})

def pct(d):
    t = sum(d.values()) or 1
    return {k: round(v / t * 100, 2) for k, v in sorted(d.items(), key=lambda x: -x[1]) if v / t >= 0.0005}

seats = []
for s in sorted(new_party, key=lambda x: (x in M25[0], x)):
    c = pct(new_cand[s]); top = list(c.items())
    tp = sum(compo[s].values())
    seats.append({'name': s, 'maori': s in M25[0],
                  'party': pct(new_party[s]), 'cand': c,
                  'winner': top[0][0], 'second': top[1][0], 'margin': round(top[0][1] - top[1][1], 2),
                  'votes': round(sum(new_party[s].values())),
                  'from': {k: round(v / tp, 3) for k, v in sorted(compo[s].items(), key=lambda x: -x[1]) if v / tp >= 0.005}})
print('seats', len(seats), 'general', sum(not x['maori'] for x in seats))
json.dump({'source': '2023 official voting-place results (Electoral Commission) re-aggregated onto 2025 Stats NZ electorate boundaries. Notional estimate.',
           'parties': ['NAT', 'LAB', 'GRN', 'ACT', 'NZF', 'TPM', 'TOP', 'OTH'],
           'split2023': {k: {kk: round(vv, 4) for kk, vv in v.items()} for k, v in SPLIT.items()},
           'seats': seats}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('wrote', OUT)
