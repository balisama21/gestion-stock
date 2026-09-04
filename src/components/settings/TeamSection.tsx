import React from "react";
import { UserPlus, Users, Copy, Check, Trash2, Mail, ShieldCheck } from "lucide-react";
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

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => onEditPermissions(member)}
                      className="app-btn-secondary flex-1 text-xs sm:flex-none"
                    >
                      Modifier les accès
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
            </SettingsBlock>
          );
        })
      )}
    </SettingsSection>
  </>
);
