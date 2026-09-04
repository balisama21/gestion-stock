import React from "react";
import { Lock, KeyRound, Clock, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { SettingsSection, SettingsRow, SaveBar, SettingsFeedback } from "./primitives";

interface SecuritySectionProps {
  masterPin: string;
  setMasterPin: (v: string) => void;
  sessionTimeoutMinutes: number;
  setSessionTimeoutMinutes: (v: number) => void;
  baseline: { pin: string; timeout: number };
  savingSecurity: boolean;
  securitySaved: boolean;
  onSaveSecurity: () => void;

  currentPassword: string;
  setCurrentPassword: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  changingPassword: boolean;
  passwordMessage: { type: "success" | "error"; text: string } | null;
  onChangePassword: (e: React.FormEvent) => void;
}

const TIMEOUT_OPTIONS = [
  { value: 0, label: "Jamais" },
  { value: 3, label: "Après 3 minutes d'inactivité" },
  { value: 5, label: "Après 5 minutes d'inactivité" },
  { value: 15, label: "Après 15 minutes d'inactivité" },
  { value: 30, label: "Après 30 minutes d'inactivité" },
];

export const SecuritySection: React.FC<SecuritySectionProps> = ({
  masterPin,
  setMasterPin,
  sessionTimeoutMinutes,
  setSessionTimeoutMinutes,
  baseline,
  savingSecurity,
  securitySaved,
  onSaveSecurity,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  changingPassword,
  passwordMessage,
  onChangePassword,
}) => {
  const [showPin, setShowPin] = React.useState(false);
  const dirty = masterPin !== baseline.pin || sessionTimeoutMinutes !== baseline.timeout;

  const reset = () => {
    setMasterPin(baseline.pin);
    setSessionTimeoutMinutes(baseline.timeout);
  };

  const pinDefined = masterPin.trim().length > 0;
  const pinInvalid = pinDefined && !/^\d{4,6}$/.test(masterPin.trim());

  return (
    <>
      <SettingsSection
        title="Verrouillage par code PIN"
        description="Un code court demandé à l'ouverture de l'application, en plus de votre mot de passe."
        icon={<Lock className="w-4 h-4" />}
        aside={
          <span className={`app-badge ${pinDefined ? "app-badge-success" : "app-badge-neutral"}`}>
            <ShieldCheck className="h-3 w-3" />
            {pinDefined ? "Actif" : "Inactif"}
          </span>
        }
      >
        <SettingsRow
          label="Code PIN"
          hint="4 à 6 chiffres. Laissez vide pour désactiver le verrouillage."
          htmlFor="security-pin"
        >
          <div className="relative">
            <input
              id="security-pin"
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              value={masterPin}
              onChange={(e) => setMasterPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              maxLength={6}
              autoComplete="off"
              className="app-field pr-11 font-mono tracking-widest"
            />
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPin ? "Masquer le code" : "Afficher le code"}
            >
              {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {pinInvalid && (
            <p className="mt-1.5 text-xs font-medium t-danger">
              Le code doit contenir entre 4 et 6 chiffres.
            </p>
          )}
        </SettingsRow>

        <SettingsRow
          label="Verrouillage automatique"
          hint={
            pinDefined
              ? "Après ce délai sans activité, le code PIN est redemandé."
              : "Sans code PIN défini ci-dessus, ce délai n'a aucun effet."
          }
          htmlFor="security-timeout"
        >
          <div className="relative">
            <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              id="security-timeout"
              value={sessionTimeoutMinutes}
              onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
              disabled={!pinDefined}
              className="app-field pl-9 disabled:opacity-60"
            >
              {TIMEOUT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </SettingsRow>

        <div className="px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-6">
          Quel que soit ce délai, un code PIN défini est systématiquement redemandé à chaque
          nouvelle ouverture du site — nouvel onglet, retour après fermeture du navigateur,
          rechargement de la page.
        </div>
      </SettingsSection>

      <SaveBar
        dirty={dirty && !pinInvalid}
        saving={savingSecurity}
        saved={securitySaved}
        onSave={onSaveSecurity}
        onReset={reset}
      />

      <SettingsSection
        title="Mot de passe"
        description="Votre mot de passe actuel est toujours redemandé avant d'accepter le nouveau."
        icon={<KeyRound className="w-4 h-4" />}
      >
        <form onSubmit={onChangePassword}>
          <SettingsRow
            label="Mot de passe actuel"
            hint="Confirme que c'est bien vous."
            htmlFor="security-current-pw"
          >
            <input
              id="security-current-pw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Mot de passe actuel"
              className="app-field"
            />
          </SettingsRow>

          <SettingsRow
            label="Nouveau mot de passe"
            hint="8 caractères minimum."
            htmlFor="security-new-pw"
          >
            <input
              id="security-new-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Nouveau mot de passe"
              className="app-field"
            />
          </SettingsRow>

          <div className="space-y-3 px-4 py-4 sm:px-6">
            {passwordMessage && (
              <SettingsFeedback type={passwordMessage.type}>
                {passwordMessage.text}
              </SettingsFeedback>
            )}
            <button
              type="submit"
              disabled={changingPassword || !currentPassword || newPassword.length < 8}
              className="app-btn-secondary w-full sm:w-auto"
            >
              <Lock className="w-4 h-4" />
              {changingPassword ? "Changement…" : "Changer le mot de passe"}
            </button>
          </div>
        </form>
      </SettingsSection>
    </>
  );
};
