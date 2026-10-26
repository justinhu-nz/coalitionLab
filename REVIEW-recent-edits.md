# Recent-edit review — 27 October 2026

## Fix status — completed 27 October 2026

The findings below preserve the original audit evidence; their failure descriptions and line numbers refer to the pre-fix snapshot. R1–R9 have now been addressed:

| Finding | Resolution |
|---|---|
| R1–R3: pasted signs, decimals, bounds and orientation | Whole numeric tokens preserve signs/decimals; value-first pairs work; bounds, approximations, ranges and out-of-range values block Apply, including the keyboard shortcut. Unknown table categories appear in the preview. |
| R4/R8: legacy scenarios | Missing National count means 0 for existing saved scenarios/links. Fresh sessions still start at 44. New links always write `ne`, including 44. Explicit counts survive saving/loading. |
| R5: historical winners | “As 2023” uses the same six-TPM/one-Labour winners as the historical benchmark. A separate “Defaults” preset preserves the scenario assumptions. |
| R6: lingering swing | Historical, poll and Clear presets reset swing and custom swing sides. Paste preserves swing and explicitly discloses it in the preview. |
| R7: incomplete allocation | Results carry `incomplete`, `unallocated`, and null House/majority/overhang when no positive-vote party qualifies and proportional seats remain. The UI clears stale results and suppresses coalition verdicts. Entering eligible votes restores the full display. |
| R9: moved test page | Test runner and rebuild instructions use the archived electorate page path. |

Additional fixes: National counts use full-string numeric conversion consistently in typed input, saved state and links (`1e2` clamps to 64; `12junk` becomes 0). Missing winners/swing-side settings in links reset deterministically instead of inheriting the viewer's previous scenario. The National card distinguishes general and Māori wins, labels 44 as a notional assumption rather than a forecast, and discloses the exclusion of other parties' general-seat exemptions/overhang. Paste remainder messaging explicitly includes skipped categories.

All former TODOs are now ordinary passing regression tests. `AUDIT_STRICT` is no longer needed. The incomplete-result test was updated to assert the explicit unknown/unallocated state rather than forcing House size to equal a partial seat total.

Validation after fixes:

- Main suite: 16 groups pass, including 200 swing-conservation cases.
- Electorate suite: 8 groups pass.
- Audit suite: 24 tests pass, including 500 independently checked allocation scenarios and 9 share round trips; zero TODOs.
- Full-script runtime suite: 5 tests pass for initial rendering, Clear/recovery, historical benchmark, National input/blur/stepper/storage, legacy storage, paste submission and vote arc transitions. Uses DOM/event/storage test doubles, not a browser.

Run `node tests/mmp-allocation.test.cjs`, `node tests/electorates.test.cjs`, and `node --test tests/recent-edits-audit.test.cjs tests/page-runtime.test.cjs`.

Remaining limits: actual browser layout/focus/clipboard/network behaviour is unverified. Only National's general electorates are modelled; the limitation is now explicit in the UI. Political/candidate claims have not been externally fact-checked. Already-issued links from the interim implementation that omitted a default `ne=44` cannot be distinguished from older zero-count links; they now follow the legacy zero-count interpretation and should be re-shared with an explicit count. Saved states that already contain 44 retain it.

## Original review: scope and outcome

Reviewed the working-tree National-electorate changes and `CHANGES-national-overhang.md`, today's `2e340e4` poll-paste commit, and the preceding 20 October changes (`4f4d1a3`, `1a56b86`, `bdb7aae`, `30ed566`) covering row ordering, N/A electorate winners, coalition suggestions and share links. The comparison base was `a0d96b2`. Git attributes these commits to the repository owner, not Claude; author attribution to Claude cannot be independently confirmed. Archived prototypes were not exhaustively reviewed; the electorate engine's existing suite was run.

**The core National-overhang calculation passed the tested valid scenarios, but the review found reproducible input and scenario-reproducibility defects.** Existing tests alone do not establish that the UI or migration is correct.

Changes made by this review:

- Added `tests/recent-edits-audit.test.cjs`, exercising actual functions extracted from `index.html`, with lightweight DOM/storage stubs for selected handlers.
- Fixed `tests/electorates.test.cjs` to read its moved page under `ignore me/`; it also accepts an explicit input path.
- Corrected the moved-page path in `data/README.md`.
- Added this report. No application code or pre-existing uncommitted edits were changed.

## Findings, ordered by impact

### R1 — P1: pasted signs and leading decimal points are lost

**Location:** `index.html:365–369`; introduced in `2e340e4`.

Reproduce with `Labour -5, National 30` (also Unicode minus `−5`): `parsePoll()` returns Labour **+5**, with no invalid-value warning. `Labour .5%, National 30` likewise returns Labour **5**, not 0.5. The numeric regex starts at the digit, leaving the sign or decimal point in the preceding party-name segment; name normalization then removes it. The negative-value check in `take()` never sees a negative number.

Impact: silently changes votes, potentially moving a party across the threshold, before Apply clears omitted parties and fills Others.

Recommendation: tokenize the entire numeric expression, preserve leading decimals, and reject negative votes explicitly. Distinguish punctuation used as a name/value separator from a signed number. Tests R1a/R1b reproduce both failures.

### R2 — P1: `<5%` becomes exactly 5% and qualifies

**Location:** `index.html:352`, `362`, `365–369`; introduced in `2e340e4`.

`TOP <5%, Labour 50, National 45` produces TOP = 5. The same happens in a tabular paste (`TOP\tLAB\tNAT` followed by `<5%\t50\t45`). Both regexes accept `<` but discard its meaning.

Impact: an explicitly below-threshold party can receive proportional seats. Approximation marks `~` and `≈` are also discarded without an uncertainty note.

Recommendation: reject bounded values with an actionable warning or retain the bound for explicit user resolution. Do not silently choose the boundary or subtract an arbitrary epsilon. R2 is the executable reproduction.

### R4 / R8 — P1: legacy links and saved scenarios silently change the result

**Location:** `index.html:237` (`loadState`), `427` and `436` (share writer/reader); introduced by uncommitted National changes.

A scenario from the previous version has no `natElect` / `ne`, because National's general electorates were not modelled. The new reader defaults absence to 44. Replaying the stored Verian votes and the same Māori winners gives:

| Result | Previous scenario | New load |
|---|---:|---:|
| National seats | 34 | 44 |
| House | 124 | 134 |
| Majority target | 63 | 68 |
| National + ACT + NZ First | 59 | 69 |
| Coalition has majority | No | Yes |

This affects both shared URLs and existing localStorage. The change log explicitly chooses this behaviour, so it is an intentional migration decision with a serious reproducibility consequence, not an arithmetic error. The UI does not disclose the changed assumption when loading it.

Recommendation: distinguish fresh sessions from legacy scenarios. Version links/state, write `ne=44` explicitly for new default scenarios, and interpret legacy absence as 0, or present an explicit migration notice and retain an original-result option. Because new default links already omit `ne`, they are indistinguishable from legacy links without a version marker. R4/R8 reproduce the two routes.

### R3 — P2: multiple value-first pairs shift percentages onto the wrong party

**Location:** `index.html:367–369`; introduced in `2e340e4`.

`30% National, 29% Labour` produces **National 29**, omitting Labour. The reverse-order path only works when the entire line has one number. With multiple numbers the parser reverts to treating text before the next number as its party.

Impact: a seemingly recognized paste corrupts the poll; default Apply also clears Labour and fills Others. Recommendation: parse individual delimited pairs in either direction, or reject mixed/unsupported orientation instead of assigning an adjacent percentage. R3 reproduces this.

### R5 — P2: “As 2023” and “2023 election” select different winners

**Location:** `index.html:190`, `339`.

The Māori “As 2023” preset uses `DEFAULT_WINNERS`: Te Tai Tokerau Party in Te Tai Tokerau and N/A in Te Tai Tonga. The top “2023 election” preset sets both to TPM. This is verified against the app's own historical benchmark, without relying on present-day candidate claims.

Impact: selecting the lower preset after the top one changes the historical scenario and its seats despite both labels saying 2023. The underlying mismatch predates today's edits; the uncommitted label change retains it.

Recommendation: label the lower option “Default assumptions” or supply the same historical winners as the top preset. R5 reproduces the mismatch.

### R6 — P2: the historical preset keeps an earlier swing

**Location:** `index.html:339` and `313` (`swungVotes`); pre-existing behaviour in the touched preset handler.

Set swing to +10, then select “2023 election.” The handler resets votes, winners, threshold and National electorates but retains `st.swing`. The resulting House is **123**, not the suite's 122-seat historical benchmark. Custom swing sides are retained too. Poll pasting likewise retains swing, which may be intentional for scenario exploration but needs clear interpretation.

Recommendation: reset swing for historical benchmark presets, or clearly state that the preset is being modified. R6 invokes the actual click handler with DOM/render stubs and reproduces the discrepancy.

### R7 — P2: empty votes still produce a seemingly complete House

**Location:** `index.html:220–222`, `258–262`, `339`; existing allocation edge case amplified by the new 44-seat default.

Clear empties party votes but keeps electorate assumptions. With default winners and National = 44, `compute()` reports **House 170**, while party totals sum to only **50**. With no eligible positive party votes, the allocator distributes none of the nominal 120 seats; `allocationResult()` still adds the nominal base to electorate overhang. The new National card hides its numerical text behind “Enter National’s party vote,” but the global House, majority, overhang and coalition displays still use that result.

The same class occurs when no positive-vote party qualifies (for example, coat-tail disabled and all shares below the chosen threshold). This is not evidence that valid-input allocation fails.

Recommendation: expose an incomplete/unallocated result and suppress conclusive coalition claims until votes can support allocation. Simply forcing House to the sum of current parties is not necessarily the right model. R7 asserts the absent conservation property as a diagnostic; implementation should ultimately test the explicit incomplete-state behaviour.

### R9 — P2, fixed in test infrastructure: electorate suite could not start

**Location:** `tests/electorates.test.cjs:4`; introduced by the `4f4d1a3` file move.

`node tests/electorates.test.cjs` failed with ENOENT because it read root `electorates.html`. The page is now `ignore me/electorates.html`. Updated the path and data rebuild instructions. All eight existing electorate groups now pass. No engine changes were needed.

## Additional edge cases and modelling limitations

These are separate from the high-confidence reproductions above; they are not all release blockers.

- **Other general-electorate parties remain unmodelled.** The change log's statement that ACT/Labour/Green wins “would sit inside their entitlement anyway” is not generally true for arbitrary inputs. For instance, ACT below 5% with two electorate wins would have an electorate route under this app's coat-tail setting, but the main page cannot enter those general wins. Treat the feature as National-only and disclose that scope.
- **44 is a notional assumption, not a live forecast.** Local `data/notional2023.json` does reproduce NAT 44, LAB 15, GRN 3, ACT 2 across 64 general seats. Its own source labels the figures a notional estimate on changed boundaries. Applying this count to a poll is a scenario choice; current electorate holdings/candidate claims were not independently fact-checked here.
- **General plus Māori counts:** National = 64 plus seven Māori winners yields 71 electorate seats. Allocation and bar bounds pass; the National card's “Wins” is the combined number, while the editable count is general-only. Make the distinction explicit if users find the two numbers confusing.
- **Numeric input notation:** `parseInt` truncates decimals and accepts numeric prefixes: e.g. `ne=12junk` becomes 12; `1e2` becomes 1 rather than 100. Blank/invalid typed input becomes 0, but invalid linked input becomes 44. Conventional negatives and over-limit values clamp correctly. Align accepted formats across UI, links and storage.
- **Range pastes:** `National 30-32%, Labour 29` silently uses National 30. This is another unsupported ambiguity that should be surfaced instead of interpreted as an exact value.
- **Unknown table columns:** unlike the pairs path, table parsing only calls `take()` for recognized headings; unknown columns are not included in `skipped`. A table with undecided/unknown categories can therefore hide omissions. Remainder-to-Others is an explicit UI assumption, not necessarily an equivalent poll denominator.
- **Fresh-session coverage gap:** the existing `state()` fixture in `mmp-allocation.test.cjs` omits `natElect`, so most original tests still run with zero National general seats, unlike the UI default of 44. The new audit covers real `loadState()` defaults separately.
- **Tiny Houses:** one nominal seat with more independent winners is supported by existing tests. The new randomized audit also checks small Houses, National overhang and combined electorate wins.
- **Tie outcomes:** existing tests cover independent reservation, overhang-changing ties and coalition verdict differences. The randomized audit checks any generated tie outcomes for seat conservation; it is not an exhaustive enumeration of all tie configurations.
- **Markup safety:** generated paste previews escape the tested injected HTML. This is a focused check, not a comprehensive security audit.
- **Presentation checks still needed:** actual focus behaviour during National input normalization, keyboard/drag row ordering, screen-reader announcements, reduced motion, mobile overflow and light/dark layouts. Pure DOM stubs and markup checks cannot validate those behaviours.

## Tests and how to reproduce

Run from the repository root with Node (review used v24.11.0):

```sh
node tests/mmp-allocation.test.cjs
node tests/electorates.test.cjs
node --test --test-reporter=tap tests/recent-edits-audit.test.cjs
AUDIT_STRICT=1 node --test --test-reporter=tap tests/recent-edits-audit.test.cjs
```

| Check | Observed result |
|---|---|
| Existing main-page suite | 16 groups pass, including 200 swing-conservation scenarios |
| Existing electorate suite after path correction | 8 groups pass, including its simulation checks |
| New audit: supported behaviours | 8 tests pass, including 500 seeded allocation scenarios and 9 share round trips |
| New audit: open defects | 9 failing assertions marked TODO across R1–R8 |
| Strict audit | 8 pass, **9 fail**, exit status 1 |

TODO tests execute their assertions; they are not skipped. Default mode exits successfully because the failures are explicitly documented known defects. **That is not a clean bill of health.** Strict mode removes TODO status and makes the open defects fail the run normally. Each fixture creates a fresh VM/storage context. The allocation oracle independently ranks every available odd-divisor quotient rather than reusing `allocate()`.

The new tests cover clamping, threshold exemption on/off, zero National votes, combined Māori/general wins, small Houses, independent seats, overhang, normalization, new share links, legacy links/state, paste application modes, remainder calculation, escaping, sanitized row ordering and finite bar markup.

## Verification boundaries

The browser tool rejected opening the local `file://` page because its URL policy only permits HTTP(S). No browser workaround was attempted. Consequently this review does **not** certify visual layout, real browser event/focus behaviour, clipboard access, localStorage permissions or live poll-fetch/network behaviour. The change log's earlier browser-check claims were not independently reproduced.

Political/candidate statements and live polling were not the subject of external fact-checking; only consistency with local fixtures/data was checked. All inputs and state combinations cannot be exhaustively tested. This report separates observed failures from further edge cases and unverified behaviour.
