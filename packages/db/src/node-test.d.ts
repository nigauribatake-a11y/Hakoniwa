declare module "node:assert/strict" {
  interface Assert {
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
  }

  const assert: Assert;
  export default assert;
}

declare module "node:test" {
  export function test(name: string, fn: () => void | Promise<void>): void;
}

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number;
  stdout: {
    write(text: string): void;
  };
  stderr: {
    write(text: string): void;
  };
};
