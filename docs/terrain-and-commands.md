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
| `buildMissileBase` | `HcomBase` | 15 | 300 | Convert plains/waste to missile base; combat deferred. |
| `buildMonument` | `HcomMonument` | 18 | 9999 | Convert plains/waste to monument; `arg` stores monument kind. |

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

The first implementation intentionally simplifies R.A.'s economy. These values
live in `defaultGameRules` and can be replaced per simulation/test:

- Population comes from town cell values.
- Farms produce food based on farm capacity and available workers.
- Factories and mines produce money based on remaining workers.
- People consume food each turn.
- Forests grow by one unit per turn up to a cap.
- Towns can grow while food is non-negative.
- Food shortage reduces town values and then resets food to zero.
- First-pass disasters can damage terrain, using probabilities from
  `GameRules`.

This is not final balancing. It is a small testable loop that lets us build UI
and observe whether the game feels like Hakoniwa.

## Rules Configuration

All balancing values should flow through `GameRules`:

- turn length
- initial resources
- command costs
- support funds
- food production/consumption
- money production
- forest growth
- town growth
- starvation damage
- disaster grace turns
- disaster probabilities
- initial island terrain counts

Keep hardcoded numbers limited to `defaultGameRules`. UI/admin settings can
later persist a customized `GameRules` object and pass it to `advanceTurn`.

Invalid command behavior is a player preference on the island:

- `skip`: old-style behavior; the failed command is logged and the next queued
  command can run in the same turn.
- `consume`: the failed command still ends that island's turn.

## Disaster MVP

The first disaster set is intentionally small, but follows the old engine's
main categories. Disasters are blocked during `disasterGraceTurns`, so new
players can learn the loop before random damage begins.

- Earthquake: one non-sea, non-defence cell becomes waste.
- Fire: one town, forest, or factory becomes waste.
- Tsunami: one coastal land cell becomes waste.
- Typhoon: one farm becomes plains.
- Meteor: one random cell becomes sea.
- Eruption: one random cell becomes mountain; adjacent land becomes waste and
  adjacent deep sea becomes coast.

Monster appearance and richer R.A. disaster variants remain deferred.

## Progression Direction

R.A. features should come back through unlockable progression instead of being
available all at once. The intended direction is:

- Commands unlock through technology-tree or quest-like conditions.
- Unlock conditions can include building counts, facility levels, or milestone
  achievements.
- This should feel closer to a guided Factorio-style onboarding path than a
  giant command list.

Facilities should also allow repeated investment later:

- Rebuilding on farms/factories can increase their level instead of replacing
  them.
- Farm levels can become typhoon durability.
- Factory evolution can branch into higher production, forest-like secondary
  effects, or other R.A.-style specializations.

Phase 1 keeps this as design direction only. The current `Cell.value` field can
hold simple levels/capacity until a richer facility model is needed.
