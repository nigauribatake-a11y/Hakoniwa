# Terrain and Command Notes

This file translates the old Perl numeric IDs into modern implementation
concepts. The new engine should use string enums and keep numeric IDs only for
reference/importers.

## MVP Terrain

| Modern kind | Old constant | Old ID | Notes |
| --- | --- | ---: | --- |
| `sea` | `HlandSea` | 0 | `value=0` deep sea, `value=1` coast sea. |
| `waste` | `HlandWaste` | 1 | Rough land / wasteland. |
| `plains` | `HlandPlains` | 2 | Buildable empty land. |
| `town` | `HlandTown` | 3 | `value` stores settlement scale. |
| `forest` | `HlandForest` | 4 | `value` stores tree amount. |
| `farm` | `HlandFarm` | 5 | `value` stores capacity. |
| `factory` | `HlandFactory` | 6 | `value` stores capacity. |
| `missileBase` | `HlandBase` | 7 | Defer combat behavior. |
| `defence` | `HlandDefence` | 8 | Defer defense behavior. |
| `mountain` | `HlandMountain` | 9 | `value` stores mine development. |
| `monster` | `HlandMonster` | 10 | Defer until disasters/combat. |
| `monument` | `HlandMonument` | 13 | Defer catalog, keep terrain slot. |

## R.A. Terrain To Defer

R.A. adds many special terrain types: ports, ships, underwater cities, parks,
food improvements, disaster-prevention cities, gold, checkpoints, resorts,
capitals, warehouses, trains, energy facilities, condensers, zoos, and more.

These should not be added to the domain model until the basic economy is fun.
When reintroduced, prefer feature groups instead of copying all numeric IDs at
once.

## MVP Commands

| Modern kind | Old constant | Old ID | Old cost | MVP behavior |
| --- | --- | ---: | ---: | --- |
| `doNothing` | `HcomDoNothing` | 41 | 0 | Receive small support funds, consume turn. |
| `prepare` | `HcomPrepare` | 1 | 5 | Convert eligible land to plains. |
| `reclaim` | `HcomReclaim` | 3 | 150 | Convert coast sea to waste. |
| `destroy` | `HcomDestroy` | 4 | 200 | Convert land to waste; develop mountain mine. |
| `sellTrees` | `HcomSellTree` | 5 | 0 | Convert forest to plains and receive money. |
| `plant` | `HcomPlant` | 11 | 50 | Convert plains/waste to forest. |
| `buildFarm` | `HcomFarm` | 12 | 20 | Convert plains/waste to farm. |
| `buildFactory` | `HcomFactory` | 13 | 100 | Convert plains/waste to factory. |
| `developMine` | `HcomMountain` | 14 | 300 | Increase mountain mine value. |

## Command Semantics

The old engine shifts the command queue before executing the command. Failed
commands usually do not consume the turn, so the next command can run in the
same turn.

The modern core represents this directly:

```ts
interface CommandResult {
  success: boolean;
  consumeTurn: boolean;
  logs: TurnLog[];
}
```

## Economy MVP

The first implementation intentionally simplifies R.A.'s economy:

- Population comes from town cell values.
- Farms produce food based on farm capacity and available workers.
- Factories and mines produce money based on remaining workers.
- People consume food each turn.
- Forests grow by one unit per turn up to a cap.
- Towns can grow while food is non-negative.

This is not final balancing. It is a small testable loop that lets us build UI
and observe whether the game feels like Hakoniwa.
