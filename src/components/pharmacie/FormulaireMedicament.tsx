import React, { useState } from "react";
import { Pill } from "lucide-react";
import type { Product } from "../../types";
import type { Database } from "../../lib/database.types";
import { Modal } from "../shared/Modal";
import { FORMES, REGIMES, type FichePharma, type Regime } from "../../lib/pharmacie";

type Categorie = Database["public"]["Tables"]["categories"]["Row"];

export interface ValeursMedicament {
  nom: string;
  dci: string;
  dosage: string;
  forme: string;
  laboratoire: string;
  emplacement: string;
  regime: Regime;
  frais: boolean;
  categorieId: string | null;
  prixAchat: number;
  prixVente: number;
  seuil: number;
  codeBarres: string;
  notes: string;
}

/** Le nom affiché : « Amoxicilline 500 mg », sans répéter un dosage déjà écrit. */
export const nomAffiche = (nom: string, dosage: string) => {
  const n = nom.trim();
  const d = dosage.trim();
  return d && !n.toLowerCase().includes(d.toLowerCase()) ? `${n} ${d}` : n;
};

const nombre = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

const Champ: React.FC<{ libelle: string; children: React.ReactNode; className?: string }> = ({
  libelle,
  children,
  className,
}) => (
  <label className={`block ${className ?? ""}`}>
    <span className="mb-1 block text-xs font-semibold text-muted-foreground">{libelle}</span>
    {children}
  </label>
);

/** Créer ou modifier un médicament : ce qu'il est, où il est, ce qu'il coûte. */
export const FormulaireMedicament: React.FC<{
  produit?: Product;
  fiche?: FichePharma;
  categories: Categorie[];
  onFermer: () => void;
  onEnregistrer: (v: ValeursMedicament) => Promise<string | null>;
}> = ({ produit, fiche, categories, onFermer, onEnregistrer }) => {
  const [v, setV] = useState({
    nom: produit?.designation ?? "",
    dci: fiche?.dci ?? "",
    dosage: fiche?.dosage ?? "",
    forme: fiche?.forme ?? "",
    laboratoire: fiche?.laboratoire ?? "",
    emplacement: fiche?.emplacement ?? "",
    regime: (fiche?.regime ?? "libre") as Regime,
    frais: fiche?.conservation === "frais",
    categorieId: produit?.categoryId ?? "",
    prixAchat: produit ? String(produit.prixAchat) : "",
    prixVente: produit ? String(produit.prixVenteDefaut) : "",
    seuil: produit ? String(produit.seuilAlerte) : "5",
    codeBarres: produit?.codeBarres ?? "",
    notes: fiche?.notes ?? "",
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const changer =
    (cle: keyof typeof v) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setV({ ...v, [cle]: e.target.value });

  const rubriques = categories
    .filter((c) => (c.usage ?? "produit") === "produit" && c.actif !== false)
    .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"));

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    const prixAchat = nombre(v.prixAchat || "0");
    const prixVente = nombre(v.prixVente);
    const seuil = nombre(v.seuil || "0");
    if (!v.nom.trim()) return setErreur("Donnez le nom du médicament.");
    if (Number.isNaN(prixVente)) return setErreur("Indiquez le prix de vente.");
    if (Number.isNaN(prixAchat) || Number.isNaN(seuil)) return setErreur("Vérifiez les nombres.");
    setEnvoi(true);
    setErreur(null);
    const err = await onEnregistrer({
      ...v,
      nom: v.nom.trim(),
      categorieId: v.categorieId || null,
      prixAchat,
      prixVente,
      seuil: Math.round(seuil),
    });
    setEnvoi(false);
    if (err) setErreur(err);
  };

  return (
    <Modal
      open
      onClose={onFermer}
      size="2xl"
      icon={<Pill className="h-4 w-4" />}
      title={produit ? "Modifier le médicament" : "Nouveau médicament"}
      description={
        produit
          ? undefined
          : "Le stock entre ensuite par une réception, avec son numéro de lot et sa date."
      }
      dismissible={!envoi}
      footer={
        <>
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
          <button
            type="submit"
            form="formulaire-medicament"
            disabled={envoi}
            className="app-btn-primary"
          >
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <form id="formulaire-medicament" onSubmit={valider} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Champ libelle="Nom commercial" className="sm:col-span-2">
            <input
              value={v.nom}
              onChange={changer("nom")}
              className="app-field"
              placeholder="Doliprane, Amoxil…"
              autoFocus
            />
          </Champ>
          <Champ libelle="Dosage">
            <input
              value={v.dosage}
              onChange={changer("dosage")}
              className="app-field"
              placeholder="500 mg"
            />
          </Champ>
          <Champ libelle="Molécule (DCI)" className="sm:col-span-2">
            <input
              value={v.dci}
              onChange={changer("dci")}
              className="app-field"
              placeholder="Paracétamol"
            />
          </Champ>
          <Champ libelle="Forme">
            <input
              list="formes-pharma"
              value={v.forme}
              onChange={changer("forme")}
              className="app-field"
              placeholder="Comprimé"
            />
            <datalist id="formes-pharma">
              {FORMES.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </Champ>
          <Champ libelle="Laboratoire">
            <input value={v.laboratoire} onChange={changer("laboratoire")} className="app-field" />
          </Champ>
          <Champ libelle="Emplacement">
            <input
              value={v.emplacement}
              onChange={changer("emplacement")}
              className="app-field"
              placeholder="Rayon B, tiroir 3"
            />
          </Champ>
          <Champ libelle="Rubrique">
            <select value={v.categorieId} onChange={changer("categorieId")} className="app-field">
              <option value="">Sans rubrique</option>
              {rubriques.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </Champ>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Délivrance</p>
          <div className="flex flex-wrap gap-2">
            {REGIMES.map((r) => (
              <button
                key={r.valeur}
                type="button"
                onClick={() => setV({ ...v, regime: r.valeur })}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${
                  v.regime === r.valeur
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary"
                }`}
              >
                {r.libelle}
              </button>
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={v.frais}
              onChange={(e) => setV({ ...v, frais: e.target.checked })}
              className="h-4 w-4"
            />
            Se conserve au frais (réfrigérateur)
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Champ libelle="Prix d'achat">
            <input
              inputMode="decimal"
              value={v.prixAchat}
              onChange={changer("prixAchat")}
              className="app-field"
            />
          </Champ>
          <Champ libelle="Prix de vente">
            <input
              inputMode="decimal"
              value={v.prixVente}
              onChange={changer("prixVente")}
              className="app-field"
            />
          </Champ>
          <Champ libelle="Alerte sous">
            <input
              inputMode="numeric"
              value={v.seuil}
              onChange={changer("seuil")}
              className="app-field"
            />
          </Champ>
          <Champ libelle="Code-barres">
            <input value={v.codeBarres} onChange={changer("codeBarres")} className="app-field" />
          </Champ>
        </div>

        <Champ libelle="Notes (posologie, précautions…)">
          <textarea value={v.notes} onChange={changer("notes")} rows={2} className="app-field" />
        </Champ>
        {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}
      </form>
    </Modal>
  );
};
