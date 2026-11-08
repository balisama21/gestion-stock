import { afterEach, expect, it, vi } from "vitest";
import { viewportTantana } from "./couleurDeBarre";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  ["Android", true, "", "contain"],
  ["Android", false, "android-app://com.tantanasuite.app/", "contain"],
  ["Android", false, "https://tantana-suite.com/", "cover"],
  ["iPhone", true, "", "cover"],
])("choisit le viewport pour %s, standalone=%s, origine=%s", (ua, standalone, origine, fit) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(String(ua));
  vi.spyOn(document, "referrer", "get").mockReturnValue(String(origine));
  vi.stubGlobal("matchMedia", () => ({ matches: standalone }));
  expect(viewportTantana()).toContain(`viewport-fit=${fit}`);
});
