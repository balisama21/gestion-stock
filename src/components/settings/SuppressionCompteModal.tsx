import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "../shared/Modal";
import { useAuth } from "../../hooks/useAuth";

interface SuppressionCompteModalProps {
  open: boolean;
  onClose: () => void;
  /** Les boutiques que le compte possède encore (vide = rien ne bloque). */
  boutiques: { id: string; name: string }[];
}

/**
 * SUPPRIMER MON COMPTE.
 *
 * La base refuse de supprimer un compte qui possède encore une boutique
 * (`stores.owner_id` en ON DELETE RESTRICT, migration
 * `historique_survit_au_depart`) : rien ne disparaît en bloc par un seul
 * clic. La fenêtre le dit avant que l'on tape son mot de passe — elle
 * nomme les boutiques à supprimer d'abord, une par une, depuis « Ma
 * boutique » — au lieu de laisser la base répondre par une erreur.
 *
 * Utilisée dans les Paramètres et sur l'écran « aucune boutique », où
 * l'on arrive une fois la dernière boutique supprimée.
 */
export const SuppressionCompteModal: React.FC<SuppressionCompteModalProps> = ({
  open,
  onClose,
  boutiques,
}) => {
  const { reauthenticate, deleteAccount } = useAuth();
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const bloque = boutiques.length > 0;

  const fermer = () => {
    if (enCours) return;
    setMotDePasse("");
    setErreur(null);
    onClose();
  };

  const confirmer = async () => {
    setErreur(null);
    if (!motDePasse) {
      setErreur("Entrez votre mot de passe pour confirmer.");
      return;
    }
    setEnCours(true);
    try {
      const { error: refus } = await reauthenticate(motDePasse);
      if (refus) {
        setErreur(refus);
        return;
      }
      const { error } = await deleteAccount();
      if (error) {
        setErreur(error);
        return;
      }
      // Le compte n'existe plus : signOut() dépendrait d'une session déjà
      // invalidée. Un rechargement ramène sur l'écran de connexion.
      window.location.href = "/";
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={fermer}
      size="md"
      tone="danger"
      icon={<Trash2 className="h-4 w-4" />}
      title="Supprimer mon compte"
      description="Cette action est irréversible."
      dismissible={!enCours}
      footer={
        <>
          <button type="button" onClick={fermer} disabled={enCours} className="app-btn-secondary">
            {bloque ? "Fermer" : "Annuler"}
          </button>
          {!bloque && (
            <button type="button" onClick={confirmer} disabled={enCours} className="app-btn-danger">
              {enCours ? "Suppression..." : "Supprimer mon compte"}
            </button>
          )}
        </>
      }
    >
      {bloque ? (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Votre compte possède encore{" "}
            {boutiques.length === 1 ? "une boutique" : `${boutiques.length} boutiques`}. Pour
            protéger vos données, il ne peut être supprimé qu'une fois{" "}
            {boutiques.length === 1 ? "celle-ci supprimée" : "toutes supprimées"} :
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm font-medium text-foreground">
            {boutiques.map((b) => (
              <li key={b.id}>{b.name}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Ouvrez chaque boutique, puis allez dans{" "}
            <strong className="text-foreground">Ma boutique</strong> → « Supprimer cette boutique ».
          </p>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Votre compte et vos informations personnelles seront supprimés définitivement. Vous
            perdrez aussi l'accès aux boutiques où vous collaborez.
          </p>

          <div className="mt-4">
            <label
              htmlFor="suppression-compte-mdp"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Confirmez avec votre mot de passe
            </label>
            <input
              id="suppression-compte-mdp"
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete="current-password"
              placeholder="Mot de passe actuel"
              className="app-field"
            />
          </div>

          {erreur && <p className="mt-3 text-sm font-medium t-danger">{erreur}</p>}
        </>
      )}
    </Modal>
  );
};
