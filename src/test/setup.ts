import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

/**
 * jsdom does not implement object URLs; asset tests need a real-looking,
 * per-call-unique URL so component rendering can be asserted (spec §19).
 */
beforeAll(() => {
  if (typeof URL.createObjectURL !== "function") {
    let counter = 0;
    URL.createObjectURL = () => {
      counter += 1;
      return `blob:frame-test/${counter}`;
    };
    URL.revokeObjectURL = () => undefined;
  }
});

afterEach(() => {
  cleanup();
});
