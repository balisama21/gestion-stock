import React from "react";
import type {
  BlocTiers,
  Document,
  EnTeteBoutique,
  LigneDocument,
  LigneMeta,
  Signatures,
  Tampon,
  TotauxDocument,
} from "../lib/buildDocument";
import { montant, quantite } from "../lib/format";

/**
 * LES MORCEAUX DONT LES QUATRE MODÈLES SONT FAITS
 *
 * Un seul fichier plutôt que huit de vingt lignes : ces blocs se
 * lisent ensemble, ils partagent les mêmes règles, et les éparpiller
 * obligerait à ouvrir huit onglets pour comprendre une en-tête.
 *
 * AUCUN D'EUX NE DÉCIDE DE RIEN. Ils ne calculent pas, ne complètent
 * pas, n'inventent pas : ce que `buildDocument` a mis à `null` ne
 * s'affiche pas, un point c'est tout. C'est ce qui garantit qu'un
 * changement de modèle ne change jamais le contenu d'une facture.
 */

/* ── L'identité de la boutique ───────────────────────────────────── */

export const Marque: React.FC<{ emetteur: EnTeteBoutique; inverse?: boolean }> = ({
  emetteur,
  inverse,
}) => (
  <div className="doc-marque">
    {emetteur.logoUrl && <img className="doc-logo" src={emetteur.logoUrl} alt="" />}
    {emetteur.initiales && <span className="doc-pastille">{emetteur.initiales}</span>}
    <div style={{ minWidth: 0 }}>
      <div className="doc-nom">{emetteur.nom}</div>
      {emetteur.sousTitre && (
        <div
          className="doc-sous-titre"
          style={inverse ? { color: "rgba(255,255,255,.78)" } : undefined}
        >
          {emetteur.sousTitre}
        </div>
      )}
    </div>
  </div>
);

/* ── Un bloc d'adresse — émetteur ou destinataire ────────────────── */

export const BlocAdresse: React.FC<{ bloc: BlocTiers; titre?: string }> = ({ bloc, titre }) => (
  <div className="doc-bloc">
    <h4>{titre ?? bloc.titre}</h4>
    <b>{bloc.nom}</b>
    {/* Le paragraphe entier disparaît quand il n'y a rien à y mettre :
        un cadre vide sous un nom se lit comme une donnée perdue. */}
    {(bloc.lignes.length > 0 || bloc.nif) && (
      <p>
        {bloc.lignes.map((l, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {l}
          </React.Fragment>
        ))}
        {bloc.nif && (
          <>
            {bloc.lignes.length > 0 && <br />}
            <span className="doc-fiscal">NIF/STAT {bloc.nif}</span>
          </>
        )}
      </p>
    )}
  </div>
);

/* ── Les repères du document ─────────────────────────────────────── */

export const Reperes: React.FC<{ meta: LigneMeta[] }> = ({ meta }) => (
  <div className="doc-meta">
    {meta.map((m) => (
      <div key={m.libelle}>
        <span className="doc-muted">{m.libelle} </span>
        {m.libelle === "N°" ? <b>{m.valeur}</b> : m.valeur}
      </div>
    ))}
  </div>
);

export const TamponPaiement: React.FC<{ tampon: Tampon | null }> = ({ tampon }) =>
  tampon ? (
    <span className={`doc-tampon${tampon.ton === "du" ? " doc-tampon--du" : ""}`}>
      {tampon.texte}
    </span>
  ) : null;

/* ── Le tableau des lignes ───────────────────────────────────────── */

export const TableauLignes: React.FC<{ lignes: LigneDocument[]; devise: string }> = ({
  lignes,
  devise,
}) => (
  <table>
    <thead>
      {/* Un en-tête qui se casse en deux se lit mal, et c'est
          exactement ce qui arrivait aux PDF produits d'un téléphone. */}
      <tr style={{ whiteSpace: "nowrap" }}>
        <th>Désignation</th>
        <th style={{ textAlign: "center", width: "28mm" }}>Quantité</th>
        <th style={{ textAlign: "right", width: "30mm" }}>Prix unitaire</th>
        <th style={{ textAlign: "right", width: "32mm" }}>Total</th>
      </tr>
    </thead>
    <tbody>
      {lignes.map((l) => (
        <tr key={l.id}>
          <td>
            <b>{l.designation}</b>
            {l.detail && (
              <>
                <br />
                <span className="doc-detail">{l.detail}</span>
              </>
            )}
          </td>
          <td className="doc-qte">{quantite(l.quantite, l.unite)}</td>
          <td className="doc-montant">{montant(l.prixUnitaire, devise)}</td>
          <td className="doc-montant">
            <b>{montant(l.total, devise)}</b>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

/* ── Les totaux ──────────────────────────────────────────────────── */

/**
 * Les lignes de total qui précèdent le montant final.
 *
 * `sansTotal` sert aux modèles qui détachent le total dans un encadré
 * de couleur : il ne doit pas y figurer deux fois.
 */
export const Totaux: React.FC<{
  totaux: TotauxDocument;
  devise: string;
  sansTotal?: boolean;
}> = ({ totaux, devise, sansTotal }) => (
  <div className="doc-totaux">
    {/* Le hors-taxe n'apparaît QUE si la TVA est affichée : sans elle,
        il répéterait le total mot pour mot. */}
    {totaux.horsTaxe !== null && (
      <div className="l">
        <span className="doc-muted">Total hors taxe</span>
        <span className="doc-num">{montant(totaux.horsTaxe, devise)}</span>
      </div>
    )}
    {totaux.tva && (
      <div className="l">
        <span className="doc-muted">TVA {totaux.tva.taux} %</span>
        <span className="doc-num">{montant(totaux.tva.montant, devise)}</span>
      </div>
    )}
    {!sansTotal && (
      <div className="l" style={{ fontSize: "12pt", fontWeight: 700 }}>
        <span>{totaux.libelleTotal}</span>
        <span className="doc-num">{montant(totaux.total, devise)}</span>
      </div>
    )}
    {totaux.paye !== null && (
      <div className="l">
        <span className="doc-muted">
          {totaux.libellePaye}
          {totaux.modePaiement ? ` (${totaux.modePaiement})` : ""}
        </span>
        <span className="doc-num">{montant(totaux.paye, devise)}</span>
      </div>
    )}
    {/* « Solde 0 Ar » ne dit rien que le tampon « PAYÉ » et la ligne
        « Déjà payé » n'aient déjà dit, et c'est un zéro de plus à
        lire sur un document qui en compte assez. La ligne n'apparaît
        que lorsqu'il reste vraiment quelque chose. */}
    {totaux.reste !== null && totaux.reste > 0 && (
      <div className="l reste">
        <span className="doc-muted">Reste à payer</span>
        <span className="doc-num">{montant(totaux.reste, devise)}</span>
      </div>
    )}
  </div>
);

/* ── Bas de page ─────────────────────────────────────────────────── */

export const MontantEnLettres: React.FC<{ texte: string | null; type: Document["type"] }> = ({
  texte,
  type,
}) => {
  if (!texte) return null;
  const mot = type === "devis" ? "offre" : type === "recu" ? "quittance" : "facture";
  return (
    <p className="doc-lettres">
      Arrêtée la présente {mot} à la somme de <b>{texte}</b>.
    </p>
  );
};

export const Mentions: React.FC<{ texte: string | null }> = ({ texte }) =>
  texte ? <p className="doc-mentions">{texte}</p> : null;

export const Signature: React.FC<{ signatures: Signatures | null }> = ({ signatures }) =>
  signatures ? (
    <div className="doc-signatures doc-insecable" style={{ marginTop: "6mm" }}>
      <div className="ligne">{signatures.gauche}</div>
      <div className="ligne" style={{ textAlign: "right" }}>
        {signatures.droite}
      </div>
    </div>
  ) : null;
