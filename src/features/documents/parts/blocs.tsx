import React from "react";
import type {
  BlocTiers,
  ColonneDocument,
  Document,
  EnTeteBoutique,
  LigneDocument,
  LigneMeta,
  Signatures,
  Tampon,
  TotauxDocument,
} from "../lib/buildDocument";
import { montant, montantOuTiret } from "../lib/format";
import { celluleDeLigne, CLASSE, COLONNE } from "./cellules";
import { useEquivalentsDuDocument } from "../lib/equivalents";
import { convertir } from "../../../lib/contexteDevises";

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

export const BlocAdresse: React.FC<{ bloc: BlocTiers; titre?: string }> = ({ bloc, titre }) => {
  // Masqués dans la mise en page, l'intitulé et le nom valent la
  // chaîne vide. Une balise vide garderait sa hauteur : on ne la pose
  // donc pas du tout.
  const intitule = titre ?? bloc.titre;
  return (
    <div className="doc-bloc">
      {intitule && <h4>{intitule}</h4>}
      {bloc.nom && <b>{bloc.nom}</b>}
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
};

/* ── Les repères du document ─────────────────────────────────────── */

export const Reperes: React.FC<{ meta: LigneMeta[]; pagination?: string | null }> = ({
  meta,
  pagination,
}) => (
  <div className="doc-meta">
    {meta.map((m) => (
      <div key={m.libelle}>
        <span className="doc-muted">{m.libelle} </span>
        {m.libelle === "N°" ? <b>{m.valeur}</b> : m.valeur}
      </div>
    ))}
    {/*
     * La mention de page vit ICI, dans un bloc déjà mesuré, et non
     * dans une ligne à part qu'il faudrait réserver. La ligne est
     * toujours présente — vide quand le document tient sur une page —
     * pour que sa hauteur soit connue AVANT qu'on sache combien il y
     * aura de pages. Une ligne qui apparaîtrait après coup ferait
     * déborder la feuille qu'on venait de mesurer.
     */}
    <div className="doc-muted" aria-hidden={pagination ? undefined : true}>
      {pagination ?? " "}
    </div>
  </div>
);

export const TamponPaiement: React.FC<{ tampon: Tampon | null }> = ({ tampon }) =>
  tampon ? (
    <span className={`doc-tampon${tampon.ton === "du" ? " doc-tampon--du" : ""}`}>
      {tampon.texte}
    </span>
  ) : null;

/* ── Le tableau des lignes ───────────────────────────────────────── */

export const TableauLignes: React.FC<{
  lignes: LigneDocument[];
  colonnes: ColonneDocument[];
  devise: string;
}> = ({ lignes, colonnes, devise }) => {
  const avecUnite = colonnes.some((c) => c.cle === "unite");
  const equivalents = useEquivalentsDuDocument();
  return (
    <table>
      <thead>
        {/* Un en-tête qui se casse en deux se lit mal, et c'est
            exactement ce qui arrivait aux PDF produits d'un téléphone. */}
        <tr style={{ whiteSpace: "nowrap" }}>
          {colonnes.map((c) => (
            <th
              key={c.cle}
              style={{ textAlign: COLONNE[c.cle].align, width: COLONNE[c.cle].largeur }}
            >
              {c.libelle}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lignes.map((l) => (
          <tr key={l.id}>
            {colonnes.map((c) => (
              <td key={c.cle} className={CLASSE[c.cle] || undefined}>
                {celluleDeLigne(c.cle, l, devise, avecUnite, equivalents)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/* ── Les totaux ──────────────────────────────────────────────────── */

/** « Soit 12,40 € » sous le total, une ligne par devise choisie. */
export const EquivalentsTotal: React.FC<{ total: number | null }> = ({ total }) => {
  const equivalents = useEquivalentsDuDocument();
  if (total === null || !equivalents.length) return null;
  return (
    <div className="doc-totaux doc-totaux-equiv">
      {equivalents.map((d) => (
        <div key={d.code} className="l">
          <span className="doc-muted">Soit en {d.code}</span>
          <span className="doc-num doc-muted">{convertir(total, d)}</span>
        </div>
      ))}
    </div>
  );
};

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
        <span className="doc-muted">{totaux.libelleHorsTaxe}</span>
        <span className="doc-num">{montant(totaux.horsTaxe, devise)}</span>
      </div>
    )}
    {/* La commission se lit AVANT le total : deux lignes qui
        détaillent ce que le client paie, et dont la somme est
        exactement le total annoncé dessous. */}
    {totaux.commission && (
      <>
        {totaux.commission.prestation !== null && (
          <div className="l">
            <span className="doc-muted">{totaux.commission.libellePrestation}</span>
            <span className="doc-num">{montant(totaux.commission.prestation, devise)}</span>
          </div>
        )}
        <div className="l">
          <span className="doc-muted">{totaux.commission.libelle}</span>
          <span className="doc-num">{montant(totaux.commission.montant, devise)}</span>
        </div>
      </>
    )}
    {totaux.tva && (
      <div className="l">
        <span className="doc-muted">
          {totaux.libelleTva} {totaux.tva.taux} %
        </span>
        <span className="doc-num">{montant(totaux.tva.montant, devise)}</span>
      </div>
    )}
    {/* La ligne du total porte un nom, et non un rang : les modèles
        qui la mettent en valeur visaient `:last-child`, qui est la
        ligne « Déjà payé » dès qu un règlement est connu — le filet
        de l Épuré soulignait donc l acompte au lieu du total. */}
    {!sansTotal && (
      <div className="l grand" style={{ fontSize: "12pt", fontWeight: 700 }}>
        <span>{totaux.libelleTotal}</span>
        <span className="doc-num">{montantOuTiret(totaux.total, devise)}</span>
      </div>
    )}
    {!sansTotal && <EquivalentsTotal total={totaux.total} />}
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
        <span className="doc-muted">{totaux.libelleReste}</span>
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

/**
 * Où payer — Mobile Money, virement.
 *
 * Le titre ne vit pas sans ses lignes : rien de saisi, rien du tout,
 * pas d'intitulé orphelin au-dessus d'un vide.
 */
export const CoordonneesPaiement: React.FC<{ lignes: string[] | null }> = ({ lignes }) =>
  lignes && lignes.length > 0 ? (
    <div className="doc-paiement">
      <h5>Coordonnées de paiement</h5>
      {lignes.map((l) => (
        <div key={l}>{l}</div>
      ))}
    </div>
  ) : null;

export const Signature: React.FC<{ signatures: Signatures | null }> = ({ signatures }) =>
  signatures ? (
    <div className="doc-signatures doc-insecable" style={{ marginTop: "6mm" }}>
      <div className="ligne">{signatures.gauche}</div>
      <div className="ligne" style={{ textAlign: "right" }}>
        {signatures.droite}
      </div>
    </div>
  ) : null;
