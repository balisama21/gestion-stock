import React from "react";
import type { Document } from "../lib/buildDocument";
import { dessinerCode128 } from "../lib/codeBarres";
import { montantOuTiret, nombre, nombreOuTiret, quantite } from "../lib/format";
import type { LargeurTicket, ReglagesTicket } from "../lib/reglages";
import { useEquivalentsDuDocument } from "../lib/equivalents";
import { convertir } from "../../../lib/contexteDevises";

/**
 * LE TICKET DE CAISSE
 *
 * ── CE N'EST PAS UNE FACTURE, ET IL LE DIT ─────────────────────────
 *
 * C'est la phrase la plus importante du document : « Ticket non
 * valable comme facture. Facture sur demande à la caisse. » Un client
 * qui repart avec un ticket en croyant tenir une facture revient, et
 * la vente est déjà loin.
 *
 * Tout le reste découle de la largeur. Sur 58 millimètres, un tableau
 * à quatre colonnes est illisible : la désignation prend donc toute
 * la largeur, et la ligne de calcul se lit en dessous. C'est la
 * disposition de tous les tickets de caisse du monde, et ce n'est pas
 * un hasard.
 *
 * ── LE CODE-BARRES CODE VRAIMENT QUELQUE CHOSE ─────────────────────
 *
 * Un Code 128, dessiné en SVG, qui encode le numéro de vente tel
 * qu'il est en base. Une douchette rend « V026 », qui se cherche dans
 * la liste des ventes. La maquette, elle, dessinait un dégradé
 * répétitif : très ressemblant, et parfaitement muet.
 */

/** Combien de millimètres vaut un module du code-barres. */
const MODULE_MM: Record<LargeurTicket, number> = {
  // Norme : 0,25 mm est le plus fin qu'une imprimante thermique de
  // caisse sait rendre proprement. Sur 58 mm on descend d'un cran,
  // faute de place — un symbole tronqué ne se lit pas du tout.
  80: 0.28,
  58: 0.22,
};

const Separateur: React.FC = () => <div className="sep" aria-hidden="true" />;

/** « ≈ 2,00 € · 983 CF » sous le prix d'un article. */
const EquivalentsArticle: React.FC<{ montant: number | null }> = ({ montant }) => {
  const equivalents = useEquivalentsDuDocument();
  if (montant === null || !montant || !equivalents.length) return null;
  return (
    <div className="l equiv">
      <span />
      <span>≈ {equivalents.map((d) => convertir(montant, d)).join(" · ")}</span>
    </div>
  );
};

/** « Soit en EUR » sous le total, une ligne par devise choisie. */
const EquivalentsTotalTicket: React.FC<{ total: number | null }> = ({ total }) => {
  const equivalents = useEquivalentsDuDocument();
  if (total === null || !equivalents.length) return null;
  return (
    <>
      {equivalents.map((d) => (
        <div key={d.code} className="l equiv">
          <span>Soit en {d.code}</span>
          <span>{convertir(total, d)}</span>
        </div>
      ))}
    </>
  );
};

const Ligne: React.FC<{ gauche: React.ReactNode; droite: React.ReactNode }> = ({
  gauche,
  droite,
}) => (
  <div className="l">
    <span>{gauche}</span>
    <span>{droite}</span>
  </div>
);

const CodeBarres: React.FC<{ valeur: string; largeurTicket: LargeurTicket }> = ({
  valeur,
  largeurTicket,
}) => {
  const dessin = dessinerCode128(valeur);
  // Un numéro que la norme ne sait pas coder ne donne pas de barres
  // décoratives : il ne donne rien.
  if (!dessin) return null;

  const mm = MODULE_MM[largeurTicket];
  const largeurMm = dessin.largeur * mm;

  return (
    <div className="codebarres">
      <svg
        viewBox={`0 0 ${dessin.largeur} 30`}
        width={`${largeurMm.toFixed(2)}mm`}
        height="9mm"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Code-barres du ticket ${valeur}`}
      >
        {dessin.barres.map((b) => (
          <rect key={b.x} x={b.x} y="0" width={b.largeur} height="30" fill="#16181a" />
        ))}
      </svg>
      <div className="num">{valeur}</div>
    </div>
  );
};

export const Ticket: React.FC<{
  document: Document;
  reglages: ReglagesTicket;
  /** Le jour de la vente, déjà mis en forme. */
  date: string;
}> = ({ document: d, reglages, date }) => (
  <>
    <div className="c entete">
      {d.emetteur.logoUrl && <img className="logo" src={d.emetteur.logoUrl} alt="" />}
      <div className="nom">{d.emetteur.nom}</div>
      {d.emetteur.lignes.map((l) => (
        <div key={l}>{l}</div>
      ))}
      {d.emetteur.nif && <div>NIF {d.emetteur.nif}</div>}
    </div>

    <Separateur />

    {d.codeBarres && <Ligne gauche="Ticket" droite={d.codeBarres} />}
    <Ligne gauche="Date" droite={`${date}${d.heure ? ` ${d.heure}` : ""}`} />
    {d.meta
      .filter((m) => m.libelle === "Vendeur")
      .map((m) => (
        <Ligne key={m.libelle} gauche={m.libelle} droite={m.valeur} />
      ))}
    <Ligne gauche="Client" droite={d.destinataire.nom} />

    <Separateur />

    <div>
      {d.lignes.map((l) => (
        <div className="art" key={l.id}>
          <div className="n">{l.designation}</div>
          <div className="l">
            {/* Le détail montre le calcul — « 3 × 1 500 » — plutôt que
                la seule quantité. C'est ce qui permet au client de
                vérifier sans reprendre sa calculette. */}
            <span>
              {reglages.detailLignes
                ? `${l.quantite} × ${nombreOuTiret(l.prixUnitaire)}`
                : quantite(l.quantite, l.unite)}
            </span>
            <span>{nombreOuTiret(l.total)}</span>
          </div>
          <EquivalentsArticle montant={l.total} />
        </div>
      ))}
    </div>

    <Separateur />

    {d.totaux.horsTaxe !== null && (
      <Ligne gauche="Total hors taxe" droite={nombre(d.totaux.horsTaxe)} />
    )}
    {d.totaux.tva && (
      <Ligne gauche={`TVA ${d.totaux.tva.taux} %`} droite={nombre(d.totaux.tva.montant)} />
    )}
    <div className="l tot">
      <span>TOTAL</span>
      <span>{montantOuTiret(d.totaux.total, d.devise)}</span>
    </div>
    <EquivalentsTotalTicket total={d.totaux.total} />
    {d.totaux.paye !== null && (
      <Ligne
        gauche={d.totaux.modePaiement ?? d.totaux.libellePaye}
        droite={nombre(d.totaux.paye)}
      />
    )}
    {/* « Rendu 0 » n'apprend rien ; « Reste à payer », si. */}
    {d.totaux.reste !== null && d.totaux.reste > 0 && (
      <div className="l du">
        <span>Reste à payer</span>
        <span>{nombre(d.totaux.reste)}</span>
      </div>
    )}

    <Separateur />

    <div className="c pied">
      {d.messageTicket && <div>{d.messageTicket}</div>}
      {/* La mention qui évite le malentendu. Elle n'est pas réglable :
          c'est elle qui protège la boutique. */}
      <div className="mention">
        Ticket non valable comme facture.
        <br />
        Facture sur demande à la caisse.
      </div>
    </div>

    {reglages.codeBarres && d.codeBarres && (
      <CodeBarres valeur={d.codeBarres} largeurTicket={reglages.largeur} />
    )}
  </>
);
