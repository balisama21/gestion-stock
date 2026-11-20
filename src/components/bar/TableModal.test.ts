import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/supabase", () => ({ supabase: {} }));

import { numeroSuivant } from "./TableModal";
import type { TableBar } from "../../lib/bar";

const t = (numero: string, active = true): TableBar => ({
  id: numero,
  store_id: "s",
  zone_id: "z",
  numero,
  places: null,
  droit_table: null,
  active,
  ordre: 0,
});

describe("le numéro proposé pour une nouvelle table", () => {
  it("suit les tables en service, pas les anciennes mises de côté", () => {
    const tables = [t("9", false), t("10", false), t("Table1"), t("Table5")];
    expect(numeroSuivant(tables, tables)).toBe("Table6");
  });

  it("saute un numéro déjà pris", () => {
    const tables = [t("V1"), t("V2"), t("V3", false)];
    expect(numeroSuivant(tables, tables.slice(0, 2))).toBe("V4");
  });
});
