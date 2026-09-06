import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Layers, ShieldOff } from "lucide-react";
import {
  MODULE_DEFINITIONS,
  ROLE_TEMPLATES,
  ROLE_LABELS,
  RoleKey,
  PermissionsMap,
  summarizePermissions,
} from "../../lib/permissions";
import { ModulePermissionCard } from "./ModulePermissionCard";

interface StoreOption {
  id: string;
  name: string;
}

interface InviteWizardProps {
  stores: StoreOption[];
  defaultStoreId: string;
  submitting: boolean;
  onSubmit: (data: {
    email: string;
    storeId: string;
    role: RoleKey;
    permissions: PermissionsMap;
  }) => void;
}

const ROLE_KEYS: RoleKey[] = ["vendeur", "gestionnaire_stock", "comptable", "manager", "admin"];

export const InviteWizard: React.FC<InviteWizardProps> = ({
  stores,
  defaultStoreId,
  submitting,
  onSubmit,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [roleKey, setRoleKey] = useState<RoleKey>("vendeur");
  const [permissions, setPermissions] = useState<PermissionsMap>(ROLE_TEMPLATES.vendeur);
  const [customized, setCustomized] = useState(false);

  useEffect(() => {
    setStoreId(defaultStoreId);
  }, [defaultStoreId]);

  // Changer de rôle réapplique le gabarit recommandé (l'admin peut ensuite
  // toujours personnaliser librement à l'étape 3).
  const handleRoleChange = (next: RoleKey) => {
    setRoleKey(next);
    setPermissions(ROLE_TEMPLATES[next]);
    setCustomized(false);
  };

  const updateModule = (moduleKey: string, next: any) => {
    setPermissions((prev) => ({ ...prev, [moduleKey]: next }));
    setCustomized(true);
  };

  const summary = summarizePermissions(permissions);
  const canGoStep2 = email.trim().length > 3 && email.includes("@") && !!storeId;

  const resetWizard = () => {
    setStep(1);
    setEmail("");
    setRoleKey("vendeur");
    setPermissions(ROLE_TEMPLATES.vendeur);
    setCustomized(false);
  };

  const handleFinalSubmit = () => {
    onSubmit({ email: email.trim(), storeId, role: roleKey, permissions });
    resetWizard();
  };

  const stepLabels = ["Informations", "Profil recommandé", "Personnaliser"];

  return (
    <div className="space-y-5">
      {/* Fil d'étapes, cliquable.
          Revenir en arrière est toujours permis : rien n'est envoyé
          avant le bouton final, et les choix déjà faits sont conservés
          en état. Avancer, en revanche, suppose une adresse valide et
          une boutique — sans quoi l'étape suivante parlerait d'un
          invité qui n'existe pas encore. */}
      <div className="flex items-center gap-2">
        {stepLabels.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const active = step === n;
          const done = step > n;
          const accessible = n === 1 || canGoStep2;
          return (
            <React.Fragment key={label}>
              <button
                type="button"
                onClick={() => setStep(n)}
                disabled={!accessible}
                aria-current={active ? "step" : undefined}
                title={
                  accessible
                    ? `Aller à l'étape ${n} — ${label}`
                    : "Renseignez d'abord l'adresse e-mail de l'invité"
                }
                className={`flex items-center gap-2 rounded-lg p-1 transition-colors ${
                  accessible && !active ? "hover:bg-muted" : ""
                } ${accessible ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    active
                      ? "bg-emerald-600 text-white"
                      : done
                        ? "bg-success-soft t-success"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {n}
                </span>
                <span
                  className={`text-xs font-semibold hidden sm:inline ${active ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </span>
              </button>
              {i < stepLabels.length - 1 && <div className="h-px flex-1 bg-border" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* ÉTAPE 1 — Informations */}
      {step === 1 && (
        <div className="space-y-4">
          {stores.length > 1 && (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Boutique concernée
              </label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                L'invité rejoindra UNIQUEMENT cette boutique, jamais vos autres boutiques.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              Adresse e-mail du collaborateur
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="collaborateur@email.com"
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Rôle</label>
            <select
              value={roleKey}
              onChange={(e) => handleRoleChange(e.target.value as RoleKey)}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground"
            >
              {ROLE_KEYS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Un profil de permissions recommandé sera appliqué automatiquement — personnalisable
              à l'étape suivante.
            </p>
          </div>

          <button
            type="button"
            disabled={!canGoStep2}
            onClick={() => setStep(2)}
            className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl"
          >
            Continuer <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ÉTAPE 2 — Résumé du profil recommandé */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4.5 h-4.5 t-success" />
              <h4 className="font-bold text-foreground">
                Profil recommandé pour : {ROLE_LABELS[roleKey].toUpperCase()}
              </h4>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-background rounded-xl p-3">
                <div className="text-xl font-bold t-success">{summary.modulesCount}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  module{summary.modulesCount > 1 ? "s" : ""} accessible
                  {summary.modulesCount > 1 ? "s" : ""}
                </div>
              </div>
              <div className="bg-background rounded-xl p-3">
                <div className="text-xl font-bold t-info">{summary.actionsCount}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  permission{summary.actionsCount > 1 ? "s" : ""} activée
                  {summary.actionsCount > 1 ? "s" : ""}
                </div>
              </div>
              <div className="bg-background rounded-xl p-3">
                <div className="text-xl font-bold t-warning">{summary.hiddenFieldsCount}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  info{summary.hiddenFieldsCount > 1 ? "s" : ""} masquée
                  {summary.hiddenFieldsCount > 1 ? "s" : ""}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {MODULE_DEFINITIONS.map((def) => {
              const visible = permissions[def.key]?.visible === true;
              return (
                <span
                  key={def.key}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                    visible
                      ? "bg-success-soft border-success-border t-success"
                      : "bg-muted border-border text-muted-foreground line-through"
                  }`}
                >
                  {def.label}
                </span>
              );
            })}
          </div>

          {/* Trois libellés longs ne tiennent pas sur une ligne de
              téléphone : ils s'empilent en dessous de `sm`. En ligne,
              `min-w-0` autorise enfin les boutons `flex-1` à se
              réduire — sans lui, un élément flex garde la largeur de
              son texte et déborde de l'écran. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-muted hover:bg-accent text-muted-foreground rounded-xl font-semibold text-sm sm:shrink-0"
            >
              <ChevronLeft className="w-4 h-4" /> Retour
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex min-w-0 flex-1 items-center justify-center gap-2 px-4 py-2.5 bg-muted hover:bg-accent border border-border text-foreground font-bold rounded-xl text-sm"
            >
              <Layers className="w-4 h-4 shrink-0" /> Personnaliser les accès
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleFinalSubmit}
              className="min-w-0 flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl text-sm"
            >
              {submitting ? "Envoi..." : "Utiliser ce profil"}
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 3 — Personnalisation détaillée par module */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Cliquez sur un module pour l'activer/désactiver et ajuster son détail (portée,
              actions, informations visibles).
            </p>
            {customized && (
              <span className="flex items-center gap-1 text-[11px] font-semibold t-warning shrink-0 ml-3">
                <ShieldOff className="w-3.5 h-3.5" /> Personnalisé
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODULE_DEFINITIONS.map((def) => (
              <ModulePermissionCard
                key={def.key}
                def={def}
                value={permissions[def.key]}
                onChange={(next) => updateModule(def.key, next ?? { visible: false })}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-muted hover:bg-accent text-muted-foreground rounded-xl font-semibold text-sm sm:shrink-0"
            >
              <ChevronLeft className="w-4 h-4" /> Retour
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleFinalSubmit}
              className="min-w-0 flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl"
            >
              {submitting ? "Envoi..." : "Envoyer l'invitation"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};