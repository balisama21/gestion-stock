import React, { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import {
  ModuleDef,
  ModulePermission,
  DataScope,
  DASHBOARD_WIDGETS,
  ALL_DASHBOARD_WIDGET_KEYS,
} from "../../lib/permissions";

interface ModulePermissionCardProps {
  def: ModuleDef;
  value: ModulePermission | undefined;
  onChange: (next: ModulePermission | undefined) => void;
  /** Ouvert par défaut (utile en édition d'un seul module) */
  defaultOpen?: boolean;
}

const SCOPE_LABELS: Record<DataScope, string> = {
  own: "Ses propres données uniquement",
  team: "Les données de son équipe",
  all: "Toutes les données de la boutique",
};

/**
 * Une carte par module (Dashboard, Clients, Ventes...). Cliquer dessus
 * déplie un panneau de configuration détaillé : portée des données,
 * actions autorisées, champs/informations sensibles visibles. Réutilisée
 * à la fois dans l'assistant d'invitation et dans l'édition d'un
 * collaborateur déjà actif.
 */
export const ModulePermissionCard: React.FC<ModulePermissionCardProps> = ({
  def,
  value,
  onChange,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const visible = value?.visible === true;

  const toggleVisible = () => {
    if (visible) {
      onChange({ visible: false });
      setOpen(false);
    } else {
      // Réactivation : accès complet par défaut à ce module, l'admin
      // peut ensuite restreindre en dépliant le détail.
      onChange({
        visible: true,
        scope: def.hasScope ? "all" : undefined,
        actions: def.actions.map((a) => a.key),
        fields: def.fields.map((f) => f.key),
        widgets: def.key === "dashboard" ? [...ALL_DASHBOARD_WIDGET_KEYS] : undefined,
      });
      if (def.actions.length > 0 || def.fields.length > 0 || def.hasScope || def.key === "dashboard") {
        setOpen(true);
      }
    }
  };

  const setScope = (scope: DataScope) => {
    onChange({ ...(value ?? { visible: true }), visible: true, scope });
  };

  const toggleAction = (actionKey: string) => {
    const current = value?.actions ?? [];
    const next = current.includes(actionKey)
      ? current.filter((a) => a !== actionKey)
      : [...current, actionKey];
    onChange({ ...(value ?? { visible: true }), visible: true, actions: next });
  };

  const toggleField = (fieldKey: string) => {
    const current = value?.fields ?? def.fields.map((f) => f.key);
    const next = current.includes(fieldKey)
      ? current.filter((f) => f !== fieldKey)
      : [...current, fieldKey];
    onChange({ ...(value ?? { visible: true }), visible: true, fields: next });
  };

  const toggleWidget = (widgetKey: string) => {
    const current = value?.widgets ?? [...ALL_DASHBOARD_WIDGET_KEYS];
    const next = current.includes(widgetKey)
      ? current.filter((w) => w !== widgetKey)
      : [...current, widgetKey];
    onChange({ ...(value ?? { visible: true }), visible: true, widgets: next });
  };

  const hasDetail =
    def.key === "dashboard" || def.hasScope || def.actions.length > 0 || def.fields.length > 0;

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        visible ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/40"
      }`}
    >
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={toggleVisible}
          className={`w-10 h-6 rounded-full relative shrink-0 transition-colors ${
            visible ? "bg-emerald-500" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              visible ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => visible && hasDetail && setOpen((o) => !o)}
          className="flex-1 flex items-center justify-between text-left"
        >
          <span className={`font-semibold ${visible ? "text-foreground" : "text-muted-foreground"}`}>
            {def.label}
          </span>
          {visible && hasDetail && (
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </button>
      </div>

      {visible && open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/60 pt-4">
          {/* Cas spécial Dashboard : widgets groupés par catégorie */}
          {def.key === "dashboard" && (
            <div className="space-y-3">
              {Object.entries(DASHBOARD_WIDGETS).map(([groupKey, group]) => (
                <div key={groupKey}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {group.items.map((item) => {
                      const checked = (value?.widgets ?? ALL_DASHBOARD_WIDGET_KEYS).includes(item.key);
                      return (
                        <label
                          key={item.key}
                          className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleWidget(item.key)}
                            className="w-3.5 h-3.5 rounded border-muted-foreground/40 accent-emerald-500"
                          />
                          {item.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Portée des données */}
          {def.hasScope && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Accès aux données
              </p>
              <div className="space-y-1.5">
                {(["own", "team", "all"] as DataScope[]).map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none"
                  >
                    <input
                      type="radio"
                      name={`scope-${def.key}`}
                      checked={(value?.scope ?? "all") === s}
                      onChange={() => setScope(s)}
                      className="w-3.5 h-3.5 accent-emerald-500"
                    />
                    {SCOPE_LABELS[s]}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Actions autorisées */}
          {def.actions.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Actions autorisées
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {def.actions.map((action) => {
                  const checked = (value?.actions ?? []).includes(action.key);
                  return (
                    <label
                      key={action.key}
                      className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAction(action.key)}
                        className="w-3.5 h-3.5 rounded border-muted-foreground/40 accent-emerald-500"
                      />
                      {action.label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Champs / informations sensibles */}
          {def.fields.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Informations visibles
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {def.fields.map((field) => {
                  const checked = (value?.fields ?? def.fields.map((f) => f.key)).includes(
                    field.key,
                  );
                  return (
                    <label
                      key={field.key}
                      className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleField(field.key)}
                        className="w-3.5 h-3.5 rounded border-muted-foreground/40 accent-emerald-500"
                      />
                      {field.label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {visible && !open && hasDetail && (
        <div className="px-4 pb-3 -mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="w-3 h-3" />
          Configuré — cliquez pour ajuster
        </div>
      )}
    </div>
  );
};