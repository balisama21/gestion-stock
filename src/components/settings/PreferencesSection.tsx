import React from "react";
import { Sun, Moon, CalendarDays, FileSpreadsheet, ShieldAlert, Trash2 } from "lucide-react";
import { SettingsSection, SettingsRow, SettingsBlock } from "./primitives";
import type { LocaleSetting } from "../../types";

interface PreferencesSectionProps {
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  locale: LocaleSetting;
  setLocale: (l: LocaleSetting) => void;
  onDownloadExcel?: () => void;
  onRequestDeleteAccount: () => void;
}

export const PreferencesSection: React.FC<PreferencesSectionProps> = ({
  theme,
  setTheme,
  locale,
  setLocale,
  onDownloadExcel,
  onRequestDeleteAccount,
}) => (
  <>
    <SettingsSection
      title="Affichage"
      description="La façon dont l'application se présente sur cet appareil."
      icon={<Sun className="w-4 h-4" />}
    >
      <SettingsRow label="Thème" hint="Le mode clair est actif par défaut.">
        <div className="flex w-full gap-1 rounded-xl border border-border bg-muted p-1">
          {(
            [
              { value: "light" as const, label: "Clair", icon: <Sun className="h-4 w-4" /> },
              { value: "dark" as const, label: "Sombre", icon: <Moon className="h-4 w-4" /> },
            ]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              aria-pressed={theme === opt.value}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors ${
                theme === opt.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </SettingsRow>

      <SettingsRow
        label="Format des dates"
        hint={
          locale === "FR"
            ? "Jour/mois/année — 31/12/2026."
            : "Mois/jour/année — 12/31/2026."
        }
        htmlFor="pref-locale"
      >
        <div className="relative">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            id="pref-locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value as LocaleSetting)}
            className="app-field pl-9"
          >
            <option value="FR">Français (JJ/MM/AAAA)</option>
            <option value="US">International (MM/JJ/AAAA)</option>
          </select>
        </div>
      </SettingsRow>
    </SettingsSection>

    {onDownloadExcel && (
      <SettingsSection
        title="Exporter mes données"
        description="Récupérez une copie de vos données dans un classeur Excel."
        icon={<FileSpreadsheet className="w-4 h-4" />}
      >
        <SettingsRow
          label="Classeur Excel"
          hint="Capital, produits, achats, ventes, vendeurs et dépenses, chacun dans son onglet."
        >
          <button type="button" onClick={onDownloadExcel} className="app-btn-secondary w-full">
            <FileSpreadsheet className="h-4 w-4" />
            Télécharger
          </button>
        </SettingsRow>
      </SettingsSection>
    )}

    <SettingsSection
      title="Zone dangereuse"
      description="Ces actions sont définitives et ne peuvent pas être annulées."
      icon={<ShieldAlert className="w-4 h-4" />}
      tone="danger"
    >
      <SettingsBlock className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Supprimer mon compte</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Supprime votre compte, votre boutique et toutes ses données : produits, ventes,
            achats, clients, historique. Rien ne peut être récupéré ensuite.
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestDeleteAccount}
          className="app-btn-danger w-full shrink-0 sm:w-auto"
        >
          <Trash2 className="h-4 w-4" />
          Supprimer
        </button>
      </SettingsBlock>
    </SettingsSection>
  </>
);
