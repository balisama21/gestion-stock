import React from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { SettingsBlock, SettingsRow, SettingsToggle } from "./primitives";
import { COULEURS_DOCUMENT, MODELES_DOCUMENT } from "./choixDocuments";
import { EditeurMiseEnPage } from "./EditeurMiseEnPage";
import { ChoixDisposition } from "./ChoixDisposition";
import type { Document } from "../../features/documents/lib/buildDocument";
import type { ReglagesLibres } from "../../features/documents/lib/disposition";
import { useEditeurLibreVisible } from "../../features/documents/drapeauLibre";
import type { MisesEnPage } from "../../features/documents/lib/miseEnPage";
import { LIBELLE_ECHEANCE, type Echeance } from "../../features/documents/lib/format";
import type { ModeleDocument, ReglagesDocuments } from "../../features/documents/lib/reglages";
import { ouvrirPersonnalisation, resoudreType } from "../../features/documents/lib/resolveur";
import {
  DEFAUTS_TYPE,
  numeroDuDocument,
  TYPES_DISPONIBLES,
  type ReglagesParType,
  type ReglagesType,
  type TypeDocumentV3,
} from "../../features/documents/lib/typesDocument";

/**
 * PARAMÈTRES → DOCUMENTS → RÉGLAGES PAR DOCUMENT (NIVEAU 2)
 *
 * ── TANT QU'ON N'OUVRE PAS, RIEN NE CHANGE ─────────────────────────
 *
 * Un type non personnalisé n'existe pas dans l'enregistrement : il
 * suit la boutique, et le logiciel pour ce qui lui est propre — son
 * titre, sa numérotation, ses conditions. « Personnaliser ce
 * document » recopie ces valeurs pour qu'on parte de ce qu'on voit,
 * et « Revenir aux réglages de la boutique » retire la clé d'un clic.
 *
 * ── CE QUI EST PROPOSÉ DÉPEND DU DOCUMENT ──────────────────────────
 *
 * Une échéance n'a de sens que sur une facture, une durée de validité
 * que sur un devis, et un préfixe que sur une pièce qui porte un
 * numéro — le bon de commande fournisseur n'en porte aucun. Afficher
 * un champ sans effet ferait croire à une fonction qui n'existe pas.
 */

interface Props {
  reglages: ReglagesDocuments;
  onChange: (types: ReglagesParType) => void;
  onChangePages: (pages: MisesEnPage) => void;
  /**
   * Le document réglé, et de quoi en changer.
   *
   * Tenu par l'écran parent et non ici : l'aperçu doit montrer le même
   * document que celui qu'on règle, et c'est le parent qui le
   * construit.
   */
  type: TypeDocumentV3;
  onType: (type: TypeDocumentV3) => void;
  /** L'aperçu du document réglé, posé sous le choix du type. */
  apercu?: React.ReactNode;
  /** Le document de l'aperçu, repris par l'éditeur libre. */
  document?: Document | null;
  onChangeLibre?: (libre: ReglagesLibres) => void;
  onEnregistrerLibre?: (libre: ReglagesLibres) => Promise<void> | void;
}

/** Un numéro d'exemple, pour voir ce que le préfixe donne vraiment. */
const EXEMPLE = "V026";

export const ReglagesParDocument: React.FC<Props> = ({
  reglages,
  onChange,
  onChangePages,
  type,
  onType,
  apercu,
  document: doc = null,
  onChangeLibre,
  onEnregistrerLibre,
}) => {
  const libreVisible = useEditeurLibreVisible();
  const defauts = DEFAUTS_TYPE[type];
  const propre = reglages.types[type];
  const personnalise = propre !== undefined;
  const resolu = resoudreType(reglages, type);

  /*
   * TOUS les types passent par le moteur commun depuis que le bon de
   * commande fournisseur l'a rejoint. Il n'y a donc plus de cas où
   * l'éditeur de mise en page serait un interrupteur qui n'allume
   * rien, et plus de condition à porter ici.
   */
  const porteUnNumero = defauts.prefixe !== "";
  const aUneEcheance = type === "facture";
  const aUneValidite = defauts.validiteJours !== undefined;
  const aUneCommission = defauts.commissionSeparee !== undefined;

  const changer = (patch: Partial<ReglagesType>) =>
    onChange({ ...reglages.types, [type]: { ...propre, ...patch } });

  const personnaliser = () =>
    onChange({ ...reglages.types, [type]: ouvrirPersonnalisation(reglages, type) });

  const revenir = () => {
    const suite = { ...reglages.types };
    delete suite[type];
    onChange(suite);
  };

  return (
    <>
      <SettingsBlock>
        <p className="mb-2 text-sm font-semibold text-foreground">Document à régler</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TYPES_DISPONIBLES.map((t) => {
            const choisi = t === type;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={choisi}
                onClick={() => onType(t)}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  choisi
                    ? "border-success-border bg-success-soft"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <span className="block text-sm font-medium text-foreground">
                  {DEFAUTS_TYPE[t].libelle}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {reglages.types[t] ? "Personnalisé" : "Comme la boutique"}
                </span>
              </button>
            );
          })}
        </div>
      </SettingsBlock>

      {/* L'aperçu vient AVANT les réglages, pas après : on regarde le
          document, puis on tend la main vers le bouton qui le change.
          Placé en bas, il obligeait à remonter pour voir l'effet. */}
      {apercu}

      {libreVisible && onChangeLibre && onEnregistrerLibre && (
        <ChoixDisposition
          reglages={reglages}
          type={type}
          document={doc}
          onChange={onChangeLibre}
          onEnregistrer={onEnregistrerLibre}
        />
      )}

      {!personnalise ? (
        <SettingsBlock>
          <p className="text-sm text-foreground">
            {defauts.libelle} suit les réglages de la boutique. Il s&apos;imprime aujourd&apos;hui
            sous le titre <b>{resolu.titre}</b>
            {porteUnNumero && (
              <>
                , numéroté <b>{numeroDuDocument(EXEMPLE, resolu.prefixe)}</b>
              </>
            )}
            .
          </p>
          <button type="button" onClick={personnaliser} className="app-btn-secondary mt-3">
            <SlidersHorizontal className="h-4 w-4" />
            Personnaliser ce document
          </button>
        </SettingsBlock>
      ) : (
        <>
          <SettingsBlock className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Ces réglages ne valent que pour {defauts.libelle.toLowerCase()}. Les autres documents
              ne bougent pas.
            </p>
            <button type="button" onClick={revenir} className="app-btn-secondary">
              <RotateCcw className="h-4 w-4" />
              Revenir aux réglages de la boutique
            </button>
          </SettingsBlock>

          <SettingsRow
            label="Titre imprimé"
            htmlFor="type-titre"
            hint="Ce qui s'écrit en gros en haut du document."
          >
            <input
              id="type-titre"
              type="text"
              value={propre.titre ?? resolu.titre}
              onChange={(e) => changer({ titre: e.target.value })}
              className="app-field"
            />
          </SettingsRow>

          {porteUnNumero && (
            <SettingsRow
              label="Préfixe de numérotation"
              htmlFor="type-prefixe"
              hint="Il habille le numéro de la base sans le remplacer. « {AAAA} » est remplacé par l'année du document — celle du jour où il a été établi, pas celle d'aujourd'hui, pour qu'une pièce réimprimée garde son numéro."
              stacked
            >
              <input
                id="type-prefixe"
                type="text"
                value={propre.prefixe ?? resolu.prefixe}
                onChange={(e) => changer({ prefixe: e.target.value })}
                className="app-field"
                placeholder="FAC-{AAAA}-"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Donne aujourd&apos;hui{" "}
                <b className="font-mono text-foreground">
                  {numeroDuDocument(EXEMPLE, propre.prefixe ?? resolu.prefixe)}
                </b>
                {type === "facture" &&
                  " — il remplace le préfixe réglé plus haut pour la boutique."}
              </p>
            </SettingsRow>
          )}

          {aUneEcheance && (
            <SettingsRow
              label="Échéance"
              htmlFor="type-echeance"
              hint="La date se calcule depuis celle de la vente."
            >
              <select
                id="type-echeance"
                value={propre.echeance ?? resolu.echeance}
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
          )}

          {aUneValidite && (
            <SettingsRow
              label="Durée de validité"
              htmlFor="type-validite"
              hint="Le point de départ proposé à la création. La date reste modifiable pièce par pièce."
            >
              <div className="flex items-center gap-2">
                <input
                  id="type-validite"
                  type="number"
                  min={1}
                  max={365}
                  value={propre.validiteJours ?? resolu.validiteJours}
                  onChange={(e) => changer({ validiteJours: Number(e.target.value) })}
                  className="app-field w-24"
                />
                <span className="text-sm text-muted-foreground">jours</span>
              </div>
            </SettingsRow>
          )}

          {aUneCommission && (
            <SettingsRow
              label="Commission"
              hint="Une facture ne devient « avec commission » que si la vente en porte une. Détaillée, elle se lit en deux lignes — la prestation, puis la commission — dont la somme est le total. Comprise, elle reste dans le prix des lignes. Le total ne change pas."
            >
              <SettingsToggle
                checked={propre.commissionSeparee ?? resolu.commissionSeparee}
                onChange={(v) => changer({ commissionSeparee: v })}
                label="Détailler la commission"
              />
            </SettingsRow>
          )}

          <>
              <SettingsBlock>
                <p className="mb-2 text-sm font-semibold text-foreground">Modèle</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {MODELES_DOCUMENT.map((m) => {
                    const choisi = (propre.modele ?? resolu.modele) === m.cle;
                    return (
                      <button
                        key={m.cle}
                        type="button"
                        aria-pressed={choisi}
                        onClick={() => changer({ modele: m.cle as ModeleDocument })}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                          choisi
                            ? "border-success-border bg-success-soft"
                            : "border-border bg-card hover:bg-muted"
                        }`}
                      >
                        <span className="block text-sm font-medium text-foreground">{m.nom}</span>
                        <span className="block text-xs text-muted-foreground">{m.note}</span>
                      </button>
                    );
                  })}
                </div>
              </SettingsBlock>

              <SettingsBlock>
                <p className="mb-3 text-sm font-semibold text-foreground">Couleur</p>
                <div className="flex flex-wrap gap-2.5">
                  {COULEURS_DOCUMENT.map((c) => {
                    const choisie = (propre.couleur ?? resolu.couleur) === c.valeur;
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
          </>

          <SettingsRow label="Mot de fin" htmlFor="type-merci" stacked>
            <input
              id="type-merci"
              type="text"
              value={propre.motDeFin ?? resolu.motDeFin}
              onChange={(e) => changer({ motDeFin: e.target.value })}
              className="app-field"
              placeholder="Vide, aucune phrase ne s'imprime"
            />
          </SettingsRow>

          <SettingsRow
            label="Conditions"
            htmlFor="type-conditions"
            hint="Le texte en petits caractères, en bas du document. Vidé, il disparaît sans laisser d'espace."
            stacked
          >
            <textarea
              id="type-conditions"
              rows={3}
              value={propre.conditions ?? resolu.conditions}
              onChange={(e) => changer({ conditions: e.target.value })}
              className="app-field"
            />
          </SettingsRow>

          <SettingsRow
            label="Pied de page"
            htmlFor="type-pied"
            hint="Laissé vide, il reprend le nom, l'adresse et le téléphone de la boutique."
            stacked
          >
            <input
              id="type-pied"
              type="text"
              value={propre.piedDePage ?? resolu.piedDePage}
              onChange={(e) => changer({ piedDePage: e.target.value })}
              className="app-field"
              placeholder="Nom · adresse · téléphone de la boutique"
            />
          </SettingsRow>
        </>
      )}

      {/* ── NIVEAU 3 ────────────────────────────────────────────
          Indépendant du niveau 2 : on peut vouloir masquer le
          vendeur sans rien changer au titre ni au préfixe. */}
      <SettingsBlock className="border-t border-border pt-4">
        <p className="text-sm font-semibold text-foreground">Mise en page</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {`Ce qui s'affiche sur ${defauts.libelle.toLowerCase()}, sous quel nom, dans quel ordre.`}
        </p>
      </SettingsBlock>

      <EditeurMiseEnPage reglages={reglages} type={type} onChange={onChangePages} />
    </>
  );
};
