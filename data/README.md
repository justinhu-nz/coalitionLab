# electorateLab data

`ignore me/electorates.html` embeds everything it needs. To rebuild:

    # needs shapely + pyshp; reads 2023 results and boundaries from the booth-inspector repo
    python data/build/notional.py ../booth-inspector data/notional2023.json
    python3 data/build/candidates.py data/raw/wikipedia-candidates-2026.wiki data/candidates2026.json
    python3 data/build/embed.py data/notional2023.json data/candidates2026.json "ignore me/electorates.html"
    node tests/electorates.test.cjs

## Inputs
- **2023 results at each voting place, split-vote report, voting place coordinates**: Electoral Commission, via `booth-inspector/build/booths.json` (run its `build/parse.py` first) and `booth-inspector/raw/`.
- **Boundaries**: Stats NZ General Electorates 2020 (used in 2023) and General and Māori Electorates 2025 (used in 2026), CC BY 4.0.
- **2026 candidates**: Wikipedia snapshot `raw/wikipedia-candidates-2026.wiki` (13 Oct 2026, CC BY-SA). Not the official list. Six seats list two candidates for one party (Banks Peninsula NZF, Kaipara ki Mahurangi LAB, Kapiti GRN, Napier NZF, Northland GRN, Selwyn LAB). Check them against vote.nz.

## Notional 2023 results on the 2025 boundaries
- Votes cast at a place inside the voter's own 2020 electorate go to the 2025 electorate containing that place.
- Māori electorates: no 2020 Māori boundaries are on hand. Instead, election-day places count as being in the voter's own area, plus advance places that fall inside the seat of the same name.
- Everything else (specials, overseas, out-of-area advance votes, places with fewer than 6 votes) is shared across the old seat's new pieces, in proportion to each party's or candidate's located votes.
- Port Waikato's 2023 electorate poll was cancelled, so its candidate vote is estimated from its party vote using the national split-vote matrix.
- Checks: every party's national total matches the official 2023 result, and seats that barely changed reproduce their actual 2023 margins.
