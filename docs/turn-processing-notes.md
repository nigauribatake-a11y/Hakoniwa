# Turn Processing Notes

This document captures the first pass of the Hakoniwa R.A. turn-processing
spec for a modern reimplementation. The goal is not bit-for-bit compatibility.
Use the Perl version as a reference implementation, then keep the new rules
small, explicit, and testable.

## Source Files

- `archive/hako-r-a_FE/hako-main.cgi`
  - Global constants and data loading/writing.
  - Command and terrain numeric IDs.
- `archive/hako-r-a_FE/hako-turn.cgi`
  - Island creation.
  - Turn advancement.
  - Command execution.
  - Per-hex and per-island updates.
- `archive/hako-r-a_FE/hako-map.cgi`
  - Command queue editing and UI helpers.

Important source anchors:

- `hako-turn.cgi:693` `turnMain`
- `hako-turn.cgi:1580` `doCommand`
- `hako-turn.cgi:19647` `estimate`
- `hako-main.cgi:145` `HunitTime`
- `hako-main.cgi:178` `HcommandMax`
- `hako-main.cgi:933` command IDs

## MVP Scope

Start with basic Hakoniwa features:

- Island creation
- Hex map display
- Command queue
- Turn advancement
- Funds, food, population, area, score
- Basic land commands
- Basic economic growth
- Basic logs

Defer these R.A. features until the core loop is stable:

- Auction, toto, Hakoniwa Cup, Numbers
- Satellites, magic, space facilities
- Very large monument/special-facility catalog
- Zoo/monster collection systems
- Advanced energy/rail/condense systems
- R.A.-specific owner/status achievements

Candidate R.A. elements to bring back later:

- Richer facility variety than vanilla Hakoniwa
- Quality-of-life auto commands
- Long-term achievements and trophies
- Public history/log flavor
- Some naval/port mechanics if they fit the simplified game

## Existing Turn Order

`turnMain` in `hako-turn.cgi` uses this broad order:

1. Advance last update time by `HunitTime`.
2. Rotate log files.
3. Generate random point array for this turn.
4. Increment global turn.
5. Randomize island processing order.
6. For every island in random order:
   - Recalculate estimates/statistics with `estimate`.
   - Apply income with `income`.
   - Store previous population, funds, and score.
7. For every island in random order:
   - Execute queued commands until `doCommand` returns `1`.
   - Some commands return `0`, allowing multiple commands in one turn.
8. For every island in random order:
   - Run per-hex growth/update with `doEachHex`.
9. For every island in random order:
   - Run island-level processes with `doIslandProcess`.
   - Run unemployment process with `doIslandunemployed`.
10. Run periodic R.A. systems, ranking, prizes, betting, and history.
11. Re-estimate islands, mark dead islands, sort rankings, write data.

For the new implementation, keep the same high-level phases but make them
named functions:

```text
advanceTurnClock
rotateLogs
prepareTurnRandomness
calculatePreTurnStats
applyIncome
executeCommands
updateCells
updateIslands
applyPeriodicEvents
finalizeTurn
```

## Time and Queue Constants

From `hako-main.cgi`:

- `HunitTime = 21600`: one turn is six hours.
- `HmaxIsland = 30`: max islands in the old game.
- `HlogMax = 8`: rotating turn log count.
- `HgiveupTurn = 24`: repeated idle commands eventually trigger give-up.
- `HcommandMax = 40`: command queue length.

For the new implementation:

- Keep six-hour turns configurable.
- Use queue length `40` initially.
- Do not implement automatic give-up until account/auth policy is clear.

## Command Execution Semantics

`doCommand` always pops the first queued command before executing it:

1. Read `command[0]`.
2. Shift the queue forward with `slideFront`.
3. Resolve command kind, target island, x, y, and arg.
4. Read target cell terrain and value.
5. Calculate command cost.
6. If funds/food are insufficient:
   - Log failure.
   - Return `0`, so the next command can be attempted this same turn.
7. Execute command.
8. Deduct cost after successful command unless the command has special rules.
9. Return:
   - `1` means this island is done for the turn.
   - `0` means keep executing more queued commands in the same turn.

Important behavior:

- `DoNothing` gives small random funds and increments absence count.
- Normal commands reset absence count.
- Some repeated/auto commands intentionally return `0`.
- Failed commands often return `0`; this prevents one invalid command from
  consuming the whole turn.

Modern design recommendation:

- Represent `CommandResult` explicitly:

```text
success: boolean
consumeTurn: boolean
logs: TurnLog[]
statePatch: ...
```

This is clearer than Perl's `0`/`1` return value.

## Basic Commands to Implement First

Use a reduced command set before porting R.A. extras:

- Do nothing
- Prepare / leveling
- Reclaim / landfill
- Destroy / excavation
- Sell trees
- Plant forest
- Build farm
- Build factory
- Mine development
- Build missile base later
- Build monument later

Old command IDs from `hako-main.cgi`:

```text
01 HcomPrepare
02 HcomPrepare2
03 HcomReclaim
04 HcomDestroy
05 HcomSellTree
11 HcomPlant
12 HcomFarm
13 HcomFactory
14 HcomMountain
15 HcomBase
18 HcomMonument
31 HcomMissileNM
32 HcomMissilePP
33 HcomMissileST
34 HcomMissileLD
```

The new app should use string enum IDs, not these numeric IDs. Keep numeric
IDs only in an importer/reference layer if needed.

## Terrain Model

Old map cells store two values:

- `land`: terrain kind
- `landValue`: terrain-specific value

Examples:

- Sea uses `landValue = 0/1` to distinguish deep sea/coast.
- Forest uses value as tree amount.
- Town uses value as population-like level.
- Mountain/mines use value for mine state.
- Monster uses value as monster type/HP lookup.

Modern model:

```text
Cell {
  x: number
  y: number
  terrain: TerrainKind
  value: number
}
```

Keep `value` at first. Do not over-normalize every terrain subtype until the
rules are stable.

## Basic Command Details Found So Far

### Prepare / Leveling

Source: `hako-turn.cgi:1755`.

- Invalid on sea, sea bases, sea cities, oil, ice, ships, nursery, gold,
  rotten sea, mountain, sea capital, monsters, and several R.A. water terrains.
- Converts target to plains.
- Resets target value to `0`.
- Deducts funds.
- `Prepare2` increments a counter and returns `0`, so it can chain.
- Normal prepare may discover buried treasure at random.

MVP:

- Allow on waste, town, forest, farm/factory, and most land facilities.
- Convert to plains.
- Add optional buried treasure later.

### Reclaim / Landfill

Source: `hako-turn.cgi:1819`.

- Valid on sea/coast, plains, waste, oil, sea base/city/town, nursery, and
  related water terrains.
- Requires nearby land unless it is a special mode.
- If target is coast sea (`Sea` with value `1`), becomes waste.
- For nearby sea cells, set their value to `1` to mark coast.
- Some R.A. variants can create mountain or waste directly.
- Deducts funds and consumes turn.

MVP:

- Valid only on coast sea.
- Convert to waste.
- Update adjacent sea cells to coast.

### Port / Ship Systems

Source: `hako-turn.cgi:1922` onward.

R.A. has port and ship-related mechanics. Defer these for MVP unless naval
play becomes a core design pillar.

## Open Questions

- Should the new game keep six-hour fixed turns, or allow admin-configurable
  schedules?
- Should invalid commands consume the turn? The old behavior often skips to
  the next command. This is friendly but can surprise players.
- Should R.A.'s cost scaling by score/facilities be kept? It adds depth but
  makes early balancing harder.
- How much randomness should remain in income and events?
- Should disasters be enabled by default in MVP, or introduced after the core
  economy is fun?

## Next Spec Tasks

1. Extract terrain IDs and translate them into a modern `TerrainKind` list.
2. Extract core command costs from `HcomCost`.
3. Spec the MVP economy:
   - income
   - food production
   - population growth
   - forest growth
4. Spec basic disasters:
   - earthquake
   - typhoon
   - tsunami
   - eruption
   - meteor
5. Create TypeScript interfaces for `Island`, `Cell`, `CommandPlan`, and
   `TurnResult`.
