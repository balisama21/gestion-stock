import type { Product, Purchase } from "../../../types";

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

/**
 * Les produits du catalogue rattachés à un fournisseur : par sa fiche,
 * ou à défaut par le nom saisi sur le produit. Sert quand rien ne lui a
 * encore été acheté — un catalogue importé avec ses fournisseurs les
 * nomme déjà. Les fiches inactives ne comptent pas. Trois au plus, par
 * ordre alphabétique.
 */
export function produitsDuCatalogueDe(
  f: { id: string; nom: string },
  produits: readonly Pick<Product, "supplierId" | "fournisseur" | "displayName" | "statut">[],
): string {
  const nom = f.nom.trim().toLowerCase();
  const noms = [
    ...new Set(
      produits
        .filter((p) => p.statut !== "inactif")
        .filter((p) =>
          p.supplierId
            ? p.supplierId === f.id
            : nom !== "" && (p.fournisseur ?? "").trim().toLowerCase() === nom,
        )
        .map((p) => p.displayName.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  if (noms.length <= 3) return noms.join(", ");
  return `${noms.slice(0, 3).join(", ")} +${noms.length - 3}`;
}
