declare module "node:assert/strict" {
  interface Assert {
    equal(actual: unknown, expected: unknown, message?: string): void;
    match(actual: string, expected: RegExp, message?: string): void;
  }

  const assert: Assert;
  export default assert;
}

declare module "node:test" {
  export function test(name: string, fn: () => void): void;
}
