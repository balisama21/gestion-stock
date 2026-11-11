import React from "react";
import { AlertCircle, Phone } from "lucide-react";

/**
 * UNE PERSONNE DANS UNE LISTE : un client, un fournisseur, un prestataire.
 *
 * Une personne ne se lit ni comme un produit ni comme une opération : on
 * la reconnaît à son portrait, on cherche ce qu'on a échangé avec elle et
 * ce qui reste dû, et l'on veut souvent l'appeler. D'où sa forme :
 *
 *   (portrait)  nom                         total     (📞)
 *               téléphone · ville           légende
 *               [1 vente] [Inactif]         [16 000 Ar dû]
 *
 * La bague du portrait dit le statut d'un coup d'œil : verte, rouge
 * quand la personne doit (ou qu'on lui doit) de l'argent, grise quand
 * elle est inactive.
 *
 * Le clic sur la ligne SÉLECTIONNE la personne pour la fiche voisine (un
 * écran maître-détail) ; le bouton d'appel est posé À CÔTÉ du bouton de
 * la ligne, jamais dedans — deux boutons imbriqués ne seraient ni valides
 * ni utilisables au clavier. Les styles sont dans `.app-personne`.
 */
export interface LignePersonneProps {
  nom: string;
  /** Le portrait : un avatar pour un client, une icône de métier sinon. */
  portrait: React.ReactNode;
  /** Le contact, sur une ligne grise : téléphone, ville, entreprise. */
  contact?: (string | null | undefined | false)[];
  /** Les petites étiquettes sous le nom : « 1 vente », « Inactif ». */
  puces?: (string | null | undefined | false)[];
  /** Le chiffre de droite (déjà mis en forme), et ce qu'il compte. */
  total?: string | null;
  legende?: string | null;
  /** Ce qui reste dû (mis en forme), en rouge. Absent ou nul : rien. */
  dette?: string | null;
  inactif?: boolean;
  telephone?: string | null;
  choisie?: boolean;
  onChoisir: () => void;
}

export const LignePersonne: React.FC<LignePersonneProps> = ({
  nom,
  portrait,
  contact = [],
  puces = [],
  total,
  legende,
  dette,
  inactif = false,
  telephone,
  choisie = false,
  onChoisir,
}) => {
  const lesContacts = contact.filter(Boolean).join(" · ");
  const lesPuces = puces.filter(Boolean) as string[];
  const bague = dette ? " doit" : inactif ? " inactive" : "";
  return (
    <div role="listitem" className={`app-personne${choisie ? " est-choisie" : ""}`}>
      <button
        type="button"
        onClick={onChoisir}
        aria-pressed={choisie}
        className="app-personne-corps"
      >
        <span className={`app-personne-portrait${bague}`}>{portrait}</span>
        <span className="app-personne-texte">
          <span className="app-personne-nom">{nom}</span>
          {lesContacts && <span className="app-personne-meta">{lesContacts}</span>}
          {lesPuces.length > 0 && (
            <span className="app-personne-puces">
              {lesPuces.map((p) => (
                <span key={p} className="app-personne-puce">
                  {p}
                </span>
              ))}
            </span>
          )}
        </span>
        {(total || dette) && (
          <span className="app-personne-chiffres">
            {total && <span className="app-personne-total">{total}</span>}
            {total && legende && <span className="app-personne-legende">{legende}</span>}
            {dette && (
              <span className="app-personne-dette">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Reste dû :</span>
                {dette} dû
              </span>
            )}
          </span>
        )}
      </button>
      {telephone && (
        <a
          href={`tel:${telephone.replace(/\s+/g, "")}`}
          className="app-personne-appel"
          aria-label={`Appeler ${nom}`}
        >
          <Phone className="h-[18px] w-[18px]" aria-hidden="true" />
        </a>
      )}
    </div>
  );
};

/** Le portrait d'une entreprise ou d'un métier : son icône, sur un disque. */
export const PortraitIcone: React.FC<{ children: React.ReactNode; taille?: number }> = ({
  children,
  taille = 50,
}) => (
  <span className="app-portrait-icone" style={{ width: taille, height: taille }} aria-hidden="true">
    {children}
  </span>
);
