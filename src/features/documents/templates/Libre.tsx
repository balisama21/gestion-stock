import React from "react";
import type { Document, LigneDocument } from "../lib/buildDocument";
import { montantOuTiret } from "../lib/format";
import type { ModeleDocument } from "../lib/reglages";
import { BLOCS, type BlocPose, type CleBloc } from "../lib/disposition";
import {
  BlocAdresse,
  CoordonneesPaiement,
  EquivalentsTotal,
  Mentions,
  MontantEnLettres,
  Reperes,
  Signature,
  TableauLignes,
  TamponPaiement,
  Totaux,
} from "../parts/blocs";

/** Le contenu d'un bloc, ou `null` quand ce document n'a rien à y mettre. */
export function contenuDuBloc(
  cle: CleBloc,
  d: Document,
  base: ModeleDocument,
  lignes: LigneDocument[],
  pagination: string | null,
): React.ReactNode {
  const e = d.emetteur;
  switch (cle) {
    case "fond":
      return <div className="doc-libre-fond" />;
    case "logo":
      if (e.logoUrl) return <img className="doc-libre-logo" src={e.logoUrl} alt="" />;
      return e.initiales ? <span className="doc-pastille">{e.initiales}</span> : null;
    case "nom":
      return e.nom ? (
        <>
          <div className="doc-nom">{e.nom}</div>
          {e.sousTitre && <div className="doc-sous-titre">{e.sousTitre}</div>}
        </>
      ) : null;
    case "emetteur": {
      if (base === "classique" || base === "epure") {
        return e.titre || e.lignes.length > 0 || e.nif ? <BlocAdresse bloc={e} /> : null;
      }
      const lignesEm = [...e.lignes, e.nif ? `NIF/STAT ${e.nif}` : null].filter(Boolean);
      return lignesEm.length > 0 ? <div className="coordonnees">{lignesEm.join(" · ")}</div> : null;
    }
    case "titre":
      return d.titre ? <div className="doc-titre">{d.titre}</div> : null;
    case "reperes":
      return <Reperes meta={d.meta} pagination={pagination} />;
    case "tampon":
      return d.tampon ? <TamponPaiement tampon={d.tampon} /> : null;
    case "destinataire":
      return d.destinataire.nom || d.destinataire.lignes.length > 0 ? (
        <BlocAdresse bloc={d.destinataire} />
      ) : null;
    case "tableau":
      return <TableauLignes lignes={lignes} colonnes={d.colonnes} devise={d.devise} />;
    case "totaux":
      return base === "classique" || base === "bandeau" ? (
        <>
          <Totaux totaux={d.totaux} devise={d.devise} sansTotal />
          <div className="encadre">
            <span>{d.totaux.libelleTotal}</span>
            <span className="doc-num">{montantOuTiret(d.totaux.total, d.devise)}</span>
          </div>
          <EquivalentsTotal total={d.totaux.total} />
        </>
      ) : (
        <Totaux totaux={d.totaux} devise={d.devise} />
      );
    case "lettres":
      return d.montantEnLettres ? (
        <MontantEnLettres texte={d.montantEnLettres} type={d.type} />
      ) : null;
    case "mentions":
      return d.mentions ? <Mentions texte={d.mentions} /> : null;
    case "paiement":
      return d.coordonneesPaiement?.length ? (
        <CoordonneesPaiement lignes={d.coordonneesPaiement} />
      ) : null;
    case "signatures":
      return d.signatures ? <Signature signatures={d.signatures} /> : null;
    case "motDeFin":
      return d.motDeFin ? <div className="merci">{d.motDeFin}</div> : null;
    case "pied": {
      const texte = [d.piedDePage, d.numero, pagination].filter(Boolean).join(" · ");
      return texte ? (
        <footer className={base === "bandeau" ? "barre-pied" : "doc-libre-pied"}>{texte}</footer>
      ) : null;
    }
  }
}

export const styleDuBloc = (b: BlocPose, avant: boolean): React.CSSProperties => ({
  left: `${b.x}mm`,
  top: `${b.y}mm`,
  width: `${b.l}mm`,
  height: `${b.h}mm`,
  textAlign: b.align === "droite" ? "right" : b.align === "centre" ? "center" : undefined,
  zIndex: avant ? 2 : 1,
});

export const classeDuBloc = (cle: CleBloc, b: BlocPose) =>
  `doc-libre-bloc bl-${cle}${b.inverse ? " bl-inverse" : ""}${
    b.align === "droite" ? " bl-droite" : b.align === "centre" ? " bl-centre" : ""
  }`;

interface ProprietesLibre {
  document: Document;
  base: ModeleDocument;
  blocs: Record<CleBloc, BlocPose>;
  lignes: LigneDocument[];
  /** Les blocs à poser sur cette feuille. Par défaut : tous ceux qui ne sont pas masqués. */
  cles?: CleBloc[];
  pagination: string | null;
}

/** Une feuille en mode libre : chaque bloc à sa place, au millimètre. */
export const Libre: React.FC<ProprietesLibre> = ({
  document: d,
  base,
  blocs,
  lignes,
  cles,
  pagination,
}) => (
  <div className="doc-libre">
    {(cles ?? BLOCS.map((b) => b.cle).filter((c) => !blocs[c].masque)).map((cle) => {
      const b = blocs[cle];
      const contenu = contenuDuBloc(cle, d, base, lignes, pagination);
      if (contenu === null) return null;
      const avant = BLOCS.find((x) => x.cle === cle)?.verrouille === true;
      return (
        <div
          key={cle}
          data-bloc={cle}
          className={classeDuBloc(cle, b)}
          style={styleDuBloc(b, avant)}
        >
          {contenu}
        </div>
      );
    })}
  </div>
);
