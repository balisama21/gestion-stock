import React, { useRef, useState } from "react";
import { Eraser, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { adresseImageProduit, envoyerFichier, supprimerFichier } from "../../lib/stockageFichiers";
import { BoutonScan } from "../shared/BoutonScan";
import { SelecteurListe } from "../shared/SelecteurListe";
import { DetourerPhoto } from "./DetourerPhoto";
import type { Database } from "../../lib/database.types";
import {
  TYPES_PRODUIT,
  UNITES,
  optionsCategories,
  type ValeursDetails,
} from "../../lib/detailsProduit";

type Categorie = Database["public"]["Tables"]["categories"]["Row"];
type ImageProduit = Database["public"]["Tables"]["product_images"]["Row"];

interface DetailsProduitProps {
  valeurs: ValeursDetails;
  onChange: (v: ValeursDetails) => void;
  categories: Categorie[];
  /** Absente, le sélecteur ne propose pas d'ajouter. */
  onCreerCategorie?: (nom: string) => Promise<{ id: string | null; error: string | null }>;
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
  /**
   * Les photos choisies avant que le produit n'existe.
   *
   * Une photo a besoin d'un identifiant de produit pour être rangée et
   * rattachée. À la création, cet identifiant n'existe pas encore : le
   * champ affichait donc « les photos s'ajoutent une fois le produit
   * créé », ce qui est vrai mais oblige à revenir sur sa fiche, et ce
   * n'est pas ce qu'on attend d'un formulaire de création.
   *
   * On garde donc les fichiers en mémoire, avec leur aperçu, et l'écran
   * qui appelle ce composant les envoie juste après avoir créé le
   * produit — au moment où l'identifiant existe enfin.
   *
   * Absent : le champ retombe sur l'ancien message, ce qui laisse les
   * appels non encore adaptés se comporter comme avant.
   */
  photosEnAttente?: File[];
  onPhotosEnAttenteChange?: (fichiers: File[]) => void;
  /** Réapprovisionnement activé : `stock_max` devient le niveau cible. */
  reappro?: { seuil: number; cibleParDefaut: number };
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
  onCreerCategorie,
  images,
  storeId,
  productId,
  onAddImage,
  onDeleteImage,
  photosEnAttente = [],
  onPhotosEnAttenteChange,
  reappro,
}) => {
  const [envoi, setEnvoi] = useState(false);
  const [erreurImage, setErreurImage] = useState<string | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);

  const modifier = (patch: Partial<ValeursDetails>) => onChange({ ...valeurs, ...patch });

  const options = React.useMemo(() => optionsCategories(categories), [categories]);

  /** Le mode « on garde la photo sous le bras » : produit pas encore créé. */
  const enAttente = !productId && Boolean(onPhotosEnAttenteChange);

  /**
   * Les aperçus des photos en attente.
   *
   * Les adresses temporaires se révoquent quand la liste change ou que
   * le formulaire se ferme : sans cela, chaque photo choisie laisserait
   * son fichier en mémoire jusqu'au rechargement de la page.
   */
  const apercus = React.useMemo(
    () => photosEnAttente.map((f) => URL.createObjectURL(f)),
    [photosEnAttente],
  );
  React.useEffect(() => () => apercus.forEach((u) => URL.revokeObjectURL(u)), [apercus]);

  const nombrePhotos = images.length + photosEnAttente.length;

  const choisirImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier || !storeId) return;

    // Avant que le produit n'existe : on garde le fichier et on montre
    // l'aperçu tout de suite. Le contrôle du type se fait ici, pour ne
    // pas laisser découvrir un refus au moment de l'enregistrement.
    if (enAttente) {
      if (!fichier.type.startsWith("image/")) {
        setErreurImage("Seules les images JPEG, PNG, WebP ou AVIF sont acceptées.");
        return;
      }
      setErreurImage(null);
      onPhotosEnAttenteChange?.([...photosEnAttente, fichier]);
      return;
    }

    if (!productId) return;

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

  /**
   * La photo en cours de detourage — deja envoyee, ou encore en attente.
   *
   * Le FICHIER est porte ici, pas seulement la reference : une photo
   * deja envoyee doit etre relue depuis le stockage avant d'etre
   * retravaillee, et cette lecture a le droit d'echouer. Mieux vaut
   * qu'elle echoue a l'ouverture, avec un message, qu'au milieu du
   * traitement.
   */
  const [detourage, setDetourage] = React.useState<
    | { genre: "envoyee"; image: ImageProduit; fichier: File }
    | { genre: "attente"; index: number; fichier: File }
    | null
  >(null);

  const ouvrirDetourage = async (image: ImageProduit) => {
    setErreurImage(null);
    try {
      const reponse = await fetch(adresseImageProduit(image.chemin));
      if (!reponse.ok) throw new Error(String(reponse.status));
      const blob = await reponse.blob();
      setDetourage({
        genre: "envoyee",
        image,
        fichier: new File([blob], "photo", { type: blob.type || "image/jpeg" }),
      });
    } catch {
      setErreurImage("Cette photo n'a pas pu être relue pour le détourage.");
    }
  };

  /**
   * Garder la version detouree.
   *
   * L'ORDRE DES GESTES porte tout le filet de securite : on envoie le
   * nouveau fichier, on l'enregistre a la place de l'ancien dans la
   * fiche, et seulement APRES on efface l'ancien. Si quoi que ce soit
   * echoue en chemin, la photo d'origine est toujours la — et le
   * fichier a moitie envoye, lui, est retire.
   *
   * Le nouveau reprend l'`ordre` de l'ancien : une photo detouree ne
   * doit pas se retrouver en fin de liste et perdre son role de
   * vignette au passage.
   */
  const garderDetourage = async (detoure: File) => {
    if (!detourage) return;

    if (detourage.genre === "attente") {
      onPhotosEnAttenteChange?.(
        photosEnAttente.map((f, j) => (j === detourage.index ? detoure : f)),
      );
      return;
    }

    if (!storeId || !productId) return;
    const ancienne = detourage.image;

    const { chemin, error } = await envoyerFichier(
      "produits",
      storeId,
      `produits/${productId}`,
      detoure,
    );
    if (error || !chemin) throw new Error(error ?? "Cette image n'a pas pu être envoyée.");

    const ajout = await onAddImage(productId, chemin, ancienne.ordre);
    if (ajout.error) {
      await supprimerFichier("produits", chemin);
      throw new Error(ajout.error);
    }

    const retrait = await onDeleteImage(ancienne.id);
    if (retrait.error) throw new Error(retrait.error);
    await supprimerFichier("produits", ancienne.chemin);
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
      {detourage && (
        <DetourerPhoto
          open
          fichier={detourage.fichier}
          onClose={() => setDetourage(null)}
          onGarder={garderDetourage}
        />
      )}
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
          <div className="flex gap-2">
            <input
              id="pd-code"
              type="text"
              inputMode="numeric"
              placeholder="3760123456789"
              className="app-field font-mono"
              value={valeurs.code_barres}
              onChange={(e) => modifier({ code_barres: e.target.value })}
            />
            <BoutonScan
              onCode={(code) => modifier({ code_barres: code })}
              libelle="Scanner le code-barres du produit"
              titre="Code-barres du produit"
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Scannez l&apos;étiquette une fois ici, et le produit se retrouvera au code à la caisse.
          </p>
        </div>

        <SelecteurListe
          id="pd-cat"
          label="Catégorie"
          options={options.map((o) => ({ id: o.id, nom: o.libelle }))}
          valeur={valeurs.category_id || null}
          onChange={(id) => modifier({ category_id: id ?? "" })}
          onCreer={onCreerCategorie}
          libelleVide="Sans catégorie"
          placeholder="Chercher ou ajouter une catégorie…"
          aide={
            options.length === 0
              ? "Aucune catégorie encore. Tapez-en une pour la créer, ou passez par Paramètres → Listes."
              : undefined
          }
        />

        {/* Le fournisseur n'est plus ici : il l'était en double, et le
            champ du haut écrit désormais les deux colonnes. */}

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
            {reappro ? "Niveau cible de réapprovisionnement" : "Stock maximum"}
          </label>
          <input
            id="pd-stockmax"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            className="app-field font-mono"
            value={valeurs.stock_max}
            placeholder={reappro ? `Par défaut : ${reappro.cibleParDefaut}` : undefined}
            onChange={(e) => modifier({ stock_max: e.target.value })}
          />
          {reappro && (
            <p className="mt-1 text-xs text-muted-foreground">
              {valeurs.stock_max.trim() !== "" &&
              Number(valeurs.stock_max) > 0 &&
              Number(valeurs.stock_max) <= reappro.seuil
                ? `Au niveau du seuil (${reappro.seuil}) ou en dessous : le produit restera en alerte après réapprovisionnement.`
                : "Stock visé après réapprovisionnement. Vide : la règle de la boutique."}
            </p>
          )}
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
          Photos {nombrePhotos > 0 && `(${nombrePhotos})`}
        </p>

        {!productId && !enAttente ? (
          <p className="text-[11px] text-muted-foreground">
            Les photos s&apos;ajoutent une fois le produit créé.
          </p>
        ) : (
          <>
            {/* Les deux cas — photo déjà envoyée, photo encore en
                attente — se présentent exactement pareil : même taille,
                même cadrage. Seule la légende du bas change, pour dire
                ce qui reste à faire.

                Ni filet ni fond, comme partout ailleurs : la photo se
                pose sur la page. Ici la corbeille en coin et l'étoile
                de la vignette restent, elles, et suffisent à dire où
                commence et où finit chaque image. */}
            <div className="flex flex-wrap gap-3">
              {images.map((image, i) => (
                <figure key={image.id} className="relative">
                  <img
                    src={adresseImageProduit(image.chemin)}
                    alt=""
                    loading="lazy"
                    className="h-20 w-20 object-contain"
                  />
                  {i === 0 && (
                    <span
                      className="absolute left-1 top-1 rounded-md bg-success-soft px-1 py-0.5"
                      title="Vignette du produit"
                    >
                      <Star className="h-3 w-3 t-success" aria-label="Vignette du produit" />
                    </span>
                  )}
                  {/* Deux gestes sur une photo : la detourer, la retirer.
                      Poses en coin plutot qu'en dessous — sous une
                      vignette de quatre-vingts pixels, deux boutons en
                      ligne seraient plus larges que la photo. */}
                  <button
                    type="button"
                    onClick={() => ouvrirDetourage(image)}
                    className="app-btn-icon absolute -left-2 -top-2 h-7 w-7 bg-card"
                    aria-label="Détourer cette photo"
                    title="Détourer : retirer le fond"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                  </button>
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

              {apercus.map((apercu, i) => (
                <figure key={apercu} className="relative">
                  <img src={apercu} alt="" className="h-20 w-20 object-contain" />
                  {images.length === 0 && i === 0 && (
                    <span
                      className="absolute left-1 top-1 rounded-md bg-success-soft px-1 py-0.5"
                      title="Vignette du produit"
                    >
                      <Star className="h-3 w-3 t-success" aria-label="Vignette du produit" />
                    </span>
                  )}
                  {/* Detourable avant meme d'etre envoyee : le fichier
                      est deja la, en memoire, et rien n'oblige a creer
                      le produit pour nettoyer sa photo. */}
                  <button
                    type="button"
                    onClick={() =>
                      setDetourage({ genre: "attente", index: i, fichier: photosEnAttente[i] })
                    }
                    className="app-btn-icon absolute -left-2 -top-2 h-7 w-7 bg-card"
                    aria-label="Détourer cette photo"
                    title="Détourer : retirer le fond"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onPhotosEnAttenteChange?.(photosEnAttente.filter((_, j) => j !== i))
                    }
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
              {enAttente && photosEnAttente.length > 0 && (
                <> Elles partiront à l&apos;enregistrement du produit.</>
              )}
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
