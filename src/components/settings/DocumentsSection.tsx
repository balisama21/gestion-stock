import React, { useMemo, useState } from "react";
import { Building2, FileText, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { SettingsBlock, SettingsRow, SettingsSection, SettingsToggle } from "./primitives";
import { IdentiteDocuments } from "./IdentiteDocuments";
import { ReglagesParDocument } from "./ReglagesParDocument";
import { ChoixDisposition } from "./ChoixDisposition";
import { COULEURS_DOCUMENT, LOGOS_DOCUMENT, MODELES_DOCUMENT } from "./choixDocuments";
import type { Personnalisation } from "../../lib/personnalisation";
import type { Product, Sale, StoreSettings } from "../../types";
import { DocumentPreview, type FormatDocument } from "../../features/documents/DocumentPreview";
import { apercuDesReglages } from "../../features/documents/lib/apercuDesReglages";
import { LIBELLE_ECHEANCE, type Echeance } from "../../features/documents/lib/format";
import type { IdentiteBoutique } from "../../features/documents/lib/identite";
import type { ReglagesParType, TypeDocumentV3 } from "../../features/documents/lib/typesDocument";
import type { MisesEnPage } from "../../features/documents/lib/miseEnPage";
import type { ReglagesLibres } from "../../features/documents/lib/disposition";
import {
  lireReglagesDocuments,
  REGLAGES_DOCUMENTS_PAR_DEFAUT,
  type ChoixLogo,
  type ModeleDocument,
  type ReglagesDocuments,
} from "../../features/documents/lib/reglages";

/**
 * PARAMÈTRES → DOCUMENTS
 *
 * ── CES RÉGLAGES APPARTIENNENT À LA BOUTIQUE ───────────────────────
 *
 * Pas à la personne. Un vendeur ne choisit pas son modèle de facture
 * à chaque vente, sans quoi deux clients du même magasin recevraient
 * deux papiers différents le même jour. C'est aussi pourquoi cet
 * écran est réservé au propriétaire, comme les autres réglages de
 * boutique.
 *
 * ── UNE SEULE ÉCRITURE, ET ELLE FUSIONNE ───────────────────────────
 *
 * Tout tient dans `stores.personnalisation`, sous la clé `documents`.
 * Aucune colonne, aucune table : la colonne existe, elle est en jsonb,
 * et deux autres sections s'en servent déjà ainsi. L'enregistrement
 * recopie l'objet entier et ne remplace que sa propre clé — le
 * vocabulaire et les rappels des autres écrans sont préservés, ce
 * qu'un test de `lirePersonnalisation` verrouille.
 *
 * ── L'APERÇU MONTRE UNE VRAIE VENTE, ET LE BON DOCUMENT ────────────
 *
 * La dernière de la boutique, en lecture seule. Pas de client
 * inventé, pas de montant d'exemple : on règle un document en le
 * voyant tel qu'il sortira vraiment. Quand la boutique n'a encore
 * rien vendu, l'aperçu le dit et s'efface plutôt que de montrer une
 * facture qui n'existe pas.
 *
 * Il suit le type qu'on RÈGLE, et il est posé dans la section où on
 * le règle. Une seule feuille en bas de page, toujours une facture,
 * laissait croire que rien ne bougeait quand on réglait un devis.
 */

interface DocumentsSectionProps {
  personnalisation: Personnalisation;
  onSave: (p: Personnalisation) => Promise<void> | void;
  settings?: StoreSettings;
  /** Les ventes de la boutique, pour l'aperçu. Jamais modifiées. */
  sales: Sale[];
  products: Product[];
}

const MODELES = MODELES_DOCUMENT;
const COULEURS = COULEURS_DOCUMENT;
const LOGOS = LOGOS_DOCUMENT;

const OPTIONS: { cle: keyof ReglagesDocuments["options"]; nom: string; note: string }[] = [
  {
    cle: "tva",
    nom: "TVA",
    note: "Comprise dans le total, jamais ajoutée. Sans effet si le taux de la boutique est à zéro.",
  },
  { cle: "nif", nom: "NIF et STAT", note: "Attendus sur une facture d'entreprise." },
  {
    cle: "montantEnLettres",
    nom: "Montant en lettres",
    note: "« Arrêtée la présente facture à la somme de… » C'est la mention qui tranche en cas de désaccord.",
  },
  {
    cle: "tamponPaiement",
    nom: "Tampon de paiement",
    note: "« Payé » ou « Reste à payer », en haut à droite.",
  },
  { cle: "signature", nom: "Signature", note: "La place du cachet et de la signature." },
  { cle: "conditions", nom: "Conditions de règlement", note: "Le texte légal en bas de page." },
];

const APERCUS: { cle: FormatDocument; nom: string }[] = [
  { cle: "a4", nom: "Feuille A4" },
  { cle: "t80", nom: "Ticket 80 mm" },
  { cle: "t58", nom: "Ticket 58 mm" },
];

export const DocumentsSection: React.FC<DocumentsSectionProps> = ({
  personnalisation,
  onSave,
  settings,
  sales,
  products,
}) => {
  const enregistres = useMemo(
    () => lireReglagesDocuments(personnalisation.documents),
    [personnalisation.documents],
  );
  const [brouillon, setBrouillon] = useState<ReglagesDocuments>(enregistres);
  const [apercu, setApercu] = useState<FormatDocument>("a4");
  /*
   * Le document réglé est tenu ICI et non dans la section qui le
   * choisit : l'aperçu doit montrer celui qu'on est en train de
   * régler, et c'est cet écran qui le construit.
   */
  const [typeRegle, setTypeRegle] = useState<TypeDocumentV3>("facture");
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(false);

  const modifie = JSON.stringify(brouillon) !== JSON.stringify(enregistres);
  const parDefaut = JSON.stringify(brouillon) === JSON.stringify(REGLAGES_DOCUMENTS_PAR_DEFAUT);

  const changer = (patch: Partial<ReglagesDocuments>) => setBrouillon((b) => ({ ...b, ...patch }));
  const changerOption = (cle: keyof ReglagesDocuments["options"], valeur: boolean) =>
    setBrouillon((b) => ({ ...b, options: { ...b.options, [cle]: valeur } }));
  const changerTicket = (patch: Partial<ReglagesDocuments["ticket"]>) =>
    setBrouillon((b) => ({ ...b, ticket: { ...b.ticket, ...patch } }));
  const changerIdentite = (identite: IdentiteBoutique) => setBrouillon((b) => ({ ...b, identite }));
  const changerTypes = (types: ReglagesParType) => setBrouillon((b) => ({ ...b, types }));
  const changerPages = (pages: MisesEnPage) => setBrouillon((b) => ({ ...b, pages }));
  const changerLibre = (libre: ReglagesLibres) => setBrouillon((b) => ({ ...b, libre }));

  const enregistrer = async (version?: ReglagesDocuments) => {
    const aEcrire = version ?? brouillon;
    if (version) setBrouillon(version);
    const auDefaut = JSON.stringify(aEcrire) === JSON.stringify(REGLAGES_DOCUMENTS_PAR_DEFAUT);
    setEnCours(true);
    /*
     * Le reste de la personnalisation est RECOPIÉ : cet écran ne règle
     * que les documents et ne doit pas emporter le vocabulaire ni les
     * rappels au passage.
     *
     * Revenu aux valeurs du logiciel, on RETIRE la clé plutôt que
     * d'écrire les mêmes valeurs : une clé absente veut dire « comme
     * prévu », et suivra donc une évolution future des défauts.
     */
    const suite: Personnalisation = { ...personnalisation };
    if (auDefaut) delete suite.documents;
    else suite.documents = aEcrire as unknown as Personnalisation[string];

    await onSave(suite);
    setEnCours(false);
    setFait(true);
    window.setTimeout(() => setFait(false), 3000);
  };

  /**
   * Le document réglé, prêt à être mis en page.
   *
   * Il suit le type choisi juste au-dessus : régler un devis et voir
   * une facture ne renseignait sur rien. Sans aucune vente, pas
   * d'aperçu : mieux vaut le dire que montrer une pièce inventée.
   */
  const vu = useMemo(
    () =>
      apercuDesReglages({
        type: typeRegle,
        sales,
        produits: products,
        boutique: settings,
        reglages: brouillon,
      }),
    [typeRegle, sales, products, settings, brouillon],
  );

  const vuTicket = useMemo(
    () =>
      apercuDesReglages({
        type: "recu",
        sales,
        produits: products,
        boutique: settings,
        reglages: brouillon,
      }),
    [sales, products, settings, brouillon],
  );

  /** Un rouleau n'a de sens que sur ce qui s'imprime en caisse. */
  const format: FormatDocument =
    typeRegle === "facture" || typeRegle === "recu" || typeRegle === "commission" ? apercu : "a4";

  const blocApercu = (
    <SettingsBlock>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Aperçu</p>
        {(typeRegle === "facture" || typeRegle === "recu" || typeRegle === "commission") && (
          <div className="flex flex-wrap gap-2">
            {APERCUS.map((a) => (
              <button
                key={a.cle}
                type="button"
                aria-pressed={apercu === a.cle}
                onClick={() => setApercu(a.cle)}
                className={apercu === a.cle ? "app-btn-primary" : "app-btn-secondary"}
              >
                {a.nom}
              </button>
            ))}
          </div>
        )}
      </div>
      {vu ? (
        <>
          <DocumentPreview
            document={vu.document}
            reglages={brouillon}
            format={format}
            sansActions
          />
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {vu.mention} Rien n&apos;est enregistré tant que vous n&apos;avez pas cliqué sur
            Enregistrer.
          </p>
        </>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {typeRegle === "achat"
            ? "Ce document garde sa présentation d'origine : son aperçu se trouve là où on l'imprime, dans le catalogue produits."
            : "L'aperçu montre une vraie vente de la boutique. Enregistrez-en une et elle apparaîtra ici."}
        </p>
      )}
    </SettingsBlock>
  );

  return (
    <div className="space-y-5">
      {/* ── NIVEAU 1 ──────────────────────────────────────────────
          Le socle : ce qui est saisi ici part sur TOUS les documents.
          Il vient donc avant le choix du modèle, qui n'en est que la
          mise en page. Le bouton « Enregistrer » de la section
          suivante vaut pour tout l'écran, comme il vaut déjà pour les
          réglages du ticket, plus bas. */}
      <SettingsSection
        title="Identité de la boutique"
        icon={<Building2 className="h-4 w-4" />}
        description="Le point commun de tous vos documents : contacts, site, réseaux, coordonnées de paiement. Saisi une fois, repris partout."
      >
        <IdentiteDocuments
          identite={brouillon.identite}
          onChange={changerIdentite}
          settings={settings}
        />
      </SettingsSection>

      <SettingsSection
        title="Documents"
        icon={<FileText className="h-4 w-4" />}
        description="Le modèle, la couleur et les mentions de vos factures, devis, reçus et tickets."
        aside={
          <div className="flex flex-wrap items-center gap-2">
            {!parDefaut && (
              <button
                type="button"
                onClick={() => setBrouillon(REGLAGES_DOCUMENTS_PAR_DEFAUT)}
                className="app-btn-secondary"
              >
                <RotateCcw className="h-4 w-4" />
                Valeurs d&apos;origine
              </button>
            )}
            <button
              type="button"
              onClick={() => void enregistrer()}
              disabled={!modifie || enCours}
              className="app-btn-primary"
            >
              <Save className="h-4 w-4" />
              {enCours ? "Enregistrement…" : fait ? "Enregistré" : "Enregistrer"}
            </button>
          </div>
        }
      >
        {/* ── L'interrupteur, en premier ────────────────────────────
            C'est le réglage qu'on vient chercher en urgence : il doit
            être le premier sous la main, pas au fond de l'écran. */}
        <SettingsRow
          label="Nouveaux documents"
          hint="Décochez pour revenir immédiatement aux anciennes factures, sans rien réinstaller. Le reste de l'application ne change pas."
        >
          <SettingsToggle
            checked={brouillon.actif !== false}
            onChange={(v) => changer({ actif: v ? true : false })}
            label="Utiliser les nouveaux documents"
          />
        </SettingsRow>

        <SettingsBlock>
          <p className="mb-2 text-sm font-semibold text-foreground">Modèle</p>
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            Il vaut pour toute la boutique. Sur une vente précise, on peut encore imprimer avec un
            autre modèle sans toucher à ce réglage.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MODELES.map((m) => {
              const choisi = brouillon.modele === m.cle;
              return (
                <button
                  key={m.cle}
                  type="button"
                  aria-pressed={choisi}
                  onClick={() => changer({ modele: m.cle })}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    choisi
                      ? "border-success-border bg-success-soft"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <span className="block text-sm font-semibold text-foreground">{m.nom}</span>
                  <span className="block text-xs text-muted-foreground">{m.note}</span>
                </button>
              );
            })}
          </div>
        </SettingsBlock>

        <SettingsBlock>
          <p className="mb-3 text-sm font-semibold text-foreground">Couleur du document</p>
          <div className="flex flex-wrap gap-2.5">
            {COULEURS.map((c) => {
              const choisie = brouillon.couleur === c.valeur;
              return (
                <button
                  key={c.valeur}
                  type="button"
                  aria-pressed={choisie}
                  aria-label={c.nom}
                  title={c.nom}
                  onClick={() => changer({ couleur: c.valeur })}
                  style={{ background: c.valeur }}
                  className={`h-9 w-9 rounded-full border-2 ${
                    choisie ? "border-foreground" : "border-transparent"
                  }`}
                />
              );
            })}
          </div>
        </SettingsBlock>

        <SettingsRow label="Logo" htmlFor="doc-logo" hint="Ce qui s'imprime en haut à gauche.">
          <select
            id="doc-logo"
            value={brouillon.logo}
            onChange={(e) => changer({ logo: e.target.value as ChoixLogo })}
            className="app-field"
          >
            {LOGOS.map((l) => (
              <option key={l.cle} value={l.cle}>
                {l.nom}
              </option>
            ))}
          </select>
        </SettingsRow>

        {OPTIONS.map((o) => (
          <SettingsRow key={o.cle} label={o.nom} hint={o.note}>
            <SettingsToggle
              checked={brouillon.options[o.cle]}
              onChange={(v) => changerOption(o.cle, v)}
              label={o.nom}
            />
          </SettingsRow>
        ))}

        <SettingsRow
          label="Préfixe des factures"
          htmlFor="doc-prefixe"
          hint="Il habille le numéro de la vente sans le remplacer : « FAC- » donne « FAC-V026 », qui reste cherchable dans la liste des ventes. Chaque autre document a le sien, dans « Réglages par document » ci-dessous."
        >
          <input
            id="doc-prefixe"
            type="text"
            value={brouillon.prefixeFacture}
            onChange={(e) => changer({ prefixeFacture: e.target.value })}
            className="app-field"
          />
        </SettingsRow>

        <SettingsRow
          label="Échéance"
          htmlFor="doc-echeance"
          hint="La date se calcule depuis celle de la vente. Changer ce réglage change donc l'échéance des factures qu'on réimprime."
        >
          <select
            id="doc-echeance"
            value={brouillon.echeance}
            onChange={(e) => changer({ echeance: e.target.value as Echeance })}
            className="app-field"
          >
            {(Object.keys(LIBELLE_ECHEANCE) as Echeance[]).map((e) => (
              <option key={e} value={e}>
                {LIBELLE_ECHEANCE[e]}
              </option>
            ))}
          </select>
        </SettingsRow>

        <SettingsRow label="Mot de fin" htmlFor="doc-merci" stacked>
          <input
            id="doc-merci"
            type="text"
            value={brouillon.motDeFin}
            onChange={(e) => changer({ motDeFin: e.target.value })}
            className="app-field"
          />
        </SettingsRow>

        <SettingsRow
          label="Pied de page"
          htmlFor="doc-pied"
          hint="Laissé vide, il reprend le nom, l'adresse et le téléphone de la boutique."
          stacked
        >
          <input
            id="doc-pied"
            type="text"
            value={brouillon.piedDePage}
            onChange={(e) => changer({ piedDePage: e.target.value })}
            className="app-field"
            placeholder="Nom · adresse · téléphone de la boutique"
          />
        </SettingsRow>
      </SettingsSection>

      {/* ── NIVEAU 2 ──────────────────────────────────────────────
          Ce qui distingue une facture d'un devis. Placé après les
          réglages de la boutique, dont il hérite. */}
      <SettingsSection
        title="Réglages par document"
        icon={<SlidersHorizontal className="h-4 w-4" />}
        description="Titre, numérotation, échéance, conditions : ce qui appartient à un type de document et pas aux autres. Tant qu'un document n'est pas personnalisé, il suit les réglages ci-dessus."
      >
        <ReglagesParDocument
          reglages={brouillon}
          onChange={changerTypes}
          onChangePages={changerPages}
          type={typeRegle}
          onType={setTypeRegle}
          apercu={blocApercu}
          document={vu?.document ?? null}
          onChangeLibre={changerLibre}
          onEnregistrerLibre={(libre) => enregistrer({ ...brouillon, libre })}
        />
      </SettingsSection>

      <SettingsSection
        title="Ticket de caisse"
        icon={<FileText className="h-4 w-4" />}
        description="Le ticket n'est pas une facture : format étroit, imprimante thermique, pas de mentions longues. Il a ses propres réglages."
      >
        <SettingsRow label="Largeur du rouleau" hint="Celle de votre imprimante de caisse.">
          <div className="flex gap-2">
            {([80, 58] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={brouillon.ticket.largeur === l}
                onClick={() => changerTicket({ largeur: l })}
                className={brouillon.ticket.largeur === l ? "app-btn-primary" : "app-btn-secondary"}
              >
                {l} mm
              </button>
            ))}
          </div>
        </SettingsRow>

        <SettingsRow
          label="Détail des articles"
          hint="« 3 × 1 500 » plutôt que « 3 pièces » : le client vérifie le calcul sans sa calculette."
        >
          <SettingsToggle
            checked={brouillon.ticket.detailLignes}
            onChange={(v) => changerTicket({ detailLignes: v })}
            label="Détail des articles"
          />
        </SettingsRow>

        <SettingsRow
          label="Code-barres"
          hint="Le numéro de vente, lisible par une douchette : il retrouve la vente en un scan."
        >
          <SettingsToggle
            checked={brouillon.ticket.codeBarres}
            onChange={(v) => changerTicket({ codeBarres: v })}
            label="Code-barres"
          />
        </SettingsRow>

        <SettingsRow
          label="Message de bas de ticket"
          htmlFor="doc-ticket-message"
          hint="Laissé vide, il reprend celui des reçus, réglé dans « Ma boutique »."
          stacked
        >
          <input
            id="doc-ticket-message"
            type="text"
            value={brouillon.ticket.message}
            onChange={(e) => changerTicket({ message: e.target.value })}
            className="app-field"
            placeholder={settings?.receiptFooter || "Merci et à bientôt !"}
          />
        </SettingsRow>

        <ChoixDisposition
          reglages={brouillon}
          type="ticket"
          document={vuTicket?.document ?? null}
          onChange={changerLibre}
          onEnregistrer={(libre) => enregistrer({ ...brouillon, libre })}
        />
      </SettingsSection>
    </div>
  );
};
