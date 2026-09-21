import React, { useState } from "react";
import { Bell, Mail, Package, Zap, Wallet, Monitor } from "lucide-react";
import { SettingsSection, SettingsRow, SettingsToggle, SettingsFeedback } from "./primitives";
import { useNotificationPrefs } from "../../lib/notificationPrefs";
import { useAbonnementAlertesStock } from "../../hooks/useAbonnementAlertesStock";

/**
 * Ce que l'application vous signale, à vous.
 *
 * ── Deux natures de réglages, et il faut le dire ──
 *
 * Les trois premiers ne décident que de ce qui s'affiche : ils vivent
 * dans le navigateur, et ne suivent pas d'un appareil à l'autre. C'est
 * assumé, et écrit en bas de la section.
 *
 * Le résumé de préalerte par e-mail, lui, part d'un serveur vers une
 * boîte aux lettres : il ne peut pas être une préférence d'appareil, et
 * il est donc enregistré en base, attaché à la personne et à la
 * boutique. Le pied de page distingue les deux plutôt que de mentir sur
 * l'un des deux.
 *
 * ── Pourquoi il est ICI et non dans « Alertes de stock » ──
 *
 * Cette section-là règle la BOUTIQUE — le mode, la valeur, l'heure — et
 * n'est ouverte qu'au propriétaire. Recevoir un e-mail est une décision
 * personnelle, que chacun prend pour lui : elle appartient au groupe
 * « Personnel », que tout le monde voit.
 */

interface NotificationsSectionProps {
  /** La boutique active, pour l'abonnement au résumé de préalerte. */
  storeId: string | null;
  /** Qui est connecté : chacun ne règle que le sien. */
  userId: string | null;
  /**
   * Vrai quand la boutique a activé la préalerte.
   *
   * Faux, la ligne n'apparaît pas : proposer de s'abonner à un e-mail
   * que rien n'enverra ferait attendre pour rien.
   */
  prealerteActive: boolean;
}

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  storeId,
  userId,
  prealerteActive,
}) => {
  const [prefs, update] = useNotificationPrefs();
  const { abonne, chargement, basculer } = useAbonnementAlertesStock(storeId, userId);
  const [erreur, setErreur] = useState<string | null>(null);

  const changerAbonnement = async (veut: boolean) => {
    setErreur(null);
    const { error } = await basculer(veut);
    if (error) setErreur(error);
  };

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

      {prealerteActive && (
        <SettingsRow
          label="Résumé de préalerte par e-mail"
          hint="La liste des produits qui approchent de leur seuil, envoyée à votre adresse. Vous seul décidez de la recevoir, et vous pouvez vous retirer à tout moment."
          htmlFor="prealerte-abonnement"
        >
          <div className="flex items-center gap-3 sm:justify-end">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden" />
            <SettingsToggle
              id="prealerte-abonnement"
              label="Résumé de préalerte par e-mail"
              checked={abonne}
              disabled={chargement || !storeId || !userId}
              onChange={changerAbonnement}
            />
          </div>
        </SettingsRow>
      )}

      {erreur && (
        <div className="px-4 py-3 sm:px-6">
          <SettingsFeedback type="error">{erreur}</SettingsFeedback>
        </div>
      )}

      <div className="flex items-start gap-2.5 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-6">
        <Monitor className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Les trois premiers réglages sont enregistrés sur cet appareil et prennent effet
          immédiatement. Ils ne suivent pas si vous vous connectez depuis un autre téléphone ou
          ordinateur.
          {prealerteActive && (
            <> L&apos;e-mail, lui, est attaché à votre compte et vous suit partout.</>
          )}
        </span>
      </div>
    </SettingsSection>
  );
};
