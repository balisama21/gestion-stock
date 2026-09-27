import React from "react";
import type { Document, LigneDocument } from "../lib/buildDocument";
import { montantOuTiret } from "../lib/format";
import type { ModeleDocument } from "../lib/reglages";
import {
  clesPosees,
  estCleCachet,
  estCleElement,
  idDuCachet,
  niveauDuBloc,
  type BlocPose,
  type Blocs,
  type ClePosee,
} from "../lib/disposition";
import type { Cachet } from "../lib/cachets";
import { appliquerTextes } from "../lib/textesLibres";
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

/** Les images des cachets, déjà chargées : la capture du PDF ne doit rien attendre. */
export interface ImagesCachets {
  cachets: Cachet[];
  /** Chemin dans le seau → data URL. */
  images: Record<string, string>;
}

/** Le contenu d'un bloc, ou `null` quand ce document n'a rien à y mettre. */
export function contenuDuBloc(
  cle: ClePosee,
  d: Document,
  base: ModeleDocument,
  lignes: LigneDocument[],
  pagination: string | null,
  cachets?: ImagesCachets,
  /** Le bloc posé : ses mots réécrits, et ce qu'il est quand on l'a ajouté. */
  bloc?: BlocPose,
): React.ReactNode {
  const textes = bloc?.textes;
  if (estCleElement(cle)) return contenuElement(bloc, cachets);
  if (estCleCachet(cle)) {
    const c = cachets?.cachets.find((x) => x.id === idDuCachet(cle));
    const src = c ? cachets?.images[c.chemin] : undefined;
    return c && src ? (
      <img className="doc-libre-cachet" src={src} alt="" style={{ opacity: c.opacite }} />
    ) : null;
  }
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
        <MontantEnLettres texte={d.montantEnLettres} type={d.type} intro={textes?.intro} />
      ) : null;
    case "mentions":
      return d.mentions ? <Mentions texte={d.mentions} /> : null;
    case "paiement":
      return d.coordonneesPaiement?.length ? (
        <CoordonneesPaiement lignes={d.coordonneesPaiement} titre={textes?.titre} />
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

function contenuElement(b: BlocPose | undefined, cachets?: ImagesCachets): React.ReactNode {
  switch (b?.element?.genre) {
    case "texte":
      return b.textes?.texte?.trim() ? (
        <div className="doc-libre-texte">{b.textes.texte}</div>
      ) : null;
    case "trait": {
      const horizontal = b.l >= b.h;
      const e = `${b.habillage?.bordure ?? 0.3}mm`;
      return (
        <div
          className="doc-libre-trait"
          style={{
            background: b.habillage?.bordureCouleur ?? "var(--doc)",
            ...(horizontal ? { height: e, width: "100%" } : { width: e, height: "100%" }),
          }}
        />
      );
    }
    case "cadre":
      return <div className="doc-libre-rect" />;
    case "image": {
      const src = b.element.image ? cachets?.images[b.element.image.chemin] : undefined;
      return src ? <img className="doc-libre-cachet" src={src} alt="" /> : null;
    }
    default:
      return null;
  }
}

export const styleDuBloc = (b: BlocPose, niveau: number): React.CSSProperties => ({
  left: `${b.x}mm`,
  top: `${b.y}mm`,
  width: `${b.l}mm`,
  height: `${b.h}mm`,
  textAlign: b.align === "droite" ? "right" : b.align === "centre" ? "center" : undefined,
  zIndex: niveau,
});

export const classeDuBloc = (cle: ClePosee, b: BlocPose) => {
  const h = b.habillage;
  const genre = b.element?.genre;
  const nom = estCleCachet(cle) ? "cachet" : genre ? `el bl-el-${genre}` : cle;
  return `doc-libre-bloc bl-${nom}${b.inverse ? " bl-inverse" : ""}${
    b.align === "droite" ? " bl-droite" : b.align === "centre" ? " bl-centre" : ""
  }${h?.police ? ` bl-police-${h.police}` : ""}${h?.gras ? " bl-gras" : ""}${
    h?.italique ? " bl-italique" : ""
  }${h?.encre ? " bl-encre" : ""}${
    (h?.fond || h?.bordure) && genre !== "trait" ? " bl-cadre" : ""
  }`;
};

/** Le bandeau et la barre de pied peignent la couleur du document : leur fond la remplace. */
const peintLaCouleur = (cle: ClePosee, base: ModeleDocument) =>
  cle === "fond" || (cle === "pied" && base === "bandeau");

/** Couleurs, fond et trait du bloc. La géométrie reste dans `styleDuBloc`. */
export function habillageDuBloc(
  cle: ClePosee,
  b: BlocPose,
  base: ModeleDocument,
): React.CSSProperties {
  const h = b.habillage;
  // Un trait porte son épaisseur et sa couleur dans son contenu.
  if (!h || b.element?.genre === "trait") return {};
  const s: Record<string, string> = {};
  if (h.encre) s["--bl-encre"] = h.encre;
  if (h.fond) {
    if (peintLaCouleur(cle, base)) s["--doc"] = h.fond;
    else s.background = h.fond;
  }
  if (h.bordure) s.border = `${h.bordure}mm solid ${h.bordureCouleur ?? "var(--doc)"}`;
  return s as React.CSSProperties;
}

/** La taille du texte du bloc, en facteur. */
export const echelleDuTexte = (b: BlocPose) => (b.habillage?.taille ?? 100) / 100;

interface ProprietesLibre {
  document: Document;
  base: ModeleDocument;
  blocs: Blocs;
  lignes: LigneDocument[];
  /** Les blocs à poser sur cette feuille. Par défaut : tous ceux qui ne sont pas masqués. */
  cles?: ClePosee[];
  pagination: string | null;
  /** Le cadre du tableau sur cette page, quand le document en compte plusieurs. */
  cadreTableau?: { y: number; h: number };
  cachets?: ImagesCachets;
}

/** Une feuille en mode libre : chaque bloc à sa place, au millimètre. */
export const Libre: React.FC<ProprietesLibre> = ({
  document: brut,
  base,
  blocs,
  lignes,
  cles,
  pagination,
  cadreTableau,
  cachets,
}) => {
  const d = appliquerTextes(brut, blocs);
  return (
    <div className="doc-libre">
      {(cles ?? clesPosees(blocs).filter((c) => !blocs[c].masque)).map((cle) => {
        if (cle === "tableau" && cadreTableau && lignes.length === 0) return null;
        const b =
          cle === "tableau" && cadreTableau ? { ...blocs[cle], ...cadreTableau } : blocs[cle];
        const contenu = contenuDuBloc(cle, d, base, lignes, pagination, cachets, b);
        if (contenu === null) return null;
        const k = echelleDuTexte(b);
        return (
          <div
            key={cle}
            data-bloc={cle}
            className={classeDuBloc(cle, b)}
            style={{ ...styleDuBloc(b, niveauDuBloc(cle, b)), ...habillageDuBloc(cle, b, base) }}
          >
            {k === 1 ? (
              contenu
            ) : (
              <div className="doc-libre-echelle" style={{ zoom: k }}>
                {contenu}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
