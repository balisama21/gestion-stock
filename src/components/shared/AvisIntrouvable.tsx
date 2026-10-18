import React from "react";
import { SearchX } from "lucide-react";
import { Modal } from "./Modal";

/**
 * Ce qu'on dit quand une notification vise un enregistrement qui n'est
 * plus là : supprimé depuis, ou hors de ce que vos droits laissent voir.
 *
 * Sans cet avis, le clic ouvrait l'écran sur une liste vide, et l'on
 * cherchait en vain une ligne qui n'existait plus.
 */
export const AvisIntrouvable: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => (
  <Modal
    open={open}
    onClose={onClose}
    size="sm"
    title="Introuvable"
    footer={
      <button type="button" onClick={onClose} className="app-btn-primary">
        Compris
      </button>
    }
  >
    <div className="flex items-start gap-3 text-sm text-muted-foreground">
      <SearchX className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/70" />
      <p>
        La fiche demandée n&apos;est plus disponible : elle a été supprimée, ou elle ne fait plus
        partie de ce que vous pouvez consulter. La liste complète reste affichée derrière.
      </p>
    </div>
  </Modal>
);
