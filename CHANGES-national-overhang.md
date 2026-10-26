# National overhang: Electorates panel

## Current behaviour

The Electorates panel models National's general-electorate count alongside the seven Māori winners. National's general plus Māori wins are compared with its proportional entitlement; any excess creates overhang and increases the House and majority target. Independent Māori winners retain the existing reservation behaviour.

Fresh scenarios start at 44 National general wins. This is a **notional 2023 result on 2025 boundaries**, verified against `data/notional2023.json` (NAT 44, LAB 15, GRN 3, ACT 2), not a forecast of current wins. The card explains this assumption and distinguishes general wins from combined general/Māori wins.

Only National's general electorates can be set. Other parties' general-seat threshold exemptions and overhang are excluded; this limitation is now stated in the panel. Their wins cannot safely be assumed to always fit inside their party-vote entitlement.

The bar scales to the largest of 64, National's wins and its proportional entitlement. Stepper and typed values are constrained to 0–64; decimals truncate. Full numeric notation is accepted (`1e2` clamps to 64), while junk suffixes and nonfinite input become 0. The input normalizes on change/blur. The card announces changes through a polite live region.

## Scenario reproducibility

- Fresh sessions start at 44.
- Saved scenarios without `natElect` retain the previous assumption of zero National general wins.
- Explicit saved counts are preserved and normalized.
- New share links always carry `ne`, including `ne=44` and `ne=0`.
- Legacy links without `ne` load zero. Invalid `ne` also normalizes to zero.
- Missing link winners and swing-side settings reset deterministically rather than inheriting the recipient's prior choices.
- Top presets reset National to 44 and clear swing/custom swing sides. Clear empties votes, retains electorate assumptions and clears swing.
- “As 2023” and the top historical preset use identical Māori winners. “Defaults” restores the scenario assumptions separately.

Links produced by the interim implementation without `ne` cannot identify whether 44 or zero was intended. They follow legacy zero-count semantics and should be re-shared after choosing the intended count. Already-saved explicit 44 counts remain 44.

For the default Verian scenario, 44 National general wins produce a 134-seat House: National +10 and TPM +4. With National at or below entitlement, the same votes and Māori winners produce 124 seats.

## Incomplete scenarios

When no positive-vote party qualifies and proportional seats remain, the engine reports an incomplete allocation with an unallocated count and unknown House size, majority and overhang. The page clears stale diagrams/tables and suppresses coalition claims, while retaining editable controls. Entering eligible votes restores the result. Clear no longer presents a misleading 170-seat House.

## Related review fixes

Poll pasting now preserves signed numbers and leading decimal points, supports multiple value-first pairs, reports unknown table categories, and blocks Apply for invalid/ambiguous values (including `<5`, approximations and ranges). The keyboard shortcut applies the same validation. Existing swing is explicitly disclosed when pasting. Historical presets clear it.

See `REVIEW-recent-edits.md` for the original findings, resolutions and verification limits.

## Validation

```sh
node tests/mmp-allocation.test.cjs
node tests/electorates.test.cjs
node --test tests/recent-edits-audit.test.cjs tests/page-runtime.test.cjs
```

16 main regression groups, 8 electorate groups, 24 audit tests and 5 full-script runtime tests pass. This includes 200 swing-conservation cases, 500 allocation scenarios checked against independent quotient ranking, and share-link round trips. All prior audit TODOs are now ordinary passing tests.

The runtime tests use DOM/event/storage test doubles. Browser visual, native focus, clipboard and live network behaviour have not been independently verified in this session; the browser tool rejected the local file URL.
