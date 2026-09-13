import React, { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { SettingsSection, SettingsBlock, SettingsFeedback } from "./primitives";
import { Modal } from "../shared/Modal";
import type { TeamMember } from "./TeamSection";

interface TransfertBoutiqueSectionProps {
  nomBoutique: string;
  /** Les membres de cette boutique, livreurs compris : on filtre ici. */
  membres: TeamMember[];
  /** Renvoie un message d'erreur, ou null si la boutique a changé de mains. */
  onTransferer: (userId: string) => Promise<string | null>;
}

/**
 * Transmettre une boutique à quelqu'un d'autre.
 *
 * ── Pourquoi cet écran existe ──
 *
 * Les écritures commerciales ne disparaissent plus avec le compte de
 * celui qui les a saisies, et la boutique refuse désormais qu'on
 * supprime son propriétaire. Ce refus est la bonne protection, mais il
 * n'a de sens que si l'on peut faire passer la boutique à quelqu'un
 * d'autre — sans quoi un propriétaire qui s'en va bloquerait
 * indéfiniment son propre compte.
 *
 * ── Ce que l'écran ne décide pas ──
 *
 * Rien. Toutes les règles vivent dans la base : seul le propriétaire
 * peut transmettre, le destinataire doit déjà faire partie de l'équipe,
 * et un livreur ne peut pas recevoir la boutique. L'écran ne propose que
 * des destinataires valables et affiche le refus tel que la base le
 * formule ; il ne redouble pas les contrôles, il les rend lisibles.
 *
 * ── Pourquoi deux gestes ──
 *
 * Choisir puis confirmer. L'action est irréversible du point de vue de
 * celui qui la déclenche : une fois la boutique transmise, lui seul ne
 * peut plus la reprendre. Une liste déroulante qu'on effleure ne doit
 * pas suffire à donner son commerce.
 */
export const TransfertBoutiqueSection: React.FC<TransfertBoutiqueSectionProps> = ({
  nomBoutique,
  membres,
  onTransferer,
}) => {
  const [choisi, setChoisi] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState(false);

  // Un livreur ne reçoit pas la boutique — la base le refuse, l'écran
  // n'a donc pas à le proposer pour le voir échouer ensuite.
  const eligibles = useMemo(() => membres.filter((m) => m.role !== "livreur"), [membres]);
  const destinataire = eligibles.find((m) => m.user_id === choisi) ?? null;
  const nomDe = (m: TeamMember) => m.full_name?.trim() || m.email;

  const transferer = async () => {
    if (!destinataire) return;
    setEnCours(true);
    setErreur(null);
    const message = await onTransferer(destinataire.user_id);
    setEnCours(false);
    if (message) {
      setErreur(message);
      return;
    }
    setConfirmation(false);
    setChoisi("");
    setFait(true);
  };

  return (
    <>
      <SettingsSection
        title="Transmettre la boutique"
        description={`Confier « ${nomBoutique} » et tout son historique à un membre de l'équipe.`}
        icon={<ArrowLeftRight className="h-4 w-4" />}
        tone="danger"
      >
        <SettingsBlock className="space-y-4">
          {fait && (
            <SettingsFeedback type="success">
              La boutique a changé de mains. Vous restez dans l&apos;équipe, mais vous
              n&apos;en êtes plus le propriétaire.
            </SettingsFeedback>
          )}

          {eligibles.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Vous ne pouvez transmettre cette boutique qu&apos;à quelqu&apos;un qui fait déjà
              partie de l&apos;équipe. Invitez d&apos;abord la personne ci-dessus, puis
              revenez ici. Un livreur ne peut pas recevoir une boutique.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="transfert-destinataire"
                  className="block text-sm font-medium text-foreground"
                >
                  Nouveau propriétaire
                </label>
                <select
                  id="transfert-destinataire"
                  value={choisi}
                  onChange={(e) => {
                    setChoisi(e.target.value);
                    setErreur(null);
                    setFait(false);
                  }}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-foreground"
                >
                  <option value="">Choisir un membre de l&apos;équipe…</option>
                  {eligibles.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {nomDe(m)}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Vous resterez dans l&apos;équipe avec tous les droits, mais c&apos;est cette
                  personne qui décidera ensuite de vos accès.
                </p>
              </div>

              {erreur && <SettingsFeedback type="error">{erreur}</SettingsFeedback>}

              <button
                type="button"
                disabled={!destinataire}
                onClick={() => {
                  setErreur(null);
                  setConfirmation(true);
                }}
                className="app-btn-secondary w-full disabled:opacity-50 sm:w-auto"
              >
                Transmettre la boutique
              </button>
            </>
          )}
        </SettingsBlock>
      </SettingsSection>

      <Modal
        open={confirmation}
        onClose={() => setConfirmation(false)}
        size="md"
        tone="danger"
        icon={<ArrowLeftRight className="h-4 w-4" />}
        title="Transmettre la boutique"
        description="Vous ne pourrez pas revenir en arrière vous-même."
        dismissible={!enCours}
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmation(false)}
              disabled={enCours}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={transferer}
              disabled={enCours}
              className="app-btn-danger"
            >
              {enCours ? "Transmission…" : "Oui, transmettre"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm leading-relaxed text-foreground">
          <p>
            <span className="font-medium">{nomBoutique}</span> et tout ce qu&apos;elle
            contient — ventes, produits, achats, clients, historique — passeront à{" "}
            <span className="font-medium">{destinataire ? nomDe(destinataire) : ""}</span>.
          </p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>Aucune donnée n&apos;est perdue : la boutique change de mains, c&apos;est tout.</li>
            <li>
              Vous restez dans l&apos;équipe avec tous les droits, mais le nouveau
              propriétaire pourra vous les retirer.
            </li>
            <li>
              Seul lui pourra vous rendre la boutique. Assurez-vous d&apos;être d&apos;accord
              tous les deux avant de continuer.
            </li>
          </ul>
          {erreur && <SettingsFeedback type="error">{erreur}</SettingsFeedback>}
        </div>
      </Modal>
    </>
  );
};
