import React, { useState } from "react";
import { Pill, Sparkles } from "lucide-react";
import type { Product } from "../../types";
import type { Database } from "../../lib/database.types";
import { Modal } from "../shared/Modal";
import { FORMES, REGIMES, libelleRegime, type FichePharma, type Regime } from "../../lib/pharmacie";
import {
  prixAuCoefficient,
  proposerMedicaments,
  type MedicamentCourant,
} from "../../lib/medicamentsCourants";
import { BoutonScan } from "../shared/BoutonScan";
import { useMemoireSaisie } from "../../hooks/useMemoireSaisie";
import { Raccourcis } from "./ui";

const DOSAGES = ["100 mg", "250 mg", "500 mg", "1 g"];
const FORMES_COURANTES = ["Comprimé", "Gélule", "Sirop", "Injectable", "Crème", "Sachet"];
const COEFFICIENTS = [1.2, 1.3, 1.4, 1.5];
const SEUILS = ["5", "10", "20", "50"];

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
  // Les propositions ne s'affichent que pour une fiche neuve, tant
  // qu'on n'en a pas choisi une.
  const [propose, setPropose] = useState(!produit);
  const [laboratoires, retenirLabo] = useMemoireSaisie("tn-pharma-laboratoires");
  const [emplacements, retenirEmplacement] = useMemoireSaisie("tn-pharma-emplacements");
  const propositions = propose ? proposerMedicaments(v.nom || v.dci) : [];
  const remplir = (x: MedicamentCourant) => {
    setV({
      ...v,
      nom: x.nom,
      dci: x.dci,
      dosage: x.dosage,
      forme: x.forme,
      regime: x.regime,
      frais: !!x.frais,
    });
    setPropose(false);
  };
  const achat = nombre(v.prixAchat || "");
  const vente = nombre(v.prixVente || "");
  const marge =
    Number.isFinite(achat) && Number.isFinite(vente) && achat > 0 && vente > 0
      ? { taux: Math.round(((vente - achat) / vente) * 100), montant: vente - achat }
      : null;
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
    if (err) return setErreur(err);
    retenirLabo(v.laboratoire);
    retenirEmplacement(v.emplacement);
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
              placeholder="Doliprane, Amoxil… ou la molécule"
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
            <Raccourcis
              libelle="Dosages courants"
              options={DOSAGES}
              actif={v.dosage}
              onChoisir={(d) => setV({ ...v, dosage: d })}
            />
          </Champ>
          {propositions.length > 0 && (
            <div className="rounded-xl border border-dashed border-primary/40 bg-secondary/60 p-2 sm:col-span-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Remplir d&apos;un geste
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {propositions.map((x) => (
                  <button
                    key={`${x.nom}-${x.dosage}-${x.forme}`}
                    type="button"
                    onClick={() => remplir(x)}
                    className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-left hover:border-primary"
                  >
                    <span className="block text-sm font-bold">{nomAffiche(x.nom, x.dosage)}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {[x.forme, x.dci, libelleRegime(x.regime), x.frais && "au frais"]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
            <Raccourcis
              libelle="Formes courantes"
              options={FORMES_COURANTES.slice(0, 4)}
              actif={v.forme}
              onChoisir={(f) => setV({ ...v, forme: f })}
            />
          </Champ>
          <Champ libelle="Laboratoire">
            <input value={v.laboratoire} onChange={changer("laboratoire")} className="app-field" />
            <Raccourcis
              libelle="Laboratoires récents"
              options={laboratoires.slice(0, 3)}
              actif={v.laboratoire}
              onChoisir={(l) => setV({ ...v, laboratoire: l })}
            />
          </Champ>
          <Champ libelle="Emplacement">
            <input
              value={v.emplacement}
              onChange={changer("emplacement")}
              className="app-field"
              placeholder="Rayon B, tiroir 3"
            />
            <Raccourcis
              libelle="Emplacements récents"
              options={emplacements.slice(0, 3)}
              actif={v.emplacement}
              onChoisir={(e) => setV({ ...v, emplacement: e })}
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
            {Number.isFinite(achat) && achat > 0 && (
              <Raccourcis
                libelle="Prix de vente au coefficient"
                actif={v.prixVente}
                onChoisir={(p) => setV({ ...v, prixVente: p })}
                options={COEFFICIENTS.map((c) => ({
                  valeur: String(prixAuCoefficient(achat, c)),
                  libelle: `×${String(c).replace(".", ",")} · ${prixAuCoefficient(achat, c).toLocaleString("fr-FR")}`,
                }))}
              />
            )}
          </Champ>
          <Champ libelle="Alerte sous">
            <input
              inputMode="numeric"
              value={v.seuil}
              onChange={changer("seuil")}
              className="app-field"
            />
            <Raccourcis
              libelle="Seuils courants"
              options={SEUILS}
              actif={v.seuil}
              onChoisir={(n) => setV({ ...v, seuil: n })}
            />
          </Champ>
          <Champ libelle="Code-barres">
            <span className="flex gap-1.5">
              <input
                value={v.codeBarres}
                onChange={changer("codeBarres")}
                // Une douchette finit par Entrée : elle ne doit pas
                // enregistrer la fiche à moitié remplie.
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                placeholder="Scannez la boîte"
                className="app-field min-w-0 flex-1"
              />
              <BoutonScan
                onCode={(code) => setV({ ...v, codeBarres: code })}
                titre="Scanner le code de la boîte"
              />
            </span>
          </Champ>
        </div>
        {marge && (
          <p
            className={`-mt-2 text-xs font-semibold ${marge.taux < 0 ? "t-danger" : "text-muted-foreground"}`}
          >
            {marge.taux < 0
              ? "Attention : le prix de vente est sous le prix d'achat."
              : `Marge : ${marge.taux} % · ${marge.montant.toLocaleString("fr-FR")} Ar par unité`}
          </p>
        )}

        <Champ libelle="Notes (posologie, précautions…)">
          <textarea value={v.notes} onChange={changer("notes")} rows={2} className="app-field" />
        </Champ>
        {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}
      </form>
    </Modal>
  );
};
