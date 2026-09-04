import React from "react";
import { Receipt, RotateCcw, Monitor } from "lucide-react";
import { SettingsSection, SettingsRow, SettingsBlock } from "./primitives";
import { Toggle } from "../shared/Toggle";
import { useInvoicePrefs, type InvoicePrefs } from "../../lib/invoicePrefs";
import type { StoreSettings } from "../../types";

interface InvoiceSectionProps {
  settings: StoreSettings;
}

const OPTIONS: { key: keyof InvoicePrefs; label: string; hint: string }[] = [
  { key: "showLogo", label: "Logo", hint: "En haut du document." },
  { key: "showAddress", label: "Adresse", hint: "Adresse de la boutique." },
  { key: "showPhone", label: "Téléphone", hint: "Pour que le client puisse vous joindre." },
  { key: "showEmail", label: "E-mail", hint: "E-mail de la boutique." },
  { key: "showNif", label: "NIF & STAT", hint: "Obligatoire sur une facture officielle." },
  { key: "showSeller", label: "Nom du vendeur", hint: "Qui a réalisé la vente." },
  { key: "showTva", label: "Ligne de TVA", hint: "Sans effet si votre taux est à 0." },
  { key: "showFooter", label: "Mention de bas de page", hint: "Le texte défini ci-dessus." },
];

/**
 * Aperçu en direct du ticket, reconstruit à partir des mêmes données que
 * le vrai reçu : ce que l'utilisateur voit ici est ce qui sortira à
 * l'impression.
 */
const Preview: React.FC<{ settings: StoreSettings; prefs: InvoicePrefs }> = ({
  settings,
  prefs,
}) => {
  const devise = settings.currencySymbol || "Ar";
  const tva = settings.tvaRate ?? 0;
  const sousTotal = 54000;
  const montantTva = prefs.showTva && tva > 0 ? Math.round((sousTotal * tva) / 100) : 0;

  return (
    <div className="mx-auto w-full max-w-[280px] rounded-xl border border-slate-200 bg-white p-4 font-mono text-[10px] leading-relaxed text-slate-900 shadow-sm">
      <div className="text-center">
        {prefs.showLogo &&
          (settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt=""
              className="mx-auto mb-2 h-10 w-10 rounded object-cover"
            />
          ) : (
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-[8px] text-slate-400">
              logo
            </div>
          ))}
        <p className="text-[11px] font-bold uppercase">{settings.storeName || "Ma boutique"}</p>
        {prefs.showAddress && settings.address && <p>{settings.address}</p>}
        {prefs.showPhone && settings.phone && <p>Tél : {settings.phone}</p>}
        {prefs.showEmail && settings.email && <p>{settings.email}</p>}
        {prefs.showNif && settings.nifStat && <p>NIF/STAT : {settings.nifStat}</p>}
      </div>

      <div className="my-2 border-t border-dashed border-slate-300" />

      <div className="flex justify-between">
        <span>Reçu N°</span>
        <span>V001</span>
      </div>
      <div className="flex justify-between">
        <span>Date</span>
        <span>04/09/2026</span>
      </div>
      {prefs.showSeller && (
        <div className="flex justify-between">
          <span>Vendeur</span>
          <span>Hery</span>
        </div>
      )}

      <div className="my-2 border-t border-dashed border-slate-300" />

      <div className="flex justify-between">
        <span>Kapa mena ×3</span>
        <span>
          {sousTotal.toLocaleString("fr-FR")} {devise}
        </span>
      </div>

      <div className="my-2 border-t border-dashed border-slate-300" />

      {montantTva > 0 && (
        <div className="flex justify-between">
          <span>TVA {tva}%</span>
          <span>
            {montantTva.toLocaleString("fr-FR")} {devise}
          </span>
        </div>
      )}
      <div className="flex justify-between text-[11px] font-bold">
        <span>TOTAL</span>
        <span>
          {(sousTotal + montantTva).toLocaleString("fr-FR")} {devise}
        </span>
      </div>

      {prefs.showFooter && settings.receiptFooter && (
        <>
          <div className="my-2 border-t border-dashed border-slate-300" />
          <p className="text-center text-[9px]">{settings.receiptFooter}</p>
        </>
      )}
    </div>
  );
};

export const InvoiceSection: React.FC<InvoiceSectionProps> = ({ settings }) => {
  const [prefs, update, reset] = useInvoicePrefs();

  return (
    <>
      <SettingsSection
        title="Reçus et factures"
        description="Choisissez ce qui figure sur les documents remis à vos clients. L'aperçu se met à jour à chaque changement."
        icon={<Receipt className="w-4 h-4" />}
        aside={
          <button type="button" onClick={reset} className="app-btn-ghost text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            Réinitialiser
          </button>
        }
      >
        <SettingsRow
          label="Format par défaut"
          hint="Celui proposé en premier à l'ouverture d'un reçu."
          htmlFor="invoice-format"
        >
          <div className="flex w-full gap-1 rounded-xl border border-border bg-muted p-1">
            {(
              [
                { value: "ticket" as const, label: "Ticket 80 mm" },
                { value: "facture" as const, label: "Facture A4" },
              ]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update({ defaultFormat: opt.value })}
                aria-pressed={prefs.defaultFormat === opt.value}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                  prefs.defaultFormat === opt.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingsRow>

        {OPTIONS.map((opt) => (
          <SettingsRow key={opt.key} label={opt.label} hint={opt.hint}>
            <div className="sm:flex sm:justify-end">
              <Toggle
                label={opt.label}
                checked={Boolean(prefs[opt.key])}
                onChange={(v) => update({ [opt.key]: v } as Partial<InvoicePrefs>)}
              />
            </div>
          </SettingsRow>
        ))}

        <div className="flex items-start gap-2.5 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-6">
          <Monitor className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Le contenu affiché (nom, logo, adresse, NIF, TVA, mention de bas de page) se modifie
            dans <strong className="text-foreground">Ma boutique</strong> et vaut pour toute
            l'équipe. Les options ci-dessus, elles, sont enregistrées sur cet appareil.
          </span>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Aperçu"
        description="Rendu du ticket avec vos réglages actuels."
        icon={<Receipt className="w-4 h-4" />}
      >
        <SettingsBlock className="bg-muted/40">
          <Preview settings={settings} prefs={prefs} />
        </SettingsBlock>
      </SettingsSection>
    </>
  );
};
