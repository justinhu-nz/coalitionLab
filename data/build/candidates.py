"""2026 electorate candidates from a Wikipedia wikitext snapshot.

Usage: python3 data/build/candidates.py data/raw/wikipedia-candidates-2026.wiki data/candidates2026.json
Source: https://en.wikipedia.org/wiki/Candidates_in_the_2026_New_Zealand_general_election_by_electorate (CC BY-SA)
"""
import json, re, sys

src, out = sys.argv[1], sys.argv[2]
t = open(src, encoding='utf-8').read()

PK = {'New Zealand National Party': 'NAT', 'New Zealand Labour Party': 'LAB', 'Green Party of Aotearoa New Zealand': 'GRN',
      'ACT New Zealand': 'ACT', 'New Zealand First': 'NZF', 'Te Pāti Māori': 'TPM', 'The Opportunity Party': 'TOP',
      'Opportunity Party (New Zealand)': 'TOP', 'Te Tai Tokerau Party': 'TTT', 'Independent politician': 'IND'}

def clean(v):
    v = re.sub(r'<ref[^>]*/>|<ref.*?</ref>', '', v, flags=re.S)
    v = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', v)
    return re.sub(r'\s+', ' ', v).strip()

def fields(blk):
    f = {}
    for k, v in re.findall(r'\|\s*(party|candidate|notes|list)[ \t]*=[ \t]*([^\n]*)', blk):
        f[k] = clean(v)
    return f

seats, dropped = {}, []
secs = re.split(r'\n===([^=\n]+)===\n', t)
for i in range(1, len(secs), 2):
    name, body = secs[i].strip(), secs[i + 1]
    cands, retiring = [], []
    for kind, blk in re.findall(r'\{\{NZ election box (candidate list|minor party candidate|candidate|incumbent|independent|retired)[ \t]*\|?(.*?)\n\}\}', body, re.S):
        f = fields(blk)
        party = 'Independent politician' if kind == 'independent' else f.get('party', '')
        key = PK.get(party.strip(), 'OTH')
        c = {'name': f.get('candidate', ''), 'party': key}
        if key == 'OTH': c['label'] = party.strip()
        if kind == 'retired':
            retiring.append(c); continue
        if re.search(r'not on (the )?final list|withdr', f.get('notes', ''), re.I):
            dropped.append((name, c['name'])); continue
        if kind == 'incumbent': c['incumbent'] = True
        if kind == 'candidate list': c['listMP'] = True
        if f.get('list', '').strip().isdigit(): c['rank'] = int(f['list'])
        if f.get('notes'): c['notes'] = f['notes']
        cands.append(c)
    seats[name] = {'candidates': cands, 'retiring': retiring}

json.dump({'source': 'Wikipedia: Candidates in the 2026 New Zealand general election by electorate (snapshot 13 Oct 2026, CC BY-SA)',
           'seats': seats}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('seats', len(seats), 'candidates', sum(len(s['candidates']) for s in seats.values()), 'dropped', dropped)
for party in ['NAT', 'LAB', 'GRN', 'ACT', 'NZF', 'TPM', 'TOP']:
    missing = [n for n, s in seats.items() if not any(c['party'] == party for c in s['candidates'])]
    print(party, 'standing in', len(seats) - len(missing), '' if len(missing) > 20 else 'missing: ' + ', '.join(missing))
print('incumbents', sum(1 for s in seats.values() for c in s['candidates'] if c.get('incumbent')),
      'retiring', [(n, r['party'], r['name']) for n, s in seats.items() for r in s['retiring']])
