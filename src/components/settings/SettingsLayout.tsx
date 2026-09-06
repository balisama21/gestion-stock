import React from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  User,
  Shield,
  Store,
  Users,
  CreditCard,
  Bell,
  Receipt,
  Settings as SettingsIcon,
  ListPlus,
  LogOut,
} from "lucide-react";

export type SettingsTab =
  | "compte"
  | "securite"
  | "boutique"
  | "facture"
  | "equipe"
  | "paiement"
  | "notifications"
  | "preferences"
  | "champs";

interface TabDef {
  id: SettingsTab;
  label: string;
  /** Résumé d'une ligne, affiché sous le libellé dans la barre latérale. */
  hint: string;
  icon: React.ReactNode;
  ownerOnly: boolean;
}

interface GroupDef {
  title: string;
  tabs: TabDef[];
}

/**
 * Réglages personnels d'abord, réglages de la boutique ensuite.
 *
 * Ce découpage n'est pas seulement visuel : il correspond exactement à la
 * frontière de permissions. Un collaborateur avec la permission
 * "settings" ne voit que le premier groupe — le second est réservé au
 * propriétaire, quelle que soit la permission accordée. Accorder l'accès
 * aux réglages personnels ne doit jamais ouvrir la gestion de toute la
 * boutique.
 */
const GROUPS: GroupDef[] = [
  {
    title: "Personnel",
    tabs: [
      {
        id: "compte",
        label: "Mon compte",
        hint: "Nom, e-mail, téléphone",
        icon: <User className="w-4 h-4" />,
        ownerOnly: false,
      },
      {
        id: "securite",
        label: "Sécurité",
        hint: "Code PIN, mot de passe",
        icon: <Shield className="w-4 h-4" />,
        ownerOnly: false,
      },
      {
        id: "notifications",
        label: "Notifications",
        hint: "Alertes affichées",
        icon: <Bell className="w-4 h-4" />,
        ownerOnly: false,
      },
      {
        id: "preferences",
        label: "Préférences",
        hint: "Affichage et compte",
        icon: <SettingsIcon className="w-4 h-4" />,
        ownerOnly: false,
      },
    ],
  },
  {
    title: "Boutique",
    tabs: [
      {
        id: "boutique",
        label: "Ma boutique",
        hint: "Identité, devise, TVA",
        icon: <Store className="w-4 h-4" />,
        ownerOnly: true,
      },
      {
        id: "facture",
        label: "Reçus et factures",
        hint: "Contenu des documents",
        icon: <Receipt className="w-4 h-4" />,
        ownerOnly: true,
      },
      {
        id: "champs",
        label: "Champs personnalisés",
        hint: "Vos propres informations",
        icon: <ListPlus className="w-4 h-4" />,
        ownerOnly: true,
      },
      {
        id: "equipe",
        label: "Équipe",
        hint: "Collaborateurs, invitations",
        icon: <Users className="w-4 h-4" />,
        ownerOnly: true,
      },
      {
        id: "paiement",
        label: "Abonnement",
        hint: "Activation, licence",
        icon: <CreditCard className="w-4 h-4" />,
        ownerOnly: true,
      },
    ],
  },
];

interface SettingsLayoutProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  children: React.ReactNode;
  isOwner: boolean;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  activeTab,
  onTabChange,
  children,
  isOwner,
}) => {
  const { signOut, profile } = useAuth();

  const groups = GROUPS.map((g) => ({
    ...g,
    tabs: g.tabs.filter((t) => isOwner || !t.ownerOnly),
  })).filter((g) => g.tabs.length > 0);

  const flatTabs = groups.flatMap((g) => g.tabs);
  const current = flatTabs.find((t) => t.id === activeTab) ?? flatTabs[0];

  return (
    <div className="space-y-5 pb-16">
      {/* En-tête de page */}
      <div className="app-page-head">
        <div className="app-page-head-text">
          <h1 className="app-page-title">
            <SettingsIcon className="w-5 h-5 shrink-0 text-muted-foreground" />
            <span className="truncate">Paramètres</span>
          </h1>
          <p className="app-page-subtitle truncate">
            {profile?.email || "Gérez votre compte et votre boutique"}
          </p>
        </div>
      </div>

      {/* Onglets défilants — sous 1024px */}
      <div className="app-scroll-x -mx-4 px-4 lg:hidden">
        <div className="flex w-max gap-2 pb-1">
          {flatTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? "border-success-border bg-success-soft t-success"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Barre latérale — à partir de 1024px */}
        <nav className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 space-y-5">
            {groups.map((group) => (
              <div key={group.title}>
                <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {group.title}
                </div>
                <div className="space-y-0.5">
                  {group.tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        aria-current={isActive ? "page" : undefined}
                        className={`relative flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                          isActive ? "bg-success-soft" : "hover:bg-muted"
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                        )}
                        <span
                          className={`mt-0.5 shrink-0 ${isActive ? "t-success" : "text-muted-foreground"}`}
                        >
                          {tab.icon}
                        </span>
                        <span className="min-w-0">
                          <span
                            className={`block truncate text-sm font-semibold ${
                              isActive ? "t-success" : "text-foreground"
                            }`}
                          >
                            {tab.label}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {tab.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="border-t border-border pt-3">
              <button
                onClick={() => {
                  if (window.confirm("Voulez-vous vraiment vous déconnecter ?")) signOut();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold t-danger transition-colors hover:bg-danger-soft"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </nav>

        {/* Contenu */}
        <div className="min-w-0 flex-1 space-y-5">
          {/* Rappel du contexte sur mobile, où la barre latérale est masquée */}
          {current && (
            <div className="lg:hidden">
              <h2 className="text-lg font-bold text-foreground">{current.label}</h2>
              <p className="text-sm text-muted-foreground">{current.hint}</p>
            </div>
          )}

          {children}

          {/* Déconnexion accessible aussi sur mobile */}
          <div className="lg:hidden">
            <button
              onClick={() => {
                if (window.confirm("Voulez-vous vraiment vous déconnecter ?")) signOut();
              }}
              className="app-btn-secondary w-full t-danger"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
