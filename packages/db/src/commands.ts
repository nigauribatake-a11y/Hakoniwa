import type { CommandKind } from "../../core/src/index.js";

export const commandKinds = [
  "doNothing",
  "prepare",
  "reclaim",
  "destroy",
  "sellTrees",
  "plant",
  "buildFarm",
  "buildFactory",
  "developMine",
  "buildMissileBase",
  "buildMonument"
] as const satisfies readonly CommandKind[];

export function isCommandKind(value: string): value is CommandKind {
  return (commandKinds as readonly string[]).includes(value);
}
