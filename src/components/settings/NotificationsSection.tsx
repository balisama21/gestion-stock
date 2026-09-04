import React from "react";
import { Bell, Package, Zap, Wallet, Monitor } from "lucide-react";
import { SettingsSection, SettingsRow, SettingsToggle } from "./primitives";
import { useNotificationPrefs } from "../../lib/notificationPrefs";

export const NotificationsSection: React.FC = () => {
  const [prefs, update] = useNotificationPrefs();

  return (
    <SettingsSection
      title="Alertes"
      description="Choisissez ce que l'application vous signale pendant que vous travaillez."
      icon={<Bell className="w-4 h-4" />}
    >
      <SettingsRow
        label="Alertes de stock bas"
        hint="Dans la cloche en haut de l'écran, dès qu'un produit passe sous son seuil."
        htmlFor="notif-stock"
      >
        <div className="flex items-center gap-3 sm:justify-end">
          <Package className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden" />
          <SettingsToggle
            id="notif-stock"
            label="Alertes de stock bas"
            checked={prefs.stockAlerts}
            onChange={(v) => update({ stockAlerts: v })}
          />
        </div>
      </SettingsRow>

      <SettingsRow
        label="Activité des vendeurs"
        hint="Un bandeau apparaît brièvement quand un vendeur enregistre une vente ou une dépense."
        htmlFor="notif-activity"
      >
        <div className="flex items-center gap-3 sm:justify-end">
          <Zap className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden" />
          <SettingsToggle
            id="notif-activity"
            label="Activité des vendeurs"
            checked={prefs.activityAlerts}
            onChange={(v) => update({ activityAlerts: v })}
          />
        </div>
      </SettingsRow>

      <SettingsRow
        label="Alertes de trésorerie"
        hint="Les bandeaux du tableau de bord quand la trésorerie passe sous votre seuil ou devient négative."
        htmlFor="notif-treasury"
      >
        <div className="flex items-center gap-3 sm:justify-end">
          <Wallet className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden" />
          <SettingsToggle
            id="notif-treasury"
            label="Alertes de trésorerie"
            checked={prefs.treasuryAlerts}
            onChange={(v) => update({ treasuryAlerts: v })}
          />
        </div>
      </SettingsRow>

      <div className="flex items-start gap-2.5 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-6">
        <Monitor className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Ces réglages sont enregistrés sur cet appareil et prennent effet immédiatement. Ils ne
          suivent pas si vous vous connectez depuis un autre téléphone ou ordinateur.
        </span>
      </div>
    </SettingsSection>
  );
};
