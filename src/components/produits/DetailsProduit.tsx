import React, { useRef, useState } from "react";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { adresseImageProduit, envoyerFichier, supprimerFichier } from "../../lib/stockageFichiers";
import type { Database } from "../../lib/database.types";
import {
  TYPES_PRODUIT,
  UNITES,
  optionsCategories,
  type ValeursDetails,
} from "../../lib/detailsProduit";

type Categorie = Database["public"]["Tables"]["categories"]["Row"];
type Fournisseur = Database["public"]["Tables"]["suppliers"]["Row"];
type ImageProduit = Database["public"]["Tables"]["product_images"]["Row"];

interface DetailsProduitProps {
  valeurs: ValeursDetails;
  onChange: (v: ValeursDetails) => void;
  categories: Categorie[];
  fournisseurs: Fournisseur[];
  /** Les images déjà attachées à ce produit. */
  images: ImageProduit[];
  storeId: string | null;
  productId: string | null;
  onAddImage: (
    productId: string,
    chemin: string,
    ordre?: number,
  ) => Promise<{ error: string | null }>;
  onDeleteImage: (id: string) => Promise<{ error: string | null }>;
}

/**
 * Ce qui décrit un produit, par opposition à ce qui le compte.
 *
 * Le formulaire au-dessus porte la désignation, les prix et le seuil
 * d'alerte : autant de valeurs qui entrent dans le stock et dans la
 * caisse, et qui s'écrivent par une fonction verrouillée côté base. Ici
 * on ne touche à rien de tout cela — référence, catégorie, unité, TVA,
 * photos. C'est ce qui permet de les enregistrer par une écriture
 * directe, sans ouvrir le chemin de l'argent.
 *
 * La première image tient lieu de vignette : elle est simplement la
 * première de la liste, réordonnable en la promouvant.
 */
export const DetailsProduit: React.FC<DetailsProduitProps> = ({
  valeurs,
  onChange,
  categories,
  fournisseurs,
  images,
  storeId,
  productId,
  onAddImage,
  onDeleteImage,
}) => {
  const [envoi, setEnvoi] = useState(false);
  const [erreurImage, setErreurImage] = useState<string | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);

  const modifier = (patch: Partial<ValeursDetails>) => onChange({ ...valeurs, ...patch });

  const options = React.useMemo(() => optionsCategories(categories), [categories]);

  const choisirImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier || !storeId || !productId) return;

    setEnvoi(true);
    setErreurImage(null);
    const { chemin, error } = await envoyerFichier(
      "produits",
      storeId,
      `produits/${productId}`,
      fichier,
    );
    if (error || !chemin) {
      setEnvoi(false);
      setErreurImage(error ?? "Cette image n'a pas pu être envoyée.");
      return;
    }
    const suite = await onAddImage(productId, chemin, images.length);
    setEnvoi(false);
    if (suite.error) {
      // Le fichier est parti mais la fiche ne le connaît pas : on le
      // retire, sinon il resterait à occuper de la place sans que rien
      // ne puisse plus le désigner.
      await supprimerFichier("produits", chemin);
      setErreurImage(suite.error);
    }
  };

  const retirerImage = async (image: ImageProduit) => {
    setErreurImage(null);
    const { error } = await onDeleteImage(image.id);
    if (error) {
      setErreurImage(error);
      return;
    }
    await supprimerFichier("produits", image.chemin);
  };

  return (
    <div className="space-y-5 border-t border-border pt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Fiche produit
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pd-sku" className="mb-1 block text-xs font-medium text-muted-foreground">
            Référence
          </label>
          <input
            id="pd-sku"
            type="text"
            placeholder="REF-001"
            className="app-field font-mono"
            value={valeurs.sku}
            onChange={(e) => modifier({ sku: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="pd-code" className="mb-1 block text-xs font-medium text-muted-foreground">
            Code-barres
          </label>
          <input
            id="pd-code"
            type="text"
            inputMode="numeric"
            placeholder="3760123456789"
            className="app-field font-mono"
            value={valeurs.code_barres}
            onChange={(e) => modifier({ code_barres: e.target.value })}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            La lecture au scanner arrivera avec le mode de vente rapide.
          </p>
        </div>

        <div>
          <label htmlFor="pd-cat" className="mb-1 block text-xs font-medium text-muted-foreground">
            Catégorie
          </label>
          <select
            id="pd-cat"
            className="app-field"
            value={valeurs.category_id}
            onChange={(e) => modifier({ category_id: e.target.value })}
          >
            <option value="">Sans catégorie</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.libelle}
              </option>
            ))}
          </select>
          {options.length === 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Aucune catégorie : créez-les dans Paramètres → Catégories.
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="pd-fournisseur"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Fournisseur
          </label>
          <select
            id="pd-fournisseur"
            className="app-field"
            value={valeurs.supplier_id}
            onChange={(e) => modifier({ supplier_id: e.target.value })}
          >
            <option value="">Aucun</option>
            {fournisseurs
              .filter((f) => f.statut !== "inactif")
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label htmlFor="pd-type" className="mb-1 block text-xs font-medium text-muted-foreground">
            Type
          </label>
          <select
            id="pd-type"
            className="app-field"
            value={valeurs.type_produit}
            onChange={(e) => modifier({ type_produit: e.target.value })}
          >
            {TYPES_PRODUIT.map((t) => (
              <option key={t.valeur} value={t.valeur}>
                {t.libelle}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {TYPES_PRODUIT.find((t) => t.valeur === valeurs.type_produit)?.aide}
          </p>
        </div>
        <div>
          <label
            htmlFor="pd-unite"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Unité
          </label>
          <input
            id="pd-unite"
            type="text"
            list="pd-unites"
            placeholder="pièce, kg, litre…"
            className="app-field"
            value={valeurs.unite}
            onChange={(e) => modifier({ unite: e.target.value })}
          />
          <datalist id="pd-unites">
            {UNITES.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor="pd-tva" className="mb-1 block text-xs font-medium text-muted-foreground">
            TVA (%)
          </label>
          <input
            id="pd-tva"
            type="number"
            min={0}
            max={100}
            step="any"
            inputMode="decimal"
            className="app-field font-mono"
            value={valeurs.tva_rate}
            onChange={(e) => modifier({ tva_rate: e.target.value })}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Laissez vide pour appliquer le taux de la boutique.
          </p>
        </div>
        <div>
          <label
            htmlFor="pd-stockmax"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Stock maximum
          </label>
          <input
            id="pd-stockmax"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            className="app-field font-mono"
            value={valeurs.stock_max}
            onChange={(e) => modifier({ stock_max: e.target.value })}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="pd-desc" className="mb-1 block text-xs font-medium text-muted-foreground">
            Description
          </label>
          <textarea
            id="pd-desc"
            rows={2}
            className="app-field resize-none"
            value={valeurs.description}
            onChange={(e) => modifier({ description: e.target.value })}
          />
        </div>

        <div>
          <label
            htmlFor="pd-statut"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Statut
          </label>
          <select
            id="pd-statut"
            className="app-field"
            value={valeurs.statut}
            onChange={(e) => modifier({ statut: e.target.value })}
          >
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
          </select>
        </div>
      </div>

      {/* ── Les photos ── */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Photos {images.length > 0 && `(${images.length})`}
        </p>

        {!productId ? (
          <p className="text-[11px] text-muted-foreground">
            Les photos s&apos;ajoutent une fois le produit créé.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              {images.map((image, i) => (
                <figure key={image.id} className="relative">
                  <img
                    src={adresseImageProduit(image.chemin)}
                    alt=""
                    loading="lazy"
                    className="h-20 w-20 rounded-xl border border-border object-cover"
                  />
                  {i === 0 && (
                    <span
                      className="absolute left-1 top-1 rounded-md bg-success-soft px-1 py-0.5"
                      title="Vignette du produit"
                    >
                      <Star className="h-3 w-3 t-success" aria-label="Vignette du produit" />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => retirerImage(image)}
                    className="app-btn-icon absolute -right-2 -top-2 h-7 w-7 bg-card"
                    aria-label="Retirer cette photo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </figure>
              ))}

              <button
                type="button"
                onClick={() => champFichier.current?.click()}
                disabled={envoi}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:text-foreground"
              >
                {envoi ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <ImagePlus className="h-5 w-5" aria-hidden="true" />
                )}
                <span className="text-[10px]">{envoi ? "Envoi…" : "Ajouter"}</span>
              </button>
            </div>

            {/* Le champ natif reste hors du flux : son apparence n'est
                pas stylable, et le bouton ci-dessus le déclenche. */}
            <input
              ref={champFichier}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={choisirImage}
            />

            <p className="mt-2 text-[11px] text-muted-foreground">
              La première photo sert de vignette. Les images sont réduites à 1280 pixels avant
              l&apos;envoi.
            </p>
          </>
        )}

        {erreurImage && (
          <p role="alert" className="mt-2 text-xs t-danger">
            {erreurImage}
          </p>
        )}
      </div>
    </div>
  );
};
