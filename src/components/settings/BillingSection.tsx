import React from "react";
import {
  CheckCircle2,
  Sparkles,
  Lock,
  Phone,
  KeyRound,
  ShieldCheck,
  Copy,
  Check,
  Users,
} from "lucide-react";
import { SettingsSection, SettingsRow, SettingsBlock, SettingsFeedback } from "./primitives";

interface StoreNeedingActivation {
  id: string;
  name: string;
  activation_status: string;
  trial_ends_at: string;
  owner_email: string;
  owner_name: string | null;
}

interface BillingSectionProps {
  storeName?: string;
  activatedAt?: string | null;
  storeIsActive: boolean;
  storeIsLocked: boolean;
  isTrial: boolean;
  daysRemaining: number;
  trialEndsAt: Date | null;

  myLicenseCode: string | null;
  loadingMyLicense: boolean;

  mvolaNumber: string;
  adminContact: string;

  activationCodeInput: string;
  setActivationCodeInput: (v: string) => void;
  activating: boolean;
  activationError: string | null;
  onActivate: (e: React.FormEvent) => void;

  isPlatformAdmin: boolean;
  storesNeedingActivation: StoreNeedingActivation[];
  loadingStoresNeedingActivation: boolean;
  selectedStoreToActivateId: string | null;
  setSelectedStoreToActivateId: (id: string) => void;
  generatedCode: string;
  setGeneratedCode: (v: string) => void;
  generatingCode: boolean;
  onGenerateCode: () => void;
}

const StatusCard: React.FC<{
  tone: "success" | "info" | "danger";
  icon: React.ReactNode;
  badge: string;
  title: string;
  children: React.ReactNode;
}> = ({ tone, icon, badge, title, children }) => {
  const toneClasses = {
    success: "border-success-border bg-success-soft",
    info: "border-info-border bg-info-soft",
    danger: "border-danger-border bg-danger-soft",
  }[tone];
  const textTone = { success: "t-success", info: "t-info", danger: "t-danger" }[tone];

  return (
    <div className={`app-card border p-4 sm:p-6 ${toneClasses}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-card ${textTone}`}
        >
          {icon}
        </span>
        <span className={`app-badge shrink-0 border-transparent bg-card ${textTone}`}>{badge}</span>
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
};

export const BillingSection: React.FC<BillingSectionProps> = ({
  storeName,
  activatedAt,
  storeIsActive,
  storeIsLocked,
  isTrial,
  daysRemaining,
  trialEndsAt,
  myLicenseCode,
  loadingMyLicense,
  mvolaNumber,
  adminContact,
  activationCodeInput,
  setActivationCodeInput,
  activating,
  activationError,
  onActivate,
  isPlatformAdmin,
  storesNeedingActivation,
  loadingStoresNeedingActivation,
  selectedStoreToActivateId,
  setSelectedStoreToActivateId,
  generatedCode,
  setGeneratedCode,
  generatingCode,
  onGenerateCode,
}) => {
  const [copied, setCopied] = React.useState(false);
  const telHref = `tel:${adminContact.replace(/\s/g, "")}`;

  const copyGenerated = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard?.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers refusé : le champ reste sélectionnable */
    }
  };

  return (
    <>
      {storeIsActive && (
        <StatusCard
          tone="success"
          icon={<CheckCircle2 className="h-5 w-5" />}
          badge="Active — à vie"
          title="Votre boutique est active"
        >
          <p>
            Vous pouvez utiliser {storeName || "votre boutique"} sans limite, à vie. Aucune action
            n'est nécessaire.
          </p>
          {activatedAt && (
            <p className="mt-2 text-xs">
              Activée le {new Date(activatedAt).toLocaleDateString("fr-FR")}
            </p>
          )}
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide">
              Code d'activation utilisé
            </p>
            <p className="rounded-xl border border-border bg-card p-3 text-center font-mono text-sm tracking-wider text-foreground">
              {loadingMyLicense
                ? "Chargement…"
                : myLicenseCode || "Activée par l'administrateur"}
            </p>
          </div>
        </StatusCard>
      )}

      {isTrial && !storeIsLocked && (
        <StatusCard
          tone="info"
          icon={<Sparkles className="h-5 w-5" />}
          badge="Essai gratuit"
          title={`Il vous reste ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}`}
        >
          <p>
            Votre essai se termine le{" "}
            <strong className="text-foreground">
              {trialEndsAt?.toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </strong>
            . Activez votre boutique avant cette date pour ne pas être interrompu.
          </p>
        </StatusCard>
      )}

      {storeIsLocked && (
        <StatusCard
          tone="danger"
          icon={<Lock className="h-5 w-5" />}
          badge="Verrouillée"
          title="Votre période d'essai est terminée"
        >
          <p>
            Votre boutique est temporairement verrouillée. Activez-la ci-dessous pour retrouver un
            accès normal.
          </p>
        </StatusCard>
      )}

      {!storeIsActive && (
        <>
          <SettingsSection
            title="Activer par paiement"
            description={`Payez 100 000 Ar via MVola, puis envoyez la référence de transaction à l'administrateur pour recevoir votre code.`}
            icon={<Phone className="w-4 h-4" />}
          >
            <SettingsRow label="Numéro MVola" hint="Destinataire du paiement.">
              <p className="rounded-xl border border-border bg-muted p-3 text-center font-mono text-lg font-bold tracking-wider text-foreground">
                {mvolaNumber}
              </p>
            </SettingsRow>

            <SettingsRow
              label="Contact administrateur"
              hint="Envoyez-lui votre référence de transaction."
            >
              <a href={telHref} className="app-btn-secondary w-full">
                <Phone className="h-4 w-4" />
                {adminContact}
              </a>
            </SettingsRow>
          </SettingsSection>

          <SettingsSection
            title="Activer avec un code"
            description="Vous avez déjà reçu un code de l'administrateur ? Entrez-le pour activer votre boutique immédiatement."
            icon={<KeyRound className="w-4 h-4" />}
          >
            <form onSubmit={onActivate}>
              <SettingsRow label="Code d'activation" htmlFor="billing-code">
                <input
                  id="billing-code"
                  type="text"
                  value={activationCodeInput}
                  onChange={(e) => setActivationCodeInput(e.target.value.toUpperCase())}
                  placeholder="BLSM-XXXX-XXXX"
                  maxLength={20}
                  className="app-field text-center font-mono tracking-widest"
                />
              </SettingsRow>
              <SettingsBlock className="space-y-3">
                {activationError && (
                  <SettingsFeedback type="error">{activationError}</SettingsFeedback>
                )}
                <button
                  type="submit"
                  disabled={activating || !activationCodeInput.trim()}
                  className="app-btn-primary w-full sm:w-auto"
                >
                  {activating ? "Vérification…" : "Activer ma boutique"}
                </button>
              </SettingsBlock>
            </form>
          </SettingsSection>
        </>
      )}

      {storeIsActive && (
        <SettingsSection
          title="Licences supplémentaires"
          description="Pour gérer une autre boutique, un nouveau code d'activation est nécessaire."
          icon={<KeyRound className="w-4 h-4" />}
        >
          <SettingsRow label="Acheter un code" hint="100 000 Ar par boutique, activation à vie.">
            <a href={telHref} className="app-btn-secondary w-full">
              <Phone className="h-4 w-4" />
              Contacter l'administrateur
            </a>
          </SettingsRow>
        </SettingsSection>
      )}

      {isPlatformAdmin && (
        <SettingsSection
          title="Gestion des codes d'activation"
          description="Réservé à l'administrateur de la plateforme. Un code généré n'activera que la boutique sélectionnée."
          icon={<ShieldCheck className="w-4 h-4" />}
        >
          {storesNeedingActivation.length > 0 && (
            <SettingsRow label="Boutique concernée" htmlFor="admin-store">
              <select
                id="admin-store"
                value={selectedStoreToActivateId ?? ""}
                onChange={(e) => setSelectedStoreToActivateId(e.target.value)}
                className="app-field"
              >
                {storesNeedingActivation.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} — {store.owner_name || store.owner_email} (
                    {store.activation_status === "trial" ? "essai" : "verrouillée"})
                  </option>
                ))}
              </select>
            </SettingsRow>
          )}

          <SettingsRow label="Code généré" htmlFor="admin-code">
            <div className="flex gap-2">
              <input
                id="admin-code"
                type="text"
                value={generatedCode}
                onChange={(e) => setGeneratedCode(e.target.value.toUpperCase())}
                onFocus={(e) => e.currentTarget.select()}
                placeholder="—"
                className="app-field flex-1 font-mono uppercase"
              />
              <button
                type="button"
                onClick={copyGenerated}
                disabled={!generatedCode}
                className="app-btn-icon shrink-0"
                aria-label="Copier le code"
              >
                {copied ? <Check className="h-4 w-4 t-success" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </SettingsRow>

          <SettingsBlock>
            <button
              type="button"
              onClick={onGenerateCode}
              disabled={generatingCode || !selectedStoreToActivateId}
              className="app-btn-primary w-full sm:w-auto"
            >
              {generatingCode ? "Génération…" : "Générer un code"}
            </button>
          </SettingsBlock>

          <SettingsBlock>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4 t-success" />
              Boutiques non activées ({storesNeedingActivation.length})
            </p>
            {loadingStoresNeedingActivation ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : storesNeedingActivation.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Toutes les boutiques sont activées pour le moment.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {storesNeedingActivation.map((store) => {
                  const expired = new Date(store.trial_ends_at).getTime() < Date.now();
                  const daysLeft = Math.max(
                    0,
                    Math.ceil(
                      (new Date(store.trial_ends_at).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24),
                    ),
                  );
                  return (
                    <li
                      key={store.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="font-medium text-foreground">{store.name}</span>{" "}
                        <span className="text-xs text-muted-foreground">({store.owner_email})</span>
                      </span>
                      <span
                        className={`app-badge shrink-0 ${expired ? "app-badge-danger" : "app-badge-warning"}`}
                      >
                        {expired ? "Essai expiré" : `${daysLeft} j restant${daysLeft > 1 ? "s" : ""}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SettingsBlock>
        </SettingsSection>
      )}
    </>
  );
};
