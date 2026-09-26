import React, { useState } from "react";
import {
  ArrowRightLeft,
  BellRing,
  Copy,
  FileText,
  Mail,
  MessageCircle,
  Printer,
  Receipt,
  Wallet,
} from "lucide-react";
import { Modal } from "../shared/Modal";
import { SortieDocument } from "../../features/documents/SortieDocument";
import type { ReglagesDocuments } from "../../features/documents/lib/reglages";
import { figer, lireCopieFigee, type PieceFigee } from "../../features/documents/lib/copieFigee";
import type { TypeDocumentV3 } from "../../features/documents/lib/typesDocument";
import { montant as formaterMontant } from "../../features/documents/lib/format";
import type { DocumentCommercial } from "./documents";
import {
  construireLaPiece,
  coordonneesDuTiers,
  type SortieVoulue,
  type SourcesDeLaPiece,
} from "./construireLaPiece";
import { lienEmail, lienWhatsApp, messageDEnvoi, messageDeRelance, objetDuCourrier } from "./envoi";

/**
 * CE QU'ON PEUT FAIRE D'UNE PIÈCE.
 *
 * Le panneau de bas de fiche. Chaque bouton correspond à une ligne du
 * cahier, et aucun n'apparaît à qui n'a pas le droit correspondant : un
 * bouton qui échoue est pire qu'un bouton absent.
 *
 * ── UN DOCUMENT ÉMIS NE SE MODIFIE PAS ─────────────────────────────
 *
 * On ne trouvera donc ici ni « Modifier » ni « Supprimer ». Corriger
 * une facture, c'est établir un avoir — c'est le bouton « Annuler par
 * un avoir », et c'est le seul chemin.
 */

export interface DroitsFacturation {
  envoyer: boolean;
  encaisser: boolean;
  avoir: boolean;
  creer: boolean;
}

export interface ActionsDocumentProps {
  document: DocumentCommercial;
  sources: SourcesDeLaPiece;
  reglages: ReglagesDocuments;
  droits: DroitsFacturation;
  aujourdhui: string;
  /** Combien de relances sont déjà parties pour cette pièce. */
  relances: number;
  onEmis: (type: string, snapshot: unknown) => void;
  /** La copie figée de cette pièce pour ce type, si elle a déjà été émise. */
  lireCopie?: (type: string) => Promise<unknown | null>;
  onEnvoye: (canal: string, relance: boolean) => void;
  onEncaisser?: (doc: DocumentCommercial) => void;
  onConvertir?: (doc: DocumentCommercial) => void;
  onDupliquer?: (doc: DocumentCommercial) => void;
  onAvoir?: (doc: DocumentCommercial) => void;
}

export const ActionsDocument: React.FC<ActionsDocumentProps> = ({
  document: d,
  sources,
  reglages,
  droits,
  aujourdhui,
  relances,
  onEmis,
  lireCopie,
  onEnvoye,
  onEncaisser,
  onConvertir,
  onDupliquer,
  onAvoir,
}) => {
  const [sortie, setSortie] = useState<SortieVoulue | null>(null);
  const [fige, setFige] = useState<PieceFigee | null>(null);
  const [envoi, setEnvoi] = useState<{ relance: boolean } | null>(null);

  const argent = (n: number) => formaterMontant(n, sources.boutique.currencySymbol);

  const sourcesDeLaPiece = fige
    ? {
        ...sources,
        reglages: fige.reglages,
        boutique: { ...sources.boutique, ...fige.boutique },
      }
    : sources;
  const piece = sortie ? construireLaPiece(d, sourcesDeLaPiece, sortie) : null;
  const estUneOffre = d.entite === "devis";
  const estUneVente = d.entite === "vente";
  const converti = d.statut === "converti";
  const annulee = d.statut === "annulee";

  const ouvrirEnvoi = (relance: boolean) => setEnvoi({ relance });

  /*
   * Ouvrir le document, c'est l'émettre : c'est à cet instant qu'il part
   * chez le client, sur papier ou en fichier.
   *
   * On range alors sa COPIE FIGÉE — l'identité de la boutique et les
   * réglages du type, tels qu'ils sont aujourd'hui. Si la boutique
   * déménage ou change son logo demain, la pièce d'aujourd'hui reste
   * celle que le client a reçue. Une seule copie par pièce : une
   * réimpression relit la première.
   */
  const ouvrirLaPiece = async (voulue: SortieVoulue) => {
    const type = (voulue === "recu" ? "recu" : d.type) as TypeDocumentV3;
    // Déjà émise : on la reconstruit telle qu'elle est partie.
    const brut = lireCopie ? await lireCopie(type).catch(() => null) : null;
    const relue = brut ? lireCopieFigee(brut, reglages, type) : null;
    if (relue) {
      setFige(relue);
    } else {
      setFige(null);
      onEmis(type, figer(reglages, sources.boutique, type, aujourdhui));
    }
    setSortie(voulue);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => ouvrirLaPiece("facture")}
          className="app-btn-secondary"
        >
          <FileText className="h-4 w-4" />
          Voir, PDF, imprimer
        </button>

        {/* Le reçu constate un paiement : il n'a de sens que s'il y en
            a eu un, et seulement sur une vente. */}
        {estUneVente && d.paye > 0 && (
          <button type="button" onClick={() => ouvrirLaPiece("recu")} className="app-btn-secondary">
            <Receipt className="h-4 w-4" />
            Reçu
          </button>
        )}

        {droits.envoyer && (
          <button type="button" onClick={() => ouvrirEnvoi(false)} className="app-btn-secondary">
            <MessageCircle className="h-4 w-4" />
            Envoyer
          </button>
        )}

        {droits.envoyer && d.statut === "retard" && (
          <button type="button" onClick={() => ouvrirEnvoi(true)} className="app-btn-secondary">
            <BellRing className="h-4 w-4" />
            Relancer
            {relances > 0 && (
              <span className="font-mono text-[11px] tabular-nums opacity-60">{relances}</span>
            )}
          </button>
        )}

        {droits.encaisser && estUneVente && d.reste > 0 && !annulee && onEncaisser && (
          <button type="button" onClick={() => onEncaisser(d)} className="app-btn-secondary">
            <Wallet className="h-4 w-4" />
            Enregistrer un paiement
          </button>
        )}

        {droits.creer && estUneOffre && !converti && onConvertir && (
          <button type="button" onClick={() => onConvertir(d)} className="app-btn-primary">
            <ArrowRightLeft className="h-4 w-4" />
            Convertir en facture
          </button>
        )}

        {droits.creer && onDupliquer && (estUneVente || estUneOffre) && (
          <button type="button" onClick={() => onDupliquer(d)} className="app-btn-secondary">
            <Copy className="h-4 w-4" />
            Dupliquer
          </button>
        )}

        {droits.avoir && estUneVente && !annulee && onAvoir && (
          <button type="button" onClick={() => onAvoir(d)} className="app-btn-secondary">
            <Printer className="h-4 w-4" />
            Annuler par un avoir
          </button>
        )}
      </div>

      {annulee && (
        <p className="mt-3 text-xs text-muted-foreground">
          Cette facture est annulée par l&apos;avoir {d.avoirDe}. Elle ne se modifie plus et ne se
          supprime pas : c&apos;est l&apos;avoir qui porte la correction.
        </p>
      )}

      {piece && (
        <SortieDocument
          document={piece}
          reglages={fige?.reglages ?? reglages}
          formats={d.entite === "vente" ? ["a4", "t80", "t58"] : ["a4"]}
          onFermer={() => setSortie(null)}
        />
      )}

      {envoi && (
        <FenetreEnvoi
          document={d}
          relance={envoi.relance}
          sources={sources}
          aujourdhui={aujourdhui}
          argent={argent}
          onFermer={() => setEnvoi(null)}
          onEnvoye={(canal) => {
            onEnvoye(canal, envoi.relance);
            setEnvoi(null);
          }}
        />
      )}
    </>
  );
};

/**
 * La fenêtre d'envoi.
 *
 * Le message est pré-rempli et se retouche avant de partir. Les deux
 * boutons OUVRENT WhatsApp ou le logiciel de courrier ; c'est la
 * personne qui appuie sur « Envoyer » là-bas. Le logiciel n'expédie
 * jamais un message au nom de quelqu'un sans qu'il l'ait vu.
 */
const FenetreEnvoi: React.FC<{
  document: DocumentCommercial;
  relance: boolean;
  sources: SourcesDeLaPiece;
  aujourdhui: string;
  argent: (n: number) => string;
  onFermer: () => void;
  onEnvoye: (canal: string) => void;
}> = ({ document: d, relance, sources, aujourdhui, argent, onFermer, onEnvoye }) => {
  const contexte = {
    document: d,
    nomBoutique: sources.boutique.storeName ?? "",
    montant: argent(d.montant),
    reste: argent(d.reste),
    echeance: d.echeance,
    aujourdhui,
  };

  const [message, setMessage] = useState(() =>
    relance ? messageDeRelance(contexte) : messageDEnvoi(contexte),
  );

  const { telephone, email } = coordonneesDuTiers(d, sources);
  const wa = lienWhatsApp(telephone, message);
  const objet = objetDuCourrier(d, sources.boutique.storeName ?? "", relance);
  const mail = lienEmail(email, objet, message);

  return (
    <Modal
      open
      onClose={onFermer}
      size="lg"
      icon={<MessageCircle className="h-4 w-4" />}
      title={relance ? "Relancer" : "Envoyer"}
      description={d.numero}
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="envoi-message"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Message
          </label>
          <textarea
            id="envoi-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={9}
            className="app-field font-normal"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Retouchez-le librement : il part tel qu&apos;il est écrit ici.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onEnvoye("whatsapp")}
              className="app-btn-primary"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">
              Aucun numéro utilisable sur la fiche : WhatsApp n&apos;est pas proposé.
            </span>
          )}

          {mail ? (
            <a href={mail} onClick={() => onEnvoye("email")} className="app-btn-secondary">
              <Mail className="h-4 w-4" />
              E-mail
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">
              Aucune adresse e-mail sur la fiche.
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(message);
              onEnvoye("autre");
            }}
            className="app-btn-ghost"
          >
            <Copy className="h-4 w-4" />
            Copier le message
          </button>
        </div>
      </div>
    </Modal>
  );
};
