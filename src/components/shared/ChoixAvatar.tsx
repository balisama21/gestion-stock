import React, { useContext, useEffect, useRef, useState } from "react";
import { Camera, Check, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { AvatarPersonne } from "./AvatarPersonne";
import {
  CHEVEUX,
  COIFFURES,
  FONDS,
  NOMS_COIFFURES,
  PEAUX,
  TENUES,
  fusionnerTraits,
  traitsDe,
  type Traits,
} from "../../lib/avatarPersonne";
import { AvatarsPersonnesContext } from "../../lib/avatarsPersonnes";
import { cleDeNom } from "../../lib/teintes";

/**
 * CHOISIR LE VISAGE D'UNE PERSONNE, OU SA PHOTO.
 *
 * Le visage part de celui que le nom donnait : on ajuste ce qui ne va
 * pas (une coiffure, un teint) sans tout recomposer. La photo est
 * recadrée au carré et réduite avant l'envoi.
 */

type Onglet = "visage" | "photo";

const Pastilles: React.FC<{
  titre: string;
  couleurs: readonly string[];
  valeur: string;
  onChoisir: (c: string) => void;
}> = ({ titre, couleurs, valeur, onChoisir }) => (
  <fieldset className="choix-avatar-ligne">
    <legend>{titre}</legend>
    <div className="choix-avatar-pastilles">
      {couleurs.map((c, i) => (
        <button
          key={c}
          type="button"
          className="choix-avatar-pastille"
          style={{ background: c }}
          aria-label={`${titre} ${i + 1}`}
          aria-pressed={c === valeur}
          onClick={() => onChoisir(c)}
        >
          {c === valeur && <Check aria-hidden="true" />}
        </button>
      ))}
    </div>
  </fieldset>
);

const Bascule: React.FC<{
  libelle: string;
  actif: boolean;
  onChange: (v: boolean) => void;
}> = ({ libelle, actif, onChange }) => (
  <button
    type="button"
    className={`choix-avatar-option${actif ? " on" : ""}`}
    aria-pressed={actif}
    onClick={() => onChange(!actif)}
  >
    {libelle}
  </button>
);

export const ChoixAvatar: React.FC<{
  nom: string;
  open: boolean;
  onClose: () => void;
}> = ({ nom, open, onClose }) => {
  const ctx = useContext(AvatarsPersonnesContext);
  const regle = ctx.regles.get(cleDeNom(nom));
  const [onglet, setOnglet] = useState<Onglet>("visage");
  const [traits, setTraits] = useState<Traits>(() => fusionnerTraits(traitsDe(nom), regle?.traits));
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);

  // À chaque ouverture, on repart de ce qui est enregistré.
  useEffect(() => {
    if (!open) return;
    setTraits(fusionnerTraits(traitsDe(nom), regle?.traits));
    setOnglet(regle?.photoUrl ? "photo" : "visage");
    setFichier(null);
    setErreur(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nom]);

  useEffect(() => {
    if (!fichier) {
      setApercu(null);
      return;
    }
    const url = URL.createObjectURL(fichier);
    setApercu(url);
    return () => URL.revokeObjectURL(url);
  }, [fichier]);

  const changer = <K extends keyof Traits>(cle: K, valeur: Traits[K]) =>
    setTraits((t) => ({ ...t, [cle]: valeur }));

  const agir = async (action: () => Promise<{ error: string | null }> | undefined) => {
    const promesse = action();
    if (!promesse) return;
    setEnCours(true);
    setErreur(null);
    const { error } = await promesse;
    setEnCours(false);
    if (error) setErreur(error);
    else onClose();
  };

  const enregistrer = () =>
    agir(() =>
      onglet === "photo"
        ? fichier
          ? ctx.enregistrerPhoto?.(nom, fichier)
          : Promise.resolve({ error: null })
        : ctx.enregistrerVisage?.(nom, traits),
    );

  const photoAffichee = onglet === "photo" ? (apercu ?? regle?.photoUrl ?? null) : null;
  const rienAEnregistrer = onglet === "photo" && !fichier;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Avatar"
      description={nom}
      size="2xl"
      dismissible={!enCours}
      footer={
        <>
          {regle && (
            <button
              type="button"
              className="app-btn-ghost mr-auto"
              disabled={enCours}
              onClick={() => agir(() => ctx.revenirAuVisageDuNom?.(nom))}
            >
              <RotateCcw className="h-4 w-4" />
              Visage automatique
            </button>
          )}
          <button type="button" className="app-btn-secondary" onClick={onClose} disabled={enCours}>
            Annuler
          </button>
          <button
            type="button"
            className="app-btn-primary"
            onClick={enregistrer}
            disabled={enCours || rienAEnregistrer}
          >
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="choix-avatar">
        <div className="choix-avatar-apercu">
          <AvatarPersonne nom={nom} taille={112} traits={traits} photo={photoAffichee} />
          <div className="choix-avatar-onglets" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={onglet === "visage"}
              onClick={() => setOnglet("visage")}
            >
              Visage
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={onglet === "photo"}
              onClick={() => setOnglet("photo")}
            >
              Photo
            </button>
          </div>
        </div>

        {onglet === "visage" ? (
          <div className="choix-avatar-reglages">
            <fieldset className="choix-avatar-ligne">
              <legend>Coiffure</legend>
              <div className="choix-avatar-coiffures">
                {COIFFURES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={traits.coiffure === c}
                    className="choix-avatar-coiffure"
                    onClick={() => changer("coiffure", c)}
                  >
                    <AvatarPersonne nom={nom} taille={44} traits={{ ...traits, coiffure: c }} />
                    <span>{NOMS_COIFFURES[c]}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <Pastilles
              titre="Teint"
              couleurs={PEAUX}
              valeur={traits.peau}
              onChoisir={(c) => changer("peau", c)}
            />
            <Pastilles
              titre="Cheveux"
              couleurs={CHEVEUX}
              valeur={traits.cheveux}
              onChoisir={(c) => changer("cheveux", c)}
            />
            <Pastilles
              titre="Tenue"
              couleurs={TENUES}
              valeur={traits.tenue}
              onChoisir={(c) => changer("tenue", c)}
            />
            <Pastilles
              titre="Fond"
              couleurs={FONDS}
              valeur={traits.fond}
              onChoisir={(c) => changer("fond", c)}
            />
            <fieldset className="choix-avatar-ligne">
              <legend>Détails</legend>
              <div className="choix-avatar-options">
                <Bascule
                  libelle="Lunettes"
                  actif={traits.lunettes}
                  onChange={(v) => changer("lunettes", v)}
                />
                <Bascule
                  libelle="Barbe"
                  actif={traits.barbe}
                  onChange={(v) => changer("barbe", v)}
                />
                <Bascule
                  libelle="Grand sourire"
                  actif={traits.sourire === "ouvert"}
                  onChange={(v) => changer("sourire", v ? "ouvert" : "doux")}
                />
              </div>
            </fieldset>
          </div>
        ) : (
          <div className="choix-avatar-photo">
            <p>
              Une photo de face, bien éclairée. Elle est recadrée au carré et ne se voit que dans
              votre boutique.
            </p>
            <input
              ref={champFichier}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFichier(f);
                e.target.value = "";
              }}
            />
            <div className="choix-avatar-options">
              <button
                type="button"
                className="app-btn-secondary"
                onClick={() => champFichier.current?.click()}
                disabled={enCours}
              >
                <Camera className="h-4 w-4" />
                {regle?.photoUrl || fichier ? "Changer de photo" : "Choisir une photo"}
              </button>
              {regle?.photoChemin && !fichier && (
                <button
                  type="button"
                  className="app-btn-ghost"
                  disabled={enCours}
                  onClick={() => agir(() => ctx.retirerPhoto?.(nom))}
                >
                  <Trash2 className="h-4 w-4" />
                  Retirer la photo
                </button>
              )}
            </div>
          </div>
        )}

        {erreur && (
          <p className="choix-avatar-erreur" role="alert">
            {erreur}
          </p>
        )}
      </div>
    </Modal>
  );
};

/**
 * Un avatar qu'on peut changer d'un clic : le crayon en coin l'annonce.
 * Tant que la boutique ne permet pas de l'enregistrer, c'est un avatar
 * ordinaire.
 */
export const AvatarModifiable: React.FC<{
  nom: string;
  taille?: number;
  className?: string;
}> = ({ nom, taille = 40, className = "" }) => {
  const { modifiable } = useContext(AvatarsPersonnesContext);
  const [ouvert, setOuvert] = useState(false);
  if (!modifiable || !nom.trim()) {
    return <AvatarPersonne nom={nom} taille={taille} className={className} />;
  }
  return (
    <>
      <button
        type="button"
        className={`avatar-modifiable${className ? ` ${className}` : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setOuvert(true);
        }}
        aria-label={`Changer l'avatar de ${nom}`}
        title="Changer l'avatar"
      >
        <AvatarPersonne nom={nom} taille={taille} />
        <span className="avatar-modifiable-crayon" aria-hidden="true">
          <Pencil />
        </span>
      </button>
      {ouvert && <ChoixAvatar nom={nom} open={ouvert} onClose={() => setOuvert(false)} />}
    </>
  );
};
