import { afterEach, expect, it, vi } from "vitest";
import { cheminApkAndroid, estInstallee } from "./pwa";

afterEach(() => vi.restoreAllMocks());

it.each([
  ["Android", true, "/telechargements/tantana.apk"],
  ["Windows NT 10.0", true, "/telechargements/tantana.apk"],
  ["iPhone", true, null],
  ["Android", false, null],
])("choisit le téléchargement pour %s, marque Tantana %s", (agent, tantana, chemin) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(String(agent));
  expect(cheminApkAndroid(tantana === true)).toBe(chemin);
});

it.each(["TantanaAndroid/2", "TantanaAndroidEssai/2"])("reconnaît l’APK %s", (agent) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Android " + agent);
  expect(estInstallee()).toBe(true);
});
