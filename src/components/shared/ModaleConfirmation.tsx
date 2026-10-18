import React from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Modal } from "./Modal";

export interface OptionsConfirmation {
  /** Titre court de la modale. La question, elle, va dans le corps. */
  titre?: string;
  /** Texte du bouton qui confirme. */
  libelle?: string;
  /** Texte du bouton qui renonce. */
  libelleAnnuler?: string;
  /** Suppression, retrait, départ sans enregistrer : en-tête et bouton rouges. */
  danger?: boolean;
}

export interface DemandeConfirmation extends OptionsConfirmation {
  question: string;
}

interface ModaleConfirmationProps {
  open: boolean;
  demande: DemandeConfirmation | null;
  /** Vrai pendant la sortie : la réponse est donnée, on ne répond pas deux fois. */
  repondu: boolean;
  onRepondre: (oui: boolean) => void;
}

/**
 * La modale elle-même. On ne la monte pas à la main : `useConfirmation`
 * (src/hooks/useConfirmation.tsx) la fournit, déjà branchée.
 */
export const ModaleConfirmation: React.FC<ModaleConfirmationProps> = ({
  open,
  demande,
  repondu,
  onRepondre,
}) => {
  const danger = demande?.danger ?? false;
  return (
    <Modal
      open={open}
      onClose={() => onRepondre(false)}
      size="sm"
      premierPlan
      tone={danger ? "danger" : "default"}
      icon={danger ? <AlertTriangle className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
      title={demande?.titre ?? "Confirmation"}
      footer={
        <>
          <button
            type="button"
            onClick={() => onRepondre(false)}
            disabled={repondu}
            className="app-btn-secondary"
          >
            {demande?.libelleAnnuler ?? "Annuler"}
          </button>
          <button
            type="button"
            onClick={() => onRepondre(true)}
            disabled={repondu}
            className={danger ? "app-btn-danger" : "app-btn-primary"}
          >
            {demande?.libelle ?? "Confirmer"}
          </button>
        </>
      }
    >
      {/* `pre-line` : plusieurs questions portent un paragraphe
          d'explication après un saut de ligne. */}
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
        {demande?.question}
      </p>
    </Modal>
  );
};
