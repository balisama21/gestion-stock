import React from "react";
import { UserPlus, Users, Copy, Check, Trash2, Mail, ShieldCheck, KeyRound } from "lucide-react";
import { SettingsSection, SettingsBlock, SettingsFeedback } from "./primitives";
import { InviteWizard } from "../permissions/InviteWizard";
import { ModulePermissionCard } from "../permissions/ModulePermissionCard";
import {
  MODULE_DEFINITIONS,
  summarizePermissions,
  type PermissionsMap,
  type RoleKey,
} from "../../lib/permissions";

export interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  permissions: PermissionsMap;
  full_name: string | null;
  email: string;
}

/** Demande déposée depuis l'écran « mot de passe oublié ». */
export interface RecoveryRequest {
  id: string;
  email: string;
  /** Nul quand aucune adresse ne correspond : une faute de frappe, le plus souvent. */
  user_id: string | null;
  /** Boutique du demandeur, parmi celles que possède l'utilisateur courant. */
  store_id: string | null;
  requested_at: string;
}

interface PendingInvitation {
  id: string;
  invited_email: string;
  role: string;
  token: string;
  invite_code: string | null;
  store_id: string;
}

interface TeamSectionProps {
  ownedStores: { id: string; name: string }[];
  defaultStoreId: string;
  inviting: boolean;
  inviteStatus: string;
  lastInviteLink: string | null;
  lastInviteCode: string | null;
  onSendInvitation: (data: {
    email: string;
    storeId: string;
    role: RoleKey;
    permissions: PermissionsMap;
  }) => void;

  pendingInvitations: PendingInvitation[];
  members: TeamMember[];

  editingMemberId: string | null;
  editingPermissions: PermissionsMap;
  setEditingPermissions: React.Dispatch<React.SetStateAction<PermissionsMap>>;
  savingMemberPermissions: boolean;
  onEditPermissions: (member: TeamMember) => void;
  onCancelEdit: () => void;
  onSaveMemberPermissions: () => void;
  onRemoveMember: (id: string) => void;

  /** Membre dont le lien de récupération est affiché, s'il y en a un. */
  recoveryTargetId: string | null;
  recoveryLink: string | null;
  recoveryError: string | null;
  generatingRecoveryFor: string | null;
  onGenerateRecoveryLink: (member: TeamMember) => void;
  onCloseRecoveryLink: () => void;

  recoveryRequests: RecoveryRequest[];
  onGenerateForRequest: (demande: RecoveryRequest) => void;
  onDismissRequest: (demande: RecoveryRequest) => void;
}

const CopyField: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé par le navigateur : la valeur reste
      // sélectionnable à la main dans le champ.
    }
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className={`app-field-sm flex-1 ${mono ? "text-center font-mono tracking-widest" : "font-mono"}`}
        />
        <button
          type="button"
          onClick={copy}
          className="app-btn-icon shrink-0"
          aria-label={copied ? "Copié" : `Copier ${label}`}
        >
          {copied ? <Check className="h-4 w-4 t-success" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};

export const TeamSection: React.FC<TeamSectionProps> = ({
  ownedStores,
  defaultStoreId,
  inviting,
  inviteStatus,
  lastInviteLink,
  lastInviteCode,
  onSendInvitation,
  pendingInvitations,
  members,
  editingMemberId,
  editingPermissions,
  setEditingPermissions,
  savingMemberPermissions,
  onEditPermissions,
  onCancelEdit,
  onSaveMemberPermissions,
  onRemoveMember,
  recoveryTargetId,
  recoveryLink,
  recoveryError,
  generatingRecoveryFor,
  onGenerateRecoveryLink,
  onCloseRecoveryLink,
  recoveryRequests,
  onGenerateForRequest,
  onDismissRequest,
}) => (
  <>
    <SettingsSection
      title="Inviter un collaborateur"
      description="Choisissez un rôle pour appliquer un profil de permissions recommandé, puis ajustez chaque module avant l'envoi."
      icon={<UserPlus className="w-4 h-4" />}
    >
      <SettingsBlock className="space-y-4">
        <InviteWizard
          stores={ownedStores}
          defaultStoreId={defaultStoreId}
          submitting={inviting}
          onSubmit={onSendInvitation}
        />

        {inviteStatus && (
          <SettingsFeedback type={inviteStatus.includes("Erreur") ? "error" : "success"}>
            {inviteStatus}
          </SettingsFeedback>
        )}

        {(lastInviteLink || lastInviteCode) && (
          <div className="space-y-3 rounded-xl border border-success-border bg-success-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-wide t-success">
              À partager vous-même
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              L'envoi automatique par e-mail reste peu fiable tant qu'un domaine professionnel
              n'est pas configuré. Transmettez le lien ou le code à la personne invitée. Ils ne
              fonctionnent que pour l'adresse e-mail saisie ci-dessus.
            </p>
            {lastInviteLink && <CopyField label="Lien d'invitation" value={lastInviteLink} />}
            {lastInviteCode && <CopyField label="Code d'invitation" value={lastInviteCode} mono />}
          </div>
        )}
      </SettingsBlock>

      {pendingInvitations.length > 0 && (
        <SettingsBlock>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Invitations en attente ({pendingInvitations.length})
          </p>
          <ul className="space-y-1.5">
            {pendingInvitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-3 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm text-foreground">{inv.invited_email}</span>
                </span>
                <span className="app-badge app-badge-warning shrink-0">{inv.role}</span>
              </li>
            ))}
          </ul>
        </SettingsBlock>
      )}
    </SettingsSection>

    {/* Les demandes déposées depuis « mot de passe oublié ».
        Le demandeur n'apprend jamais si son adresse est connue ; ici,
        au contraire, la distinction est dite, parce qu'elle décide de
        ce qu'il y a à faire : délivrer un lien, ou rappeler à la
        personne qu'elle s'est trompée d'adresse. */}
    {recoveryRequests.length > 0 && (
      <SettingsSection
        title="Demandes de mot de passe"
        description="Ces personnes ont demandé à réinitialiser leur mot de passe. Délivrez-leur un lien et transmettez-le par un canal sûr."
        icon={<KeyRound className="w-4 h-4" />}
        aside={
          <span className="app-badge app-badge-warning">
            {recoveryRequests.length} en attente
          </span>
        }
      >
        {recoveryRequests.map((demande) => (
          <SettingsBlock key={demande.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{demande.email}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Demandé le{" "}
                  {new Date(demande.requested_at).toLocaleString("fr-FR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
                {demande.user_id ? (
                  demande.store_id ? (
                    <p className="mt-1 text-xs t-success">Compte reconnu dans votre équipe.</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Compte reconnu, mais hors de vos boutiques — vous ne pouvez pas agir
                      dessus.
                    </p>
                  )
                ) : (
                  <p className="mt-1 text-xs t-warning">
                    Aucun compte à cette adresse. La personne s'est probablement trompée en la
                    saisissant.
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {demande.user_id && demande.store_id && (
                  <button
                    type="button"
                    onClick={() => onGenerateForRequest(demande)}
                    disabled={generatingRecoveryFor === demande.id}
                    className="app-btn-secondary min-w-0 flex-1 text-xs disabled:opacity-60 sm:flex-none"
                  >
                    {generatingRecoveryFor === demande.id ? "Génération…" : "Générer le lien"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDismissRequest(demande)}
                  className="app-btn-secondary min-w-0 flex-1 text-xs sm:flex-none"
                >
                  Marquer traitée
                </button>
              </div>
            </div>

            {recoveryTargetId === demande.id && (recoveryLink || recoveryError) && (
              <div className="mt-3 rounded-xl border border-border bg-muted p-3">
                {recoveryError ? (
                  <p className="text-xs t-danger">{recoveryError}</p>
                ) : (
                  <>
                    <CopyField label="Lien de réinitialisation" value={recoveryLink!} />
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      Transmettez ce lien à {demande.email} par un canal sûr. Il ne sert
                      qu'une fois, expire rapidement, et quiconque l'ouvre avant elle prend
                      la main sur son compte.
                    </p>
                  </>
                )}
                <button
                  type="button"
                  onClick={onCloseRecoveryLink}
                  className="mt-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Masquer
                </button>
              </div>
            )}
          </SettingsBlock>
        ))}
      </SettingsSection>
    )}

    <SettingsSection
      title="Collaborateurs"
      description="Les personnes qui ont accepté votre invitation. Modifiez à tout moment ce que chacune peut voir."
      icon={<Users className="w-4 h-4" />}
      aside={
        <span className="app-badge app-badge-neutral">
          {members.length} membre{members.length > 1 ? "s" : ""}
        </span>
      }
    >
      {members.length === 0 ? (
        <SettingsBlock>
          <p className="py-2 text-sm text-muted-foreground">
            Personne n'a encore rejoint cette boutique. Envoyez une invitation ci-dessus pour
            ajouter un collaborateur.
          </p>
        </SettingsBlock>
      ) : (
        members.map((member) => {
          const isEditing = editingMemberId === member.id;
          const summary = summarizePermissions(member.permissions);

          return (
            <SettingsBlock key={member.id}>
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {member.full_name || member.email}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {MODULE_DEFINITIONS.map((def) => (
                      <ModulePermissionCard
                        key={def.key}
                        def={def}
                        value={editingPermissions[def.key]}
                        onChange={(next) =>
                          setEditingPermissions((prev) => ({
                            ...prev,
                            [def.key]: next ?? { visible: false },
                          }))
                        }
                      />
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onCancelEdit} className="app-btn-ghost">
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={onSaveMemberPermissions}
                      disabled={savingMemberPermissions}
                      className="app-btn-primary"
                    >
                      {savingMemberPermissions ? "Enregistrement…" : "Enregistrer les permissions"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-bold uppercase text-muted-foreground">
                      {(member.full_name || member.email).charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {member.full_name || member.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs">
                        <ShieldCheck
                          className={`h-3 w-3 shrink-0 ${
                            summary.modulesCount === 0 ? "text-muted-foreground" : "t-success"
                          }`}
                        />
                        <span
                          className={
                            summary.modulesCount === 0 ? "text-muted-foreground" : "t-success"
                          }
                        >
                          {summary.modulesCount === 0
                            ? "Aucun accès accordé"
                            : `${summary.modulesCount} module${summary.modulesCount > 1 ? "s" : ""} autorisé${summary.modulesCount > 1 ? "s" : ""}`}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onEditPermissions(member)}
                      className="app-btn-secondary min-w-0 flex-1 text-xs sm:flex-none"
                    >
                      Modifier les accès
                    </button>
                    <button
                      type="button"
                      onClick={() => onGenerateRecoveryLink(member)}
                      disabled={generatingRecoveryFor === member.id}
                      className="app-btn-secondary min-w-0 flex-1 text-xs disabled:opacity-60 sm:flex-none"
                    >
                      {generatingRecoveryFor === member.id
                        ? "Génération…"
                        : "Lien de mot de passe"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Retirer ${member.full_name || member.email} de cette boutique ?`,
                          )
                        ) {
                          onRemoveMember(member.id);
                        }
                      }}
                      className="app-btn-icon shrink-0 hover:border-danger-border hover:bg-danger-soft"
                      aria-label={`Retirer ${member.full_name || member.email}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Le lien de réinitialisation, quand il vient d'être
                  produit pour ce membre. Il donne le contrôle du compte
                  à qui le détient : on le dit, et il n'est affiché
                  qu'une fois — le régénérer est immédiat, le laisser
                  traîner à l'écran ne l'est pas. */}
              {recoveryTargetId === member.id && (recoveryLink || recoveryError) && (
                <div className="mt-3 rounded-xl border border-border bg-muted p-3">
                  {recoveryError ? (
                    <p className="text-xs t-danger">{recoveryError}</p>
                  ) : (
                    <>
                      <CopyField label="Lien de réinitialisation" value={recoveryLink!} />
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        Transmettez ce lien à {member.full_name || member.email} par un canal
                        sûr. Il permet de choisir un nouveau mot de passe, ne sert qu'une
                        fois et expire rapidement — quiconque l'ouvre avant lui prend la main
                        sur son compte.
                      </p>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={onCloseRecoveryLink}
                    className="mt-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Masquer
                  </button>
                </div>
              )}
            </SettingsBlock>
          );
        })
      )}
    </SettingsSection>
  </>
);
