import React from "react";
import { Eraser } from "lucide-react";
import { Modal } from "../shared/Modal";
import { FORCES, detourerFondUni, type ResultatDetourage } from "../../lib/detourage";

interface DetourerPhotoProps {
  /** La photo de depart. */
  fichier: File;
  open: boolean;
  onClose: () => void;
  /** Appelee avec la photo detouree quand l'utilisateur la garde. */
  onGarder: (detoure: File) => Promise<void> | void;
}

/** Le damier qui rend la transparence visible, comme dans un editeur d'image. */
const DAMIER = "repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%) 50% / 14px 14px";

/**
 * Retirer le fond d'une photo de produit, sous les yeux de son
 * proprietaire.
 *
 * ── Pourquoi un apercu, et pas un traitement automatique ──
 *
 * Un detourage rate ne se rattrape pas : il mange un bord du produit,
 * ou il laisse le fond en place. Applique tout seul a l'import, il
 * abimerait la photo sans que personne ne l'ait vu venir. Ici, on
 * REGARDE avant de garder, et l'on peut toujours renoncer.
 *
 * ── Les trois fermetes ──
 *
 * Un fond blanc franc part au premier essai ; un fond creme, ombre ou
 * legerement degrade demande d'insister. Mais insister mange aussi les
 * parties claires du produit. Trois boutons plutot qu'un reglage fin :
 * on essaie, on regarde, on choisit — ce qui va plus vite que de
 * comprendre ce qu'est une tolerance.
 *
 * ── Les deux garde-fous ──
 *
 * Presque rien retire, ou presque tout : dans les deux cas le resultat
 * est inutilisable, et l'ecran le dit au lieu de laisser enregistrer
 * une photo vide ou inchangee.
 */
export const DetourerPhoto: React.FC<DetourerPhotoProps> = ({
  fichier,
  open,
  onClose,
  onGarder,
}) => {
  const [force, setForce] = React.useState<number>(FORCES[1].tolerance);
  const [resultat, setResultat] = React.useState<ResultatDetourage | null>(null);
  const [calcul, setCalcul] = React.useState(false);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enregistrement, setEnregistrement] = React.useState(false);

  const avant = React.useMemo(() => (open ? URL.createObjectURL(fichier) : ""), [open, fichier]);
  const apres = React.useMemo(
    () => (resultat ? URL.createObjectURL(resultat.fichier) : ""),
    [resultat],
  );
  React.useEffect(() => () => URL.revokeObjectURL(avant), [avant]);
  React.useEffect(() => () => URL.revokeObjectURL(apres), [apres]);

  React.useEffect(() => {
    if (!open) return;
    let vivant = true;
    setCalcul(true);
    setErreur(null);
    detourerFondUni(fichier, force)
      .then((r) => vivant && setResultat(r))
      .catch((e) => vivant && setErreur(e instanceof Error ? e.message : String(e)))
      .finally(() => vivant && setCalcul(false));
    return () => {
      vivant = false;
    };
  }, [open, fichier, force]);

  const part = resultat ? resultat.retire : 0;
  const tropPeu = Boolean(resultat) && part < 0.02;
  const trop = Boolean(resultat) && part > 0.97;

  const garder = async () => {
    if (!resultat) return;
    setEnregistrement(true);
    try {
      await onGarder(resultat.fichier);
      onClose();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<Eraser className="h-4 w-4" />}
      title="Détourer la photo"
      description="Retirer le fond pour ne garder que l'article, posé sur du vide."
      dismissible={!enregistrement}
      footer={
        <>
          <button type="button" onClick={onClose} className="app-btn-secondary">
            Annuler
          </button>
          <button
            type="button"
            onClick={garder}
            disabled={!resultat || calcul || enregistrement || tropPeu || trop}
            className="app-btn-primary"
          >
            <Eraser className="h-4 w-4" />
            {enregistrement ? "Enregistrement…" : "Garder cette version"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <figure className="min-w-0">
            <img src={avant} alt="" className="h-44 w-full object-contain" />
            <figcaption className="mt-1 text-center text-xs text-muted-foreground">
              Avant
            </figcaption>
          </figure>
          <figure className="min-w-0">
            <img
              src={apres}
              alt=""
              className={`h-44 w-full object-contain transition-opacity ${
                calcul ? "opacity-40" : ""
              }`}
              style={{ background: DAMIER }}
            />
            <figcaption className="mt-1 text-center text-xs text-muted-foreground">
              {calcul ? "Calcul…" : "Après"}
            </figcaption>
          </figure>
        </div>

        <div>
          <p className="app-label">Fermeté du détourage</p>
          <div className="flex flex-wrap gap-2">
            {FORCES.map((f) => (
              <button
                key={f.cle}
                type="button"
                onClick={() => setForce(f.tolerance)}
                aria-pressed={force === f.tolerance}
                className={`app-chip ${force === f.tolerance ? "app-chip-active" : ""}`}
              >
                {f.libelle}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Un fond blanc franc part du premier coup. Un fond crème, ombré ou dégradé demande
            d&apos;insister — mais insister mange aussi les parties claires de l&apos;article.
          </p>
        </div>

        {/* ── Ce que l'on dit plutôt que de laisser enregistrer ── */}
        {tropPeu && (
          <p className="rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm t-warning">
            Presque rien n&apos;a été retiré. Ce fond n&apos;est probablement pas uni — essayez une
            fermeté plus forte, ou reprenez la photo sur un fond clair et uniforme.
          </p>
        )}
        {trop && (
          <p className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-sm t-danger">
            Presque toute la photo a disparu : l&apos;article est trop proche de la couleur du fond.
            Essayez une fermeté plus prudente.
          </p>
        )}
        {!tropPeu && !trop && resultat && !calcul && (
          <p className="text-xs text-muted-foreground">
            {Math.round(part * 100)} % de la photo retiré. La photo d&apos;origine sera remplacée
            par cette version.
          </p>
        )}
        {erreur && (
          <p className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-sm t-danger">
            {erreur}
          </p>
        )}
      </div>
    </Modal>
  );
};
