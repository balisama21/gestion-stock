import React, { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  LIBELLE_ORIGINE,
  calculerLaMarge,
  formaterTaux,
  prixDepuisAchat,
  tauxApplicable,
  type ReglagesPrixAuto,
} from "../../lib/prixAuto";
import { formatCurrency } from "../../utils/formulas";
import { Equivalents } from "../../lib/contexteDevises";

interface ChampPrixDeVenteProps {
  prixAchat: number;
  prixVente: number;
  onPrixVente: (valeur: number) => void;
  /** « auto » : le prix suit l'achat. « manuel » : il est figé. */
  mode: string;
  onMode: (mode: "auto" | "manuel") => void;
  /** Le taux propre à ce produit, s'il en a un. */
  tauxProduit: number | null;
  onTauxProduit: (taux: number | null) => void;
  /** Le taux de sa catégorie, s'il en a une qui en porte un. */
  tauxCategorie: number | null;
  reglages: ReglagesPrixAuto;
  id?: string;
}

/**
 * Fonction désactivée, le champ n'est qu'un nombre à taper, comme avant.
 *
 * Taper un prix suffit à passer le produit en manuel : c'est le geste
 * qui décide, pas une case à cocher. Une correction doit tenir, et
 * découvrir le lendemain qu'un achat l'a effacée serait la pire des
 * surprises. Le retour en automatique, lui, est explicite.
 */
export const ChampPrixDeVente: React.FC<ChampPrixDeVenteProps> = ({
  prixAchat,
  prixVente,
  onPrixVente,
  mode,
  onMode,
  tauxProduit,
  onTauxProduit,
  tauxCategorie,
  reglages,
  id = "prix-vente",
}) => {
  const applique = useMemo(
    () => tauxApplicable(tauxProduit, tauxCategorie, reglages.taux),
    [tauxProduit, tauxCategorie, reglages.taux],
  );

  const marge = calculerLaMarge(prixVente, prixAchat);
  const enAuto = reglages.actif && mode === "auto";

  /**
   * Le prix suit l'achat, et seulement quand l'achat bouge : sans la
   * garde sur `dernierAchat`, poser le prix calculé relancerait l'effet
   * sans fin.
   */
  const dernierAchat = useRef(prixAchat);
  useEffect(() => {
    if (dernierAchat.current === prixAchat) return;
    dernierAchat.current = prixAchat;
    if (!enAuto || prixAchat <= 0) return;
    onPrixVente(prixDepuisAchat(prixAchat, applique.taux, reglages.arrondi));
    // `onPrixVente` est recréée à chaque rendu : la mettre en
    // dépendance relancerait l'effet en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prixAchat, enAuto, applique.taux, reglages.arrondi]);

  /** Poser un taux repasse le produit en automatique. */
  const appliquerTaux = (taux: number) => {
    onTauxProduit(taux === reglages.taux ? null : taux);
    onMode("auto");
    onPrixVente(prixDepuisAchat(prixAchat, taux, reglages.arrondi));
  };

  const revenirEnAuto = () => {
    onMode("auto");
    onPrixVente(prixDepuisAchat(prixAchat, applique.taux, reglages.arrondi));
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        Prix de vente (Ar)
      </label>
      <input
        id={id}
        type="number"
        required
        min="0"
        inputMode="decimal"
        value={prixVente}
        onChange={(e) => {
          onPrixVente(Number(e.target.value));
          // Le geste décide : dès qu'on tape, le prix est à soi.
          if (reglages.actif) onMode("manuel");
        }}
        className="app-field font-mono"
      />
      <Equivalents montant={prixVente} className="mt-1" />

      {reglages.actif && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {reglages.tauxRapides.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => appliquerTaux(t)}
                disabled={prixAchat <= 0}
                className={
                  enAuto && applique.taux === t
                    ? "rounded-xl border border-primary bg-success-soft px-3 py-1.5 text-sm font-medium text-primary"
                    : "rounded-xl border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                }
              >
                {formaterTaux(t)}
              </button>
            ))}
            <label className="inline-flex items-center gap-2">
              <span className="sr-only">Taux libre, en pourcentage du prix d&apos;achat</span>
              <input
                type="number"
                min={0}
                max={1000}
                step={0.5}
                inputMode="decimal"
                placeholder="Autre %"
                disabled={prixAchat <= 0}
                value={tauxProduit === null ? "" : tauxProduit}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    onTauxProduit(null);
                    return;
                  }
                  const n = Number(v);
                  if (!Number.isFinite(n)) return;
                  onTauxProduit(n);
                  onMode("auto");
                  onPrixVente(prixDepuisAchat(prixAchat, n, reglages.arrondi));
                }}
                className="app-field-sm w-24 font-mono"
              />
            </label>
          </div>

          {/* ── Ce que le prix affiché dit de lui-même ── */}
          <p className="text-xs text-muted-foreground">
            {enAuto ? (
              <>
                Calculé : {formaterTaux(applique.taux)} sur le prix d&apos;achat,{" "}
                {LIBELLE_ORIGINE[applique.origine]}. Il suivra vos prochains achats.
              </>
            ) : (
              <>Prix fixé à la main. Plus aucun achat ne le recalculera.</>
            )}
          </p>

          {!enAuto && prixAchat > 0 && (
            <button type="button" onClick={revenirEnAuto} className="app-btn-secondary">
              <RefreshCw className="h-4 w-4" />
              Revenir au calcul automatique
            </button>
          )}
        </div>
      )}

      {prixAchat > 0 && prixVente > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Marge :{" "}
          <span className="font-medium text-foreground">{formatCurrency(marge.ariary)}</span>
          {marge.pourcentDeLAchat !== null && (
            <> · {formaterTaux(marge.pourcentDeLAchat)} sur le prix d&apos;achat</>
          )}
        </p>
      )}

      {marge.aPerte && (
        <p
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-xl border border-danger-border bg-danger-soft px-3 py-2 text-xs t-danger"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Vous vendriez à perte : {formatCurrency(prixVente)} pour un achat à{" "}
            {formatCurrency(prixAchat)}.
          </span>
        </p>
      )}
    </div>
  );
};
