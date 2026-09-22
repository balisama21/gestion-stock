import React, { useState } from "react";
import { Calculator, Plus, Save, X } from "lucide-react";
import { SettingsSection } from "./primitives";
import { Toggle } from "../shared/Toggle";
import type { Personnalisation } from "../../lib/personnalisation";
import {
  ARRONDIS,
  calculerLaMarge,
  formaterTaux,
  lirePrixAuto,
  prixDepuisAchat,
  type Arrondi,
} from "../../lib/prixAuto";
import { formatCurrency } from "../../utils/formulas";

interface PrixSectionProps {
  personnalisation: Personnalisation;
  onSave: (p: Personnalisation) => Promise<void> | void;
}

/** Pour que le réglage se voie avant d'être subi. */
const ACHAT_EXEMPLE = 12_500;

/**
 * L'interrupteur est à l'arrêt : une boutique qui ne vient jamais ici
 * saisit ses prix comme avant, rien ne bouge en rayon.
 *
 * Le taux porte sur le prix d'ACHAT — 1 000 « +10 % » donne 1 100, pas
 * 1 111 — donc l'écran écrit toujours sur quoi le pourcentage porte.
 */
export const PrixSection: React.FC<PrixSectionProps> = ({ personnalisation, onSave }) => {
  const reglages = lirePrixAuto(personnalisation);
  const [taux, setTaux] = useState(String(reglages.taux));
  const [rapides, setRapides] = useState(reglages.tauxRapides);
  const [nouveauRapide, setNouveauRapide] = useState("");
  const [enregistre, setEnregistre] = useState(false);

  const ecrire = async (patch: Record<string, unknown>) => {
    // Colonne partagée : les réglages voisins sont recopiés.
    const base = (personnalisation as { prixAuto?: Record<string, unknown> }).prixAuto ?? {};
    await onSave({
      ...personnalisation,
      prixAuto: { ...reglages, ...base, ...patch },
    });
    setEnregistre(true);
    window.setTimeout(() => setEnregistre(false), 3000);
  };

  const venteExemple = prixDepuisAchat(ACHAT_EXEMPLE, reglages.taux, reglages.arrondi);
  const margeExemple = calculerLaMarge(venteExemple, ACHAT_EXEMPLE);

  return (
    <SettingsSection
      title="Prix de vente calculé"
      description="Le prix de vente se déduit du prix d'achat, avec le taux que vous choisissez."
      icon={<Calculator className="w-4 h-4" />}
    >
      <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Activer le calcul</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Désactivé, la saisie du prix reste exactement comme aujourd&apos;hui : vous tapez le
            prix de vente, rien ne le recalcule.
          </p>
        </div>
        <Toggle
          checked={reglages.actif}
          onChange={(v) => void ecrire({ actif: v })}
          label="Activer le calcul du prix de vente"
        />
      </div>

      {reglages.actif && (
        <>
          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-medium text-foreground">Taux de la boutique</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Appliqué sur le prix d&apos;achat. Une catégorie ou un produit peut avoir le sien : le
              plus précis l&apos;emporte.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <label className="sm:w-48">
                <span className="sr-only">Taux par défaut, en pourcentage</span>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  step={0.5}
                  inputMode="decimal"
                  className="app-field font-mono"
                  value={taux}
                  onChange={(e) => setTaux(e.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => void ecrire({ taux: Number(taux) || 0 })}
                className="app-btn-primary shrink-0"
              >
                <Save className="h-4 w-4" />
                {enregistre ? "Enregistré" : "Enregistrer"}
              </button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Un article acheté {formatCurrency(ACHAT_EXEMPLE)} se vendrait{" "}
              <span className="font-medium text-foreground">{formatCurrency(venteExemple)}</span> —
              soit {formatCurrency(margeExemple.ariary)} de marge, {formaterTaux(reglages.taux)} sur
              le prix d&apos;achat.
            </p>
          </div>

          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-medium text-foreground">Taux proposés en un clic</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Les boutons affichés à côté du prix, dans la fiche d&apos;un produit.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {rapides.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-sm text-foreground"
                >
                  {formaterTaux(t)}
                  <button
                    type="button"
                    onClick={() => {
                      const suite = rapides.filter((x) => x !== t);
                      setRapides(suite);
                      void ecrire({ tauxRapides: suite });
                    }}
                    className="app-btn-icon h-6 w-6"
                    aria-label={`Retirer le taux de ${t} %`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <span className="inline-flex items-center gap-2">
                <label className="w-24">
                  <span className="sr-only">Nouveau taux rapide, en pourcentage</span>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    step={0.5}
                    inputMode="decimal"
                    placeholder="%"
                    className="app-field-sm font-mono"
                    value={nouveauRapide}
                    onChange={(e) => setNouveauRapide(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={nouveauRapide.trim() === ""}
                  onClick={() => {
                    const n = Number(nouveauRapide);
                    if (!Number.isFinite(n) || rapides.includes(n)) {
                      setNouveauRapide("");
                      return;
                    }
                    const suite = [...rapides, n].sort((a, b) => a - b);
                    setRapides(suite);
                    setNouveauRapide("");
                    void ecrire({ tauxRapides: suite });
                  }}
                  className="app-btn-secondary"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter
                </button>
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <label htmlFor="prix-arrondi" className="block text-sm font-medium text-foreground">
              Arrondi du prix obtenu
            </label>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">
              Toujours vers le haut : arrondir vers le bas rognerait la marge que vous venez de
              demander.
            </p>
            <select
              id="prix-arrondi"
              className="app-field sm:w-64"
              value={reglages.arrondi}
              onChange={(e) => void ecrire({ arrondi: Number(e.target.value) as Arrondi })}
            >
              {ARRONDIS.map((a) => (
                <option key={a.valeur} value={a.valeur}>
                  {a.libelle}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-muted-foreground">
            Chaque produit reste libre : saisir un prix à la main le fait passer en « manuel », et
            plus rien ne le recalcule tant que vous ne le remettez pas en automatique.
          </p>
        </>
      )}
    </SettingsSection>
  );
};
