# makefun-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/fauzandaulay89-cloud/makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/fauzandaulay89-cloud/makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar: 226 pre-token protocols ranked by implied launch value from a sealed DefiLlama snapshot, each with a six-step farm plan. Model radar-2 prices a protocol as TVL × its category's own market multiple (the median mcap/TVL of that category's live-token protocols in the snapshot) × growth × maturity × breadth — no protocol name is ever special-cased. The board covers the snapshot's whole 40-protocol watchlist plus 186 early finds below the $50M floor; protocols whose token already trades are kept apart in an "Already trading" view at the market's own value.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
```

Node 22.18+ required, standard library only, no network. `main.ts` reads the snapshot, writes `out/board.json` (226 rows), `out/data.js`, copies `dashboard/` and `screenshots/` into `out/`, and writes `out/dossier.json`. Run it twice: both runs write the same bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=fxram5cz&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
