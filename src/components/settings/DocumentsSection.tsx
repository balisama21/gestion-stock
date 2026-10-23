import React, { useMemo, useState } from "react";
import {
  Building2,
  Check,
  Eye,
  EyeOff,
  Files,
  FileText,
  ListChecks,
  Palette,
  ReceiptText,
  RotateCcw,
  Save,
} from "lucide-react";
import { SettingsBlock, SettingsRow, SettingsSection, SettingsToggle } from "./primitives";
import { IdentiteDocuments } from "./IdentiteDocuments";
import { ReglagesParDocument } from "./ReglagesParDocument";
import { ChoixDisposition } from "./ChoixDisposition";
import { CachetsSection } from "./CachetsSection";
import { ApercuAncienTicket, FormatParDefaut, OptionsAnciensDocuments } from "./AnciensDocuments";
import type { Cachet } from "../../features/documents/lib/cachets";
import { COULEURS_DOCUMENT, LOGOS_DOCUMENT, MODELES_DOCUMENT } from "./choixDocuments";
import type { Personnalisation } from "../../lib/personnalisation";
import type { Product, Sale, StoreSettings } from "../../types";
import { DocumentPreview, type FormatDocument } from "../../features/documents/DocumentPreview";
import { apercuDesReglages } from "../../features/documents/lib/apercuDesReglages";
import { LIBELLE_ECHEANCE, type Echeance } from "../../features/documents/lib/format";
import type { IdentiteBoutique } from "../../features/documents/lib/identite";
import {
  DEFAUTS_TYPE,
  type ReglagesParType,
  type TypeDocumentV3,
} from "../../features/documents/lib/typesDocument";
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
 * PARAMÈTRES → FACTURES ET DOCUMENTS
 *
 * ── UN SEUL ÉCRAN, RANGÉ EN CINQ ONGLETS ───────────────────────────
 *
 * Il y avait deux onglets, « Reçus et factures » et « Documents », qui
 * réglaient en partie la même chose, et une seule page de près de huit
 * mille pixels sur téléphone. Tout tient désormais ici, rangé par
 * question qu'on se pose : à quoi ressemble le document, que dit-il,
 * qu'est-ce qui change d'un document à l'autre, le ticket, et qui est
 * la boutique. L'aperçu reste à côté — à droite sur grand écran, au
 * dessus sur téléphone — et suit l'onglet ouvert.
 *
 * ── CES RÉGLAGES APPARTIENNENT À LA BOUTIQUE ───────────────────────
 *
 * Pas à la personne. Un vendeur ne choisit pas son modèle de facture
 * à chaque vente, sans quoi deux clients du même magasin recevraient
 * deux papiers différents le même jour. C'est aussi pourquoi cet
 * écran est réservé au propriétaire, comme les autres réglages de
 * boutique. Seuls le format proposé à l'impression et les options de
 * l'ancien reçu restent rangés sur l'appareil, et l'écran le dit.
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
 */

interface DocumentsSectionProps {
  personnalisation: Personnalisation;
  onSave: (p: Personnalisation) => Promise<void> | void;
  settings?: StoreSettings;
  /** Les ventes de la boutique, pour l'aperçu. Jamais modifiées. */
  sales: Sale[];
  products: Product[];
  /** La boutique active : les cachets sont rangés sous son identifiant. */
  storeId?: string;
}

type Onglet = "apparence" | "contenu" | "types" | "ticket" | "identite";

const ONGLETS: { cle: Onglet; nom: string; icone: React.ReactNode }[] = [
  { cle: "apparence", nom: "Apparence", icone: <Palette className="h-4 w-4" /> },
  { cle: "contenu", nom: "Contenu", icone: <ListChecks className="h-4 w-4" /> },
  { cle: "types", nom: "Par document", icone: <Files className="h-4 w-4" /> },
  { cle: "ticket", nom: "Ticket de caisse", icone: <ReceiptText className="h-4 w-4" /> },
  { cle: "identite", nom: "Identité et cachets", icone: <Building2 className="h-4 w-4" /> },
];

const OPTIONS: { cle: keyof ReglagesDocuments["options"]; nom: string; note: string }[] = [
  {
    cle: "tva",
    nom: "TVA",
    note: "Comprise dans le total, jamais ajoutée. Sans effet si le taux est à zéro.",
  },
  { cle: "nif", nom: "NIF et STAT", note: "Attendus sur une facture d'entreprise." },
  {
    cle: "montantEnLettres",
    nom: "Montant en lettres",
    note: "« Arrêtée la présente facture à la somme de… »",
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
  { cle: "a4", nom: "A4" },
  { cle: "t80", nom: "80 mm" },
  { cle: "t58", nom: "58 mm" },
];

/** Un rouleau n'a de sens que sur ce qui s'imprime en caisse. */
const enRouleau = (t: TypeDocumentV3) => t === "facture" || t === "recu" || t === "commission";

/**
 * La silhouette d'un modèle, dans la couleur choisie.
 *
 * Un nom seul — « Bandeau », « Épuré » — ne dit pas à quoi ressemble
 * la feuille. Cette vignette n'est pas un aperçu : elle donne l'allure,
 * l'aperçu à côté donne le détail.
 */
const Miniature: React.FC<{ modele: ModeleDocument; couleur: string }> = ({ modele, couleur }) => {
  const trait = (largeur: string, fort = false) => (
    <span
      className="block h-[3px] rounded-full"
      style={{ width: largeur, background: fort ? couleur : "#d6ddd8" }}
    />
  );
  return (
    <span
      aria-hidden="true"
      className="relative mb-2 flex h-[68px] flex-col gap-[5px] overflow-hidden rounded-lg border border-border bg-white p-2"
    >
      {modele === "bandeau" && (
        <span className="-mx-2 -mt-2 mb-1 block h-4" style={{ background: couleur }} />
      )}
      {modele === "classique" && (
        <span className="mb-0.5 flex items-center gap-1.5">
          <span className="block h-3 w-3 rounded-sm" style={{ background: couleur }} />
          {trait("45%")}
        </span>
      )}
      {modele === "epure" && (
        <span className="mb-0.5 flex flex-col items-center gap-[4px]">
          {trait("40%", true)}
          {trait("24%")}
        </span>
      )}
      {modele === "compact"
        ? ["90%", "80%", "88%", "76%", "84%", "70%", "86%"].map((l, i) => (
            <span
              key={i}
              className="block h-[2px] rounded-full bg-[#d6ddd8]"
              style={{ width: l }}
            />
          ))
        : ["85%", "70%", "78%"].map((l, i) => <React.Fragment key={i}>{trait(l)}</React.Fragment>)}
      {modele !== "compact" && (
        <span className="mt-auto flex justify-end">{trait("30%", modele !== "epure")}</span>
      )}
    </span>
  );
};

export const DocumentsSection: React.FC<DocumentsSectionProps> = ({
  personnalisation,
  onSave,
  settings,
  sales,
  products,
  storeId,
}) => {
  const enregistres = useMemo(
    () => lireReglagesDocuments(personnalisation.documents),
    [personnalisation.documents],
  );
  const [brouillon, setBrouillon] = useState<ReglagesDocuments>(enregistres);
  const [onglet, setOnglet] = useState<Onglet>("apparence");
  const [apercu, setApercu] = useState<FormatDocument>("a4");
  /** Sur téléphone, l'aperçu se replie pour laisser la place aux réglages. */
  const [apercuOuvert, setApercuOuvert] = useState(false);
  /*
   * Le document réglé dans l'onglet « Par document » est tenu ICI : c'est
   * cet écran qui construit l'aperçu, et l'aperçu doit montrer celui
   * qu'on est en train de régler.
   */
  const [typeRegle, setTypeRegle] = useState<TypeDocumentV3>("facture");
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(false);

  const modifie = JSON.stringify(brouillon) !== JSON.stringify(enregistres);
  const parDefaut = JSON.stringify(brouillon) === JSON.stringify(REGLAGES_DOCUMENTS_PAR_DEFAUT);
  const actifs = brouillon.actif !== false;

  const changer = (patch: Partial<ReglagesDocuments>) => setBrouillon((b) => ({ ...b, ...patch }));
  const changerOption = (cle: keyof ReglagesDocuments["options"], valeur: boolean) =>
    setBrouillon((b) => ({ ...b, options: { ...b.options, [cle]: valeur } }));
  const changerTicket = (patch: Partial<ReglagesDocuments["ticket"]>) =>
    setBrouillon((b) => ({ ...b, ticket: { ...b.ticket, ...patch } }));
  const changerIdentite = (identite: IdentiteBoutique) => setBrouillon((b) => ({ ...b, identite }));
  const changerTypes = (types: ReglagesParType) => setBrouillon((b) => ({ ...b, types }));
  const changerPages = (pages: MisesEnPage) => setBrouillon((b) => ({ ...b, pages }));
  const changerLibre = (libre: ReglagesLibres) => setBrouillon((b) => ({ ...b, libre }));
  const changerCachets = (cachets: Cachet[]) => setBrouillon((b) => ({ ...b, cachets }));

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

  /*
   * Le document que montre l'aperçu suit l'onglet : celui qu'on règle
   * dans « Par document », le ticket dans « Ticket de caisse », la
   * facture partout ailleurs — c'est elle que les réglages communs
   * touchent le plus.
   */
  const typeVu: TypeDocumentV3 =
    onglet === "types" ? typeRegle : onglet === "ticket" ? "recu" : "facture";

  const vu = useMemo(
    () =>
      apercuDesReglages({
        type: typeVu,
        sales,
        produits: products,
        boutique: settings,
        reglages: brouillon,
      }),
    [typeVu, sales, products, settings, brouillon],
  );

  /** Les éditeurs de disposition travaillent sur leur propre document. */
  const vuRegle = useMemo(
    () =>
      typeRegle === typeVu
        ? vu
        : apercuDesReglages({
            type: typeRegle,
            sales,
            produits: products,
            boutique: settings,
            reglages: brouillon,
          }),
    [typeRegle, typeVu, vu, sales, products, settings, brouillon],
  );
  const vuTicket = useMemo(
    () =>
      typeVu === "recu"
        ? vu
        : apercuDesReglages({
            type: "recu",
            sales,
            produits: products,
            boutique: settings,
            reglages: brouillon,
          }),
    [typeVu, vu, sales, products, settings, brouillon],
  );

  const format: FormatDocument =
    onglet === "ticket"
      ? brouillon.ticket.largeur === 58
        ? "t58"
        : "t80"
      : enRouleau(typeVu)
        ? apercu
        : "a4";

  const nomVu = DEFAUTS_TYPE[typeVu].libelle;
  const nomFormat =
    format === "a4" ? "Feuille A4" : format === "t58" ? "Ticket 58 mm" : "Ticket 80 mm";

  /* ── L'APERÇU ──────────────────────────────────────────────────── */
  const blocApercu = (
    <section className="app-card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-soft t-success">
          <Eye className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-foreground">Aperçu</h2>
          <p className="truncate text-xs text-muted-foreground">
            {actifs ? `${nomVu} · ${nomFormat}` : "Ancien reçu"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setApercuOuvert((o) => !o)}
          aria-expanded={apercuOuvert}
          className="app-btn-secondary shrink-0 xl:hidden"
        >
          {apercuOuvert ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {apercuOuvert ? "Masquer" : "Afficher"}
        </button>
      </header>

      {/* Replié sur téléphone par le CSS seulement : le contenu reste
          construit, et s'ouvre donc sans attendre. */}
      <div className={`${apercuOuvert ? "" : "hidden"} px-4 py-4 sm:px-5 xl:block`}>
        {!actifs ? (
          <>
            {settings && <ApercuAncienTicket settings={settings} />}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Les nouveaux documents sont coupés : vos ventes s&apos;impriment avec l&apos;ancien
              reçu, réglé dans l&apos;onglet Contenu.
            </p>
          </>
        ) : (
          <>
            {onglet !== "ticket" && enRouleau(typeVu) && (
              <div
                role="group"
                aria-label="Format de l'aperçu"
                className="mb-3 flex gap-1 rounded-xl border border-border bg-muted p-1"
              >
                {APERCUS.map((a) => (
                  <button
                    key={a.cle}
                    type="button"
                    aria-pressed={apercu === a.cle}
                    onClick={() => setApercu(a.cle)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                      apercu === a.cle
                        ? "bg-card font-semibold text-primary shadow-sm"
                        : "font-medium text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {a.nom}
                  </button>
                ))}
              </div>
            )}
            {vu ? (
              <>
                <DocumentPreview
                  document={vu.document}
                  reglages={brouillon}
                  format={format}
                  sansActions
                />
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{vu.mention}</p>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {typeVu === "achat"
                  ? "Ce document garde sa présentation d'origine : son aperçu se trouve là où on l'imprime, dans le catalogue produits."
                  : "L'aperçu montre une vraie vente de la boutique. Enregistrez-en une et elle apparaîtra ici."}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );

  /* ── LES ONGLETS ───────────────────────────────────────────────── */
  const ongletApparence = (
    <SettingsSection
      title="Apparence"
      icon={<Palette className="h-4 w-4" />}
      description="Le style commun à vos factures, devis et reçus. Sur une vente précise, on peut encore imprimer avec un autre modèle."
    >
      <SettingsBlock>
        <p className="mb-3 text-sm font-semibold text-foreground">Modèle</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {MODELES_DOCUMENT.map((m) => {
            const choisi = brouillon.modele === m.cle;
            return (
              <button
                key={m.cle}
                type="button"
                aria-pressed={choisi}
                onClick={() => changer({ modele: m.cle })}
                className={`rounded-xl border p-2 text-left transition-colors ${
                  choisi
                    ? "border-primary bg-success-soft ring-1 ring-primary"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <Miniature modele={m.cle} couleur={brouillon.couleur} />
                <span className="flex items-center justify-between gap-1 px-0.5">
                  <span className="text-sm font-semibold text-foreground">{m.nom}</span>
                  {choisi && <Check className="h-4 w-4 shrink-0 t-success" />}
                </span>
                <span className="block px-0.5 text-xs text-muted-foreground">{m.note}</span>
              </button>
            );
          })}
        </div>
      </SettingsBlock>

      <SettingsBlock>
        <p className="mb-3 text-sm font-semibold text-foreground">
          Couleur
          <span className="ml-2 font-normal text-muted-foreground">
            {COULEURS_DOCUMENT.find((c) => c.valeur === brouillon.couleur)?.nom}
          </span>
        </p>
        <div className="flex flex-wrap gap-3">
          {COULEURS_DOCUMENT.map((c) => {
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
                className={`flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform ${
                  choisie
                    ? "ring-2 ring-foreground ring-offset-2 ring-offset-card"
                    : "hover:scale-105"
                }`}
              >
                {choisie && <Check className="h-4 w-4" />}
              </button>
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
          {LOGOS_DOCUMENT.map((l) => (
            <option key={l.cle} value={l.cle}>
              {l.nom}
            </option>
          ))}
        </select>
      </SettingsRow>
    </SettingsSection>
  );

  const ongletContenu = (
    <>
      <SettingsSection
        title="Ce qui s'imprime"
        icon={<ListChecks className="h-4 w-4" />}
        description="Les mentions de vos factures et devis. Chacune s'allume ou s'éteint d'un geste."
      >
        <SettingsBlock>
          <div className="grid gap-x-8 sm:grid-cols-2">
            {OPTIONS.map((o) => (
              <div
                key={o.cle}
                className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{o.nom}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{o.note}</p>
                </div>
                <SettingsToggle
                  size="sm"
                  checked={brouillon.options[o.cle]}
                  onChange={(v) => changerOption(o.cle, v)}
                  label={o.nom}
                />
              </div>
            ))}
          </div>
        </SettingsBlock>
      </SettingsSection>

      <SettingsSection
        title="Textes et numérotation"
        icon={<FileText className="h-4 w-4" />}
        description="Valables pour tous les documents, sauf ceux personnalisés dans l'onglet Par document."
      >
        <SettingsRow
          label="Préfixe des factures"
          htmlFor="doc-prefixe"
          hint="Il habille le numéro de la vente sans le remplacer : « FAC- » donne « FAC-V026 »."
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
          hint="Calculée depuis la date de la vente, y compris pour une facture réimprimée."
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

        <SettingsRow label="Mot de fin" htmlFor="doc-merci" hint="La phrase de remerciement.">
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
        >
          <input
            id="doc-pied"
            type="text"
            value={brouillon.piedDePage}
            onChange={(e) => changer({ piedDePage: e.target.value })}
            className="app-field"
            placeholder="Nom · adresse · téléphone"
          />
        </SettingsRow>
      </SettingsSection>

      {!actifs && (
        <SettingsSection
          title="Ancien reçu"
          icon={<ReceiptText className="h-4 w-4" />}
          description="Ce qui s'affiche sur le reçu utilisé tant que les nouveaux documents sont coupés."
        >
          <OptionsAnciensDocuments />
        </SettingsSection>
      )}
    </>
  );

  const ongletTypes = (
    <SettingsSection
      title="Par document"
      icon={<Files className="h-4 w-4" />}
      description="Ce qui distingue une facture d'un devis ou d'un bon de livraison : titre, numérotation, échéance, mise en page. Tant qu'un document n'est pas personnalisé, il suit les réglages communs."
    >
      <ReglagesParDocument
        reglages={brouillon}
        onChange={changerTypes}
        onChangePages={changerPages}
        type={typeRegle}
        onType={setTypeRegle}
        document={vuRegle?.document ?? null}
        onChangeLibre={changerLibre}
        onEnregistrerLibre={(libre) => enregistrer({ ...brouillon, libre })}
      />
    </SettingsSection>
  );

  const ongletTicket = (
    <SettingsSection
      title="Ticket de caisse"
      icon={<ReceiptText className="h-4 w-4" />}
      description="Format étroit, imprimante thermique, pas de mentions longues : le ticket a ses propres réglages."
    >
      <SettingsRow label="Largeur du rouleau" hint="Celle de votre imprimante de caisse.">
        <div className="flex gap-1 rounded-xl border border-border bg-muted p-1">
          {([80, 58] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={brouillon.ticket.largeur === l}
              onClick={() => changerTicket({ largeur: l })}
              className={`flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                brouillon.ticket.largeur === l
                  ? "bg-card font-semibold text-primary shadow-sm"
                  : "font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              {l} mm
            </button>
          ))}
        </div>
      </SettingsRow>

      <SettingsRow
        label="Format proposé à l'impression"
        hint="Celui qui s'ouvre en premier sur une vente. Enregistré tout de suite, sur cet appareil."
      >
        <FormatParDefaut />
      </SettingsRow>

      <SettingsRow
        label="Détail des articles"
        hint="« 3 × 1 500 » plutôt que « 3 pièces » : le client vérifie le calcul."
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
  );

  const ongletIdentite = (
    <>
      <SettingsSection
        title="Identité de la boutique"
        icon={<Building2 className="h-4 w-4" />}
        description="Contacts, site, réseaux, coordonnées de paiement. Saisis une fois, repris sur tous vos documents."
      >
        <IdentiteDocuments
          identite={brouillon.identite}
          onChange={changerIdentite}
          settings={settings}
        />
      </SettingsSection>

      <CachetsSection
        cachets={brouillon.cachets}
        storeId={storeId}
        onChange={changerCachets}
        onEnregistrer={(cachets) => enregistrer({ ...brouillon, cachets })}
      />
    </>
  );

  return (
    <div className="space-y-5">
      {/* ── L'interrupteur, en premier ────────────────────────────
          C'est le réglage qu'on vient chercher en urgence : il doit
          être le premier sous la main, pas au fond d'un onglet. */}
      <section className="app-card flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            actifs ? "bg-success-soft t-success" : "bg-muted text-muted-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Nouveaux documents</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {actifs
              ? "Factures, devis, reçus et tickets suivent les réglages ci-dessous."
              : "Coupés : vos ventes s'impriment avec l'ancien reçu, sans rien réinstaller."}
          </p>
        </div>
        <SettingsToggle
          checked={actifs}
          onChange={(v) => changer({ actif: v ? true : false })}
          label="Utiliser les nouveaux documents"
        />
      </section>

      <div
        role="tablist"
        aria-label="Réglages des documents"
        className="app-scroll-x -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        <div className="flex w-max min-w-full gap-1 rounded-2xl border border-border bg-muted p-1">
          {ONGLETS.map((o) => {
            const ouvert = onglet === o.cle;
            return (
              <button
                key={o.cle}
                type="button"
                role="tab"
                aria-selected={ouvert}
                onClick={() => setOnglet(o.cle)}
                className={`flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm transition-colors ${
                  ouvert
                    ? "bg-card font-semibold text-primary shadow-sm"
                    : "font-medium text-muted-foreground hover:text-foreground"
                }`}
              >
                {o.icone}
                {o.nom}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)] xl:items-start">
        <div className="xl:sticky xl:top-24 xl:col-start-2 xl:row-start-1">{blocApercu}</div>
        <div className="min-w-0 space-y-5 xl:col-start-1 xl:row-start-1">
          {onglet === "apparence" && ongletApparence}
          {onglet === "contenu" && ongletContenu}
          {onglet === "types" && ongletTypes}
          {onglet === "ticket" && ongletTicket}
          {onglet === "identite" && ongletIdentite}
        </div>
      </div>

      {/* ── Une seule barre d'enregistrement ──────────────────────
          Elle vaut pour les cinq onglets. Tant qu'il reste quelque
          chose à enregistrer, elle colle au bas de l'écran : on ne
          quitte pas un onglet en oubliant ce qu'on a changé dans un
          autre. */}
      <div className={modifie ? "sticky bottom-24 z-30 lg:bottom-4" : ""}>
        <div
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
          style={modifie ? { boxShadow: "var(--elev-3)" } : undefined}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            {modifie ? (
              <>
                <span className="h-2 w-2 shrink-0 rounded-full bg-warning" />
                Modifications non enregistrées
              </>
            ) : (
              <>
                <Check className="h-4 w-4 t-success" />
                {fait ? "Modifications enregistrées" : "Tout est enregistré"}
              </>
            )}
          </span>
          {/* Pendant une modification, « Annuler » suffit : la remise à
              zéro complète attend que la barre soit revenue au calme. */}
          <div className="flex gap-2">
            {!parDefaut && !modifie && (
              <button
                type="button"
                onClick={() => setBrouillon(REGLAGES_DOCUMENTS_PAR_DEFAUT)}
                className="app-btn-ghost"
              >
                <RotateCcw className="h-4 w-4" />
                Valeurs d&apos;origine
              </button>
            )}
            {modifie && (
              <button
                type="button"
                onClick={() => setBrouillon(enregistres)}
                disabled={enCours}
                className="app-btn-secondary flex-1 sm:flex-none"
              >
                Annuler
              </button>
            )}
            <button
              type="button"
              onClick={() => void enregistrer()}
              disabled={!modifie || enCours}
              className="app-btn-primary flex-1 sm:flex-none"
            >
              <Save className="h-4 w-4" />
              {enCours ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
