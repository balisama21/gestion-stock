import React from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  User,
  Shield,
  Store,
  Users,
  CreditCard,
  Bell,
  Settings as SettingsIcon,
  LogOut,
  Menu,
} from "lucide-react";

export type SettingsTab =
  "compte" | "securite" | "boutique" | "equipe" | "paiement" | "notifications" | "preferences";

interface SettingsLayoutProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  children: React.ReactNode;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  activeTab,
  onTabChange,
  children,
}) => {
  const { signOut, profile } = useAuth();
  const tabs = [
    { id: "compte", label: "Mon compte", icon: <User className="w-4 h-4" /> },
    { id: "securite", label: "Sécurité", icon: <Shield className="w-4 h-4" /> },
    { id: "boutique", label: "Ma boutique", icon: <Store className="w-4 h-4" /> },
    { id: "equipe", label: "Équipe & invitations", icon: <Users className="w-4 h-4" /> },
    { id: "paiement", label: "Paiements & activation", icon: <CreditCard className="w-4 h-4" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "preferences", label: "Préférences", icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="pb-16 flex flex-col md:flex-row gap-6">
      {/* Mobile Select Navigation */}
      <div className="md:hidden bg-card border border-border p-3 rounded-2xl shadow-sm mb-2">
        <label className="text-xs text-muted-foreground font-semibold flex items-center gap-2 mb-2">
          <Menu className="w-4 h-4" /> Menu des Paramètres
        </label>
        <div className="relative">
          <select
            value={activeTab}
            onChange={(e) => onTabChange(e.target.value as SettingsTab)}
            className="w-full appearance-none bg-background border border-border text-foreground font-semibold py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
            <svg
              className="fill-current h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar Navigation */}
      <div className="hidden md:flex flex-col w-64 shrink-0 bg-card border border-border rounded-2xl overflow-hidden shadow-sm h-fit sticky top-4">
        <div className="p-4 border-b border-border bg-muted/30">
          <h2 className="font-bold text-foreground text-lg">Paramètres</h2>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {profile?.email || "Gérez votre compte"}
          </p>
        </div>
        <div className="flex flex-col p-2 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as SettingsTab)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className={activeTab === tab.id ? "text-emerald-500" : "text-muted-foreground"}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}

          <div className="h-px bg-border my-2 mx-2"></div>

          <button
            onClick={() => {
              if (window.confirm("Voulez-vous vraiment vous déconnecter ?")) signOut();
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};
