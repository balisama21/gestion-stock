import React, { useMemo, useState } from "react";
import { Phone, Save } from "lucide-react";
import { SelecteurListe } from "./SelecteurListe";
import type { Database } from "../../lib/database.types";

type Fournisseur = Database["public"]["Tables"]["suppliers"]["Row"];

interface SelecteurFournisseurProps {
  fournisseurs: Fournisseur[];
  /** L'identifiant retenu, ou null tant qu'aucune fiche n'est choisie. */
  valeur: string | null;
  /**
   * L'identifiant pour le rattachement, le nom pour la colonne texte que
   * les fonctions de la base écrivent toujours. Les deux vont ensemble.
   */
  onChange: (id: string | null, nom: string) => void;
  /** Crée la fiche et la renvoie. Absente, le champ ne propose pas d'ajouter. */
  onCreer?: (data: {
    nom: string;
    telephone?: string | null;
  }) => Promise<{ supplier: Fournisseur | null; error: string | null }>;
  /** Complète la fiche qui vient d'être créée. */
  onCompleter?: (id: string, data: { telephone: string }) => Promise<{ error: string | null }>;
  label?: string;
  libelleVide?: string;
  compact?: boolean;
  id?: string;
}

/**
 * Le champ fournisseur, branché sur l'annuaire. Créer une fiche au
 * milieu d'un achat ne demande que le nom ; le téléphone est proposé
 * juste après, sans bloquer, et le reste attend l'écran Fournisseurs.
 */
export const SelecteurFournisseur: React.FC<SelecteurFournisseurProps> = ({
  fournisseurs,
  valeur,
  onChange,
  onCreer,
  onCompleter,
  label = "Fournisseur",
  libelleVide = "Aucun fournisseur",
  compact = false,
  id,
}) => {
  const [aCompleter, setACompleter] = useState<Fournisseur | null>(null);
  const [telephone, setTelephone] = useState("");
  const [enCours, setEnCours] = useState(false);

  const options = useMemo(
    () =>
      fournisseurs
        .filter((f) => f.statut === "actif" || f.id === valeur)
        .map((f) => ({
          id: f.id,
          nom: f.entreprise ? `${f.nom} — ${f.entreprise}` : f.nom,
          mention: f.telephone ?? f.ville ?? null,
          archive: f.statut !== "actif",
        }))
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [fournisseurs, valeur],
  );

  const choisir = (choisi: string | null) => {
    const f = fournisseurs.find((x) => x.id === choisi) ?? null;
    onChange(choisi, f?.nom ?? "");
  };

  const creer = async (nom: string) => {
    if (!onCreer) return { id: null, error: "Ajout impossible" };
    const { supplier, error } = await onCreer({ nom });
    if (error || !supplier) return { id: null, error: error ?? "Fiche non créée." };
    onChange(supplier.id, supplier.nom);
    setACompleter(supplier);
    setTelephone("");
    return { id: supplier.id, error: null };
  };

  const enregistrerTelephone = async () => {
    if (!aCompleter || !onCompleter) return;
    const propre = telephone.trim();
    if (!propre) {
      setACompleter(null);
      return;
    }
    setEnCours(true);
    await onCompleter(aCompleter.id, { telephone: propre });
    setEnCours(false);
    setACompleter(null);
  };

  return (
    <div className="space-y-2">
      <SelecteurListe
        id={id}
        label={label}
        options={options}
        valeur={valeur}
        onChange={choisir}
        onCreer={onCreer ? creer : undefined}
        libelleVide={libelleVide}
        placeholder="Chercher ou ajouter un fournisseur…"
        compact={compact}
        aide={
          onCreer
            ? "Tapez un nom : s'il n'existe pas, vous pourrez l'ajouter d'ici."
            : "La liste se complète depuis l'écran Fournisseurs."
        }
      />

      {aCompleter && onCompleter && (
        <div className="rounded-xl border border-border p-3">
          <label
            htmlFor="frn-tel-rapide"
            className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            Téléphone de « {aCompleter.nom} » — facultatif, complétez plus tard si besoin
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="frn-tel-rapide"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="03X XX XXX XX"
              className="app-field flex-1"
            />
            <button
              type="button"
              disabled={enCours}
              onClick={() => void enregistrerTelephone()}
              className="app-btn-secondary shrink-0"
            >
              <Save className="h-4 w-4" />
              {telephone.trim() ? "Enregistrer" : "Plus tard"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
