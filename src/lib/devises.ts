import type { Database } from "./database.types";

export type Devise = Database["public"]["Tables"]["devises"]["Row"];
export type DeviseBoutique = Database["public"]["Tables"]["devises_boutique"]["Row"];
export type HistoriqueTaux = Database["public"]["Tables"]["historique_taux"]["Row"];

/** Devise principale par défaut quand la boutique n'en a pas encore choisi. */
export const DEVISE_PAR_DEFAUT = "MGA";

/** Retrouve la fiche d'un code : celle de la boutique d'abord, puis la commune. */
export function ficheDevise(catalogue: Devise[], code: string): Devise | undefined {
  return (
    catalogue.find((d) => d.code === code && d.store_id) ?? catalogue.find((d) => d.code === code)
  );
}

export function formaterMontant(
  montant: number,
  devise?: Pick<Devise, "symbole" | "decimales">,
): string {
  const dec = devise?.decimales ?? 0;
  const txt = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
    .format(montant)
    .replace(/\u202f/g, "\u00a0");
  return `${txt}\u00a0${devise?.symbole ?? "Ar"}`;
}

/** Un taux lisible : assez de chiffres significatifs, jamais une traînée de zéros. */
export function formaterTaux(taux: number): string {
  const chiffres = taux >= 100 ? 2 : taux >= 1 ? 4 : 8;
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: chiffres })
    .format(taux)
    .replace(/\u202f/g, "\u00a0");
}

/** Convertit un montant d'une devise de la boutique vers sa devise principale. */
export function versPrincipale(
  montant: number,
  code: string,
  devises: DeviseBoutique[],
): number | null {
  const d = devises.find((x) => x.code === code);
  if (!d) return null;
  return montant * Number(d.taux);
}

export const LIBELLE_SOURCE: Record<string, string> = {
  manuel: "Saisi à la main",
  auto: "Taux du marché",
  secours: "Dernier taux connu",
  principale: "Devise principale",
};
