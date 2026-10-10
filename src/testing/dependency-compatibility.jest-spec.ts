import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

interface CoverageConfiguration {
  all: boolean;
  include: string[];
  exclude: string[];
}

describe("Security override compatibility", () => {
  it("loads coverage YAML through Istanbul with js-yaml 4", () => {
    // Istanbul is Node tooling, not browser code. Keep its worker lifecycle out
    // of Angular's Zone.js while exercising the real YAML loader and override.
    const output = execFileSync(process.execPath, [
      resolve(__dirname, "fixtures/load-nyc-config.cjs"),
      resolve(__dirname, "fixtures/nyc-security.yaml"),
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 10000,
    });
    const config = JSON.parse(output) as CoverageConfiguration;
    expect(config.all).toBe(true);
    expect(config.include).toEqual(["src/app/**/*.ts"]);
    expect(config.exclude).toEqual(["src/**/*.jest-spec.ts"]);
  });
});
