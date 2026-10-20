import React, { useState } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";
import { SettingsSection, SettingsBlock } from "./primitives";
import { Modal } from "../shared/Modal";

interface SuppressionBoutiqueSectionProps {
  /** La boutique ouverte, celle — et la seule — que le bouton supprime. */
  nomBoutique: string;
  /**
   * Faux quand c'est la dernière boutique du compte : la supprimer
   * laisserait un compte sans rien à ouvrir. Pour tout effacer, c'est
   * « Supprimer mon compte », dans Préférences.
   */
  peutSupprimer: boolean;
  /** Vérifie le mot de passe actuel ; renvoie un message d'erreur, ou null. */
  reauthentifier: (motDePasse: string) => Promise<{ error: string | null }>;
  supprimer: () => Promise<{ error: string | null }>;
}

/**
 * SUPPRIMER CETTE BOUTIQUE — et rien d'autre.
 *
 * Avant, le seul « Supprimer » des Paramètres était celui du compte : on
 * croyait effacer une boutique, et le compte partait avec toutes les
 * autres. Ce bloc vit dans « Ma boutique », nomme la boutique visée, et
 * dit en toutes lettres que le compte et les autres boutiques restent.
 */
export const SuppressionBoutiqueSection: React.FC<SuppressionBoutiqueSectionProps> = ({
  nomBoutique,
  peutSupprimer,
  reauthentifier,
  supprimer,
}) => {
  const [ouverte, setOuverte] = useState(false);
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const fermer = () => {
    if (enCours) return;
    setOuverte(false);
    setMotDePasse("");
    setErreur(null);
  };

  const confirmer = async () => {
    setErreur(null);
    if (!motDePasse) {
      setErreur("Entrez votre mot de passe pour confirmer.");
      return;
    }
    setEnCours(true);
    try {
      const { error: refus } = await reauthentifier(motDePasse);
      if (refus) {
        setErreur(refus);
        return;
      }
      const { error } = await supprimer();
      if (error) {
        setErreur(error);
        return;
      }
      setOuverte(false);
      setMotDePasse("");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <>
      <SettingsSection
        title="Zone dangereuse"
        description="Cette action est définitive et ne peut pas être annulée."
        icon={<ShieldAlert className="w-4 h-4" />}
        tone="danger"
      >
        <SettingsBlock className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Supprimer cette boutique</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {peutSupprimer
                ? `Supprime « ${nomBoutique} » et toutes ses données. Votre compte et vos autres boutiques ne sont pas touchés.`
                : "C'est la seule boutique de votre compte. Pour tout effacer, utilisez « Supprimer mon compte » dans Préférences."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOuverte(true)}
            disabled={!peutSupprimer}
            className="app-btn-danger w-full shrink-0 sm:w-auto"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </button>
        </SettingsBlock>
      </SettingsSection>

      <Modal
        open={ouverte}
        onClose={fermer}
        size="md"
        tone="danger"
        icon={<Trash2 className="h-4 w-4" />}
        title="Supprimer la boutique"
        description={nomBoutique}
        dismissible={!enCours}
        footer={
          <>
            <button type="button" onClick={fermer} disabled={enCours} className="app-btn-secondary">
              Annuler
            </button>
            <button type="button" onClick={confirmer} disabled={enCours} className="app-btn-danger">
              {enCours ? "Suppression..." : "Supprimer la boutique"}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          « {nomBoutique} » et toutes ses données — produits, ventes, achats, clients, équipe,
          historique — seront supprimés définitivement.
        </p>
        <p className="mt-2 text-sm font-medium t-success">
          Votre compte et vos autres boutiques ne sont pas touchés.
        </p>

        <div className="mt-4">
          <label
            htmlFor="suppression-boutique-mdp"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Confirmez avec votre mot de passe
          </label>
          <input
            id="suppression-boutique-mdp"
            type="password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            autoComplete="current-password"
            placeholder="Mot de passe actuel"
            className="app-field"
          />
        </div>

        {erreur && <p className="mt-3 text-sm font-medium t-danger">{erreur}</p>}
      </Modal>
    </>
  );
};
