import type { Purchase } from "../../../types";

/**
 * Les produits achetés à un fournisseur, d'après les achats : rattachés à
 * sa fiche, ou à défaut saisis sous son nom. Trois au plus, du plus
 * récent au plus ancien, sans doublon.
 */
export function produitsAchetesA(
  f: { id: string; nom: string },
  achats: readonly Pick<Purchase, "supplierId" | "fournisseur" | "designation" | "date">[],
): string {
  const nom = f.nom.trim().toLowerCase();
  const vus = new Set<string>();
  const noms: string[] = [];
  for (const a of [...achats].sort((x, y) => (x.date < y.date ? 1 : -1))) {
    const lie = a.supplierId
      ? a.supplierId === f.id
      : (a.fournisseur ?? "").trim().toLowerCase() === nom && nom !== "";
    const designation = a.designation?.trim();
    if (!lie || !designation || vus.has(designation.toLowerCase())) continue;
    vus.add(designation.toLowerCase());
    noms.push(designation);
  }
  if (noms.length <= 3) return noms.join(", ");
  return `${noms.slice(0, 3).join(", ")} +${noms.length - 3}`;
}
