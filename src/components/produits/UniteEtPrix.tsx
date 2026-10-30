import React from "react";
import { SelecteurUnite } from "./SelecteurUnite";
import { Segments } from "./DetailsProduit";
import { ChampPrixDeVente } from "./ChampPrixDeVente";
import { UNITES } from "../../lib/detailsProduit";
import { libelleUnite } from "../../lib/conditionnements";
import { formatCurrency, quantiteEnMots } from "../../utils/formulas";
import { symboleDeSaisie } from "../../lib/affichageDevise";
import { Equivalents } from "../../lib/contexteDevises";
import {
  auCentime,
  changerReference,
  choisirUnite,
  contenuDe,
  duOuDeLa,
  erreurUnite,
  estUnContenant,
  leOuLa,
  prixDetailles,
  unOuUne,
  type PrixSaisis,
  type ReferenceVente,
  type SaisieUnite,
} from "../../lib/uniteDeVente";

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Ce que l'on choisit neuf fois sur dix. */
const UNITES_RAPIDES = ["pièce", "kg", "litre", "paquet", "carton", "sac"];

const pastille = (actif: boolean) =>
  `min-h-9 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
    actif
      ? "border-success-border bg-success-soft t-success"
      : "border-border text-muted-foreground hover:text-foreground"
  }`;

/**
 * L'unité du produit, et — seulement pour un paquet, un carton, un
 * sac… — ce qu'il contient. Une pièce ou un kg n'ouvrent rien de plus.
 */
export const ChoixUnite: React.FC<{
  id: string;
  valeur: SaisieUnite;
  onChange: (s: SaisieUnite) => void;
}> = ({ id, valeur, onChange }) => {
  const contenant = estUnContenant(valeur.unite);
  const n = contenuDe(valeur);
  const erreur = erreurUnite(valeur);
  const interne = valeur.uniteInterne.trim() || "pièce";
  const unite = valeur.unite.trim();

  // Ce qu'un contenant peut renfermer : tout, sauf lui-même.
  const internes = React.useMemo(() => {
    const liste = UNITES.filter((u) => u.toLowerCase() !== unite.toLowerCase());
    return liste.some((u) => u.toLowerCase() === interne.toLowerCase())
      ? liste
      : [interne, ...liste];
  }, [unite, interne]);

  // Les unités courantes d'un geste ; les autres dans la liste complète.
  const rapide = UNITES_RAPIDES.find((u) => u === unite.toLowerCase()) ?? null;
  const [autreDemande, setAutre] = React.useState(false);
  // Une unité hors des pastilles (« bouteille ») ouvre la liste d'office.
  const autre = autreDemande || rapide === null;

  return (
    <div className="space-y-3">
      <div>
        <p id={`${id}-unite-titre`} className="mb-1.5 block text-sm font-medium text-foreground">
          Unité
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`${id}-unite-titre`}
          className="flex flex-wrap gap-2"
        >
          {UNITES_RAPIDES.map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={!autre && rapide === u}
              onClick={() => {
                setAutre(false);
                onChange(choisirUnite(valeur, u));
              }}
              className={pastille(!autre && rapide === u)}
            >
              {majuscule(u)}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={autre}
            onClick={() => setAutre(true)}
            className={pastille(autre)}
          >
            Autre…
          </button>
        </div>
        {autre && (
          <div className="mt-2">
            <SelecteurUnite
              id={`${id}-unite`}
              label="Autre unité"
              valeur={valeur.unite}
              onChange={(u) => onChange(choisirUnite(valeur, u))}
              aide="Bouteille, sachet, mètre, boîte, douzaine… ou tapez la vôtre."
            />
          </div>
        )}
      </div>

      {contenant && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <label htmlFor={`${id}-contenu`} className="block text-sm font-medium text-foreground">
            Combien de {libelleUnite(interne, 2)} contient {unOuUne(unite)} ?
          </label>
          <div className="flex gap-2">
            <input
              id={`${id}-contenu`}
              type="number"
              min={2}
              step={1}
              inputMode="numeric"
              placeholder="ex : 12"
              value={valeur.contenu}
              onChange={(e) => onChange({ ...valeur, contenu: e.target.value })}
              className="app-field w-28 shrink-0 font-mono"
            />
            <select
              aria-label={`Ce que contient ${unOuUne(unite)}`}
              value={interne}
              onChange={(e) => onChange({ ...valeur, uniteInterne: e.target.value })}
              className="app-field min-w-0 flex-1"
            >
              {internes.map((u) => (
                <option key={u} value={u}>
                  {libelleUnite(u, 2)}
                </option>
              ))}
            </select>
          </div>
          {erreur ? (
            <p role="alert" className="text-xs t-danger">
              {erreur}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {n ? (
                <>
                  1 {unite} = {quantiteEnMots(n, interne)}. Le stock se compte en{" "}
                  {libelleUnite(interne, 2)} : vous achetez et vendez par {unite} ou par {interne}.
                </>
              ) : (
                <>Laissez vide si vous ne l&apos;ouvrez jamais pour vendre au détail.</>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Le prix d'achat de ce qu'on a choisi : « du paquet » pour un paquet,
 * et le prix de la pièce en dessous, calculé.
 */
export const ChampPrixAchat: React.FC<{
  id: string;
  saisie: SaisieUnite;
  valeur: number;
  onChange: (n: number) => void;
}> = ({ id, saisie, valeur, onChange }) => {
  const n = contenuDe(saisie);
  const unite = saisie.unite.trim();
  const libelle = n
    ? `Prix d'achat ${duOuDeLa(unite)}`
    : unite
      ? `Prix d'achat (par ${unite})`
      : "Prix d'achat";
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {libelle} ({symboleDeSaisie()})
      </label>
      <input
        id={id}
        type="number"
        required
        min="0"
        step="any"
        inputMode="decimal"
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        className="app-field font-mono"
      />
      <Equivalents montant={valeur} className="mt-1" saisie />
      {n && valeur > 0 && (
        <p className="mt-1 text-xs font-medium t-success">
          Soit {formatCurrency(auCentime(valeur / n))} par {saisie.uniteInterne.trim() || "pièce"}
        </p>
      )}
    </div>
  );
};

type ChampPrixDeVenteProps = React.ComponentProps<typeof ChampPrixDeVente>;

/**
 * Le prix de vente, saisi au niveau qu'on préfère.
 *
 * Pour un paquet de 12 : on tape le prix du paquet OU celui de la
 * pièce, et l'autre s'affiche, calculé. Un seul nombre est retenu — la
 * référence —, l'autre n'est jamais un champ : impossible qu'ils se
 * recalculent l'un l'autre sans fin.
 */
export const PrixDeVenteDuProduit: React.FC<
  Omit<ChampPrixDeVenteProps, "prixAchat" | "prixVente" | "onPrixVente" | "label" | "id"> & {
    id: string;
    saisie: SaisieUnite;
    /** `achat` : le prix d'achat de l'unité choisie — le paquet, s'il en est un. */
    prix: PrixSaisis;
    onPrix: (p: PrixSaisis) => void;
  }
> = ({ id, saisie, prix, onPrix, ...champ }) => {
  const d = prixDetailles(saisie, prix);
  const unite = saisie.unite.trim();
  const interne = saisie.uniteInterne.trim() || "pièce";

  if (d.contenu === null) {
    return (
      <ChampPrixDeVente
        {...champ}
        id={id}
        label={unite ? `Prix de vente (par ${unite})` : undefined}
        prixAchat={prix.achat}
        prixVente={prix.vente}
        onPrixVente={(vente) => onPrix({ ...prix, vente })}
      />
    );
  }

  const surLeLot = prix.reference === "lot";
  const deduit = surLeLot ? d.venteUnite : d.venteLot;
  return (
    <div className="space-y-2">
      <Segments
        id={`${id}-reference`}
        label="Je saisis le prix de vente"
        options={[
          { valeur: "lot", libelle: majuscule(duOuDeLa(unite)) },
          { valeur: "unite", libelle: majuscule(duOuDeLa(interne)) },
        ]}
        valeur={prix.reference}
        onChange={(r) => onPrix(changerReference(saisie, prix, r as ReferenceVente))}
      />
      <ChampPrixDeVente
        {...champ}
        id={id}
        label={`Prix de vente ${duOuDeLa(surLeLot ? unite : interne)}`}
        prixAchat={surLeLot ? (d.achatLot ?? 0) : d.achatUnite}
        prixVente={prix.vente}
        onPrixVente={(vente) => onPrix({ ...prix, vente })}
      />
      {prix.vente > 0 && (
        <p className="text-xs font-medium t-success">
          Soit {formatCurrency(deduit ?? 0)} {leOuLa(surLeLot ? interne : unite)}
        </p>
      )}
    </div>
  );
};
