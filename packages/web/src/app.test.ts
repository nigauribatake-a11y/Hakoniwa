import assert from "node:assert/strict";
import { test } from "node:test";

test("web package builds test artifacts", () => {
  assert.equal(typeof URL, "function");
});
