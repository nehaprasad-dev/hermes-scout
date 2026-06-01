import { describe, it, expect } from "vitest";
// Importing through the "@/" alias confirms path resolution works under Vitest.
import { computeHealth } from "@/lib/scoring";

describe("test tooling", () => {
  it("runs a trivial passing assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves the @/ path alias", () => {
    expect(typeof computeHealth).toBe("function");
  });
});
