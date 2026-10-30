import React from "react";
import { Boxes, Plus, Trash2 } from "lucide-react";
import { BoutonScan } from "../shared/BoutonScan";
import { formatCurrency } from "../../utils/formulas";
import { CONDITIONNEMENTS_COURANTS } from "../../lib/detailsProduit";
import {
  MAX_CONDITIONNEMENTS,
  erreurConditionnements,
  libelleUnite,
  nouvelIdentifiant,
  prixAchatDe,
  prixUnitaireDepuis,
  prixVenteDe,
  remiseDuConditionnement,
  type Conditionnement,
} from "../../lib/conditionnements";

interface EditeurConditionnementsProps {
  valeur: Conditionnement[];
  onChange: (liste: Conditionnement[]) => void;
  /** L'unité de base du produit, celle du stock. */
  unite: string;
  /** Les prix de l'unité de base, pour proposer ceux d'un conditionnement. */
  prixVenteUnite: number;
  prixAchatUnite: number;
  /** Le prix d'achat est une colonne sensible : masquée, son champ disparaît. */
  montrerPrixAchat?: boolean;
}

const versNombre = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Les conditionnements d'un produit : « 1 carton = 12 pièces ».
 *
 * Chaque ligne dit combien d'unités de base elle contient — pour ce
 * produit-ci, jamais une règle générale — et, si l'on veut, son propre
 * prix de vente (le prix de gros), son prix d'achat habituel et
 * l'étiquette du carton. Laissés vides, les prix suivent l'unité.
 */
export const EditeurConditionnements: React.FC<EditeurConditionnementsProps> = ({
  valeur,
  onChange,
  unite,
  prixVenteUnite,
  prixAchatUnite,
  montrerPrixAchat = true,
}) => {
  const uniteLue = unite.trim();
  const erreur = erreurConditionnements(valeur, uniteLue || null);

  const modifier = (id: string, patch: Partial<Conditionnement>) =>
    onChange(valeur.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const ajouter = (nom: string) =>
    onChange([
      ...valeur,
      {
        id: nouvelIdentifiant(),
        nom,
        quantite: 0,
        prixVente: null,
        prixAchat: null,
        codeBarres: null,
      },
    ]);

  // On ne propose ni l'unité de base, ni ce qui est déjà déclaré.
  const pris = new Set([uniteLue.toLowerCase(), ...valeur.map((c) => c.nom.trim().toLowerCase())]);
  const suggestions = CONDITIONNEMENTS_COURANTS.filter((s) => !pris.has(s));
  const plein = valeur.length >= MAX_CONDITIONNEMENTS;
  const unitePluriel = libelleUnite(uniteLue || null, 2);

  return (
    <section aria-labelledby="pd-cond-titre" className="space-y-3">
      <div>
        <p
          id="pd-cond-titre"
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
        >
          <Boxes className="h-3.5 w-3.5" aria-hidden="true" />
          Conditionnements
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Achetez ou vendez par carton, sac ou pack : le stock se compte toujours en{" "}
          <strong className="font-semibold text-foreground">{unitePluriel}</strong>, et chaque
          conditionnement dit combien il en contient.
        </p>
      </div>

      {valeur.map((c, i) => {
        const ventesDetail = c.quantite >= 2 ? c.quantite * prixVenteUnite : 0;
        const remise =
          c.quantite >= 2 ? remiseDuConditionnement(c, { prixVenteDefaut: prixVenteUnite }) : null;
        const achat = c.quantite >= 2 ? prixAchatDe(c, { prixAchat: prixAchatUnite }) : 0;
        const nomAffiche = c.nom.trim() || `conditionnement ${i + 1}`;
        return (
          <div
            key={c.id}
            className="rounded-xl border border-border p-3"
            data-testid="conditionnement"
          >
            <div className="flex items-start gap-2">
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <label
                    htmlFor={`pd-cond-nom-${c.id}`}
                    className="mb-1 block text-[11px] font-medium text-muted-foreground"
                  >
                    Nom
                  </label>
                  <input
                    id={`pd-cond-nom-${c.id}`}
                    type="text"
                    className="app-field"
                    placeholder="carton"
                    value={c.nom}
                    onChange={(e) => modifier(c.id, { nom: e.target.value })}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`pd-cond-qte-${c.id}`}
                    className="mb-1 block text-[11px] font-medium text-muted-foreground"
                  >
                    Contient
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`pd-cond-qte-${c.id}`}
                      type="number"
                      min={2}
                      step={1}
                      inputMode="numeric"
                      className="app-field w-24 font-mono"
                      placeholder="12"
                      value={c.quantite || ""}
                      onChange={(e) =>
                        modifier(c.id, { quantite: Math.trunc(Number(e.target.value) || 0) })
                      }
                    />
                    <span className="whitespace-nowrap text-sm text-muted-foreground">
                      {libelleUnite(uniteLue || null, c.quantite || 2)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange(valeur.filter((x) => x.id !== c.id))}
                className="app-btn-icon mt-5 shrink-0"
                aria-label={`Retirer le conditionnement ${nomAffiche}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div
              className={`mt-3 grid grid-cols-1 gap-2 ${montrerPrixAchat ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
            >
              <div>
                <label
                  htmlFor={`pd-cond-pv-${c.id}`}
                  className="mb-1 block text-[11px] font-medium text-muted-foreground"
                >
                  Prix de vente
                </label>
                <input
                  id={`pd-cond-pv-${c.id}`}
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  className="app-field font-mono"
                  placeholder={ventesDetail > 0 ? String(ventesDetail) : "Au détail"}
                  value={c.prixVente ?? ""}
                  onChange={(e) => modifier(c.id, { prixVente: versNombre(e.target.value) })}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {c.prixVente === null
                    ? ventesDetail > 0
                      ? `Vide : ${formatCurrency(ventesDetail)}, le prix au détail.`
                      : "Vide : le prix au détail."
                    : remise !== null
                      ? remise > 0
                        ? `${remise} % de moins qu'au détail (${formatCurrency(ventesDetail)}).`
                        : `${-remise} % de plus qu'au détail (${formatCurrency(ventesDetail)}).`
                      : "Le même prix qu'au détail."}
                </p>
              </div>
              {montrerPrixAchat && (
                <div>
                  <label
                    htmlFor={`pd-cond-pa-${c.id}`}
                    className="mb-1 block text-[11px] font-medium text-muted-foreground"
                  >
                    Prix d&apos;achat
                  </label>
                  <input
                    id={`pd-cond-pa-${c.id}`}
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    className="app-field font-mono"
                    placeholder={achat > 0 ? String(achat) : "Optionnel"}
                    value={c.prixAchat ?? ""}
                    onChange={(e) => modifier(c.id, { prixAchat: versNombre(e.target.value) })}
                  />
                  {c.quantite >= 2 && achat > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Soit {formatCurrency(prixUnitaireDepuis(achat, c.quantite))} par{" "}
                      {libelleUnite(uniteLue || null, 1)}.
                    </p>
                  )}
                </div>
              )}
              <div>
                <label
                  htmlFor={`pd-cond-code-${c.id}`}
                  className="mb-1 block text-[11px] font-medium text-muted-foreground"
                >
                  Code-barres
                </label>
                <div className="flex gap-2">
                  <input
                    id={`pd-cond-code-${c.id}`}
                    type="text"
                    inputMode="numeric"
                    className="app-field font-mono"
                    placeholder="Optionnel"
                    value={c.codeBarres ?? ""}
                    onChange={(e) => modifier(c.id, { codeBarres: e.target.value || null })}
                  />
                  <BoutonScan
                    onCode={(code) => modifier(c.id, { codeBarres: code })}
                    libelle={`Scanner le code-barres : ${nomAffiche}`}
                    titre={`Code-barres : ${nomAffiche}`}
                  />
                </div>
              </div>
            </div>
            {c.quantite >= 2 && (
              <p className="mt-2 text-xs text-foreground">
                1 {c.nom.trim() || "conditionnement"} = {c.quantite.toLocaleString("fr-FR")}{" "}
                {libelleUnite(uniteLue || null, c.quantite)} · vendu{" "}
                {formatCurrency(prixVenteDe(c, { prixVenteDefaut: prixVenteUnite }))}
              </p>
            )}
          </div>
        );
      })}

      {!plein && (
        <div className="flex flex-wrap items-center gap-2">
          {suggestions.slice(0, 5).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ajouter(s)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => ajouter("")}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Autre
          </button>
        </div>
      )}

      {erreur && valeur.length > 0 && (
        <p role="alert" className="text-xs t-danger">
          {erreur}
        </p>
      )}
    </section>
  );
};
