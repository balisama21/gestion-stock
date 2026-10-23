import React from "react";
import { RotateCcw } from "lucide-react";
import { SettingsBlock } from "./primitives";
import { Toggle } from "../shared/Toggle";
import { useInvoicePrefs, type InvoicePrefs } from "../../lib/invoicePrefs";
import { quantiteEnMots } from "../../utils/formulas";
import type { StoreSettings } from "../../types";

/**
 * LES ANCIENS DOCUMENTS, ET LE FORMAT PROPOSÉ À L'IMPRESSION
 *
 * Ce qui formait autrefois l'onglet « Reçus et factures ». Ces choix
 * sont rangés dans le navigateur (voir `invoicePrefs`) et ne pilotent
 * que l'ancien reçu : celui qui sort quand les nouveaux documents sont
 * coupés, ou quand ils tombent et que le repli prend leur place. Le
 * format par défaut, lui, vaut dans les deux cas.
 *
 * Ils vivent désormais dans l'écran unique des documents : un seul
 * endroit pour régler ce qui s'imprime, au lieu de deux onglets qui se
 * recoupaient.
 */

const OPTIONS: { key: keyof InvoicePrefs; label: string; hint: string }[] = [
  { key: "showLogo", label: "Logo", hint: "En haut du document." },
  { key: "showAddress", label: "Adresse", hint: "Adresse de la boutique." },
  { key: "showPhone", label: "Téléphone", hint: "Pour que le client puisse vous joindre." },
  { key: "showEmail", label: "E-mail", hint: "E-mail de la boutique." },
  { key: "showNif", label: "NIF & STAT", hint: "Obligatoire sur une facture officielle." },
  { key: "showSeller", label: "Nom du vendeur", hint: "Qui a réalisé la vente." },
  { key: "showTva", label: "Ligne de TVA", hint: "Sans effet si votre taux est à 0." },
  {
    key: "showFooter",
    label: "Mention de bas de page",
    hint: "Celle réglée dans « Ma boutique ».",
  },
];

/** Le format ouvert en premier quand on imprime une vente. */
export const FormatParDefaut: React.FC = () => {
  const [prefs, update] = useInvoicePrefs();
  return (
    <div className="flex w-full gap-1 rounded-xl border border-border bg-muted p-1">
      {[
        { value: "ticket" as const, label: "Ticket" },
        { value: "facture" as const, label: "Facture A4" },
      ].map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => update({ defaultFormat: opt.value })}
          aria-pressed={prefs.defaultFormat === opt.value}
          className={`flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
            prefs.defaultFormat === opt.value
              ? "bg-card font-semibold text-primary shadow-sm"
              : "font-medium text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

/** Ce que l'ancien reçu affiche. Enregistré aussitôt, sur cet appareil. */
export const OptionsAnciensDocuments: React.FC = () => {
  const [prefs, update, reset] = useInvoicePrefs();
  return (
    <SettingsBlock>
      <div className="grid gap-x-8 sm:grid-cols-2">
        {OPTIONS.map((opt) => (
          <div
            key={opt.key}
            className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{opt.label}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{opt.hint}</p>
            </div>
            <Toggle
              size="sm"
              label={opt.label}
              checked={Boolean(prefs[opt.key])}
              onChange={(v) => update({ [opt.key]: v } as Partial<InvoicePrefs>)}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Enregistré tout de suite, sur cet appareil seulement.
        </p>
        <button type="button" onClick={reset} className="app-btn-ghost text-xs">
          <RotateCcw className="h-3.5 w-3.5" />
          Réinitialiser
        </button>
      </div>
    </SettingsBlock>
  );
};

/**
 * Aperçu de l'ancien ticket, reconstruit à partir des mêmes données que
 * le vrai reçu : ce que l'utilisateur voit ici est ce qui sortira à
 * l'impression quand les nouveaux documents sont coupés.
 */
export const ApercuAncienTicket: React.FC<{ settings: StoreSettings }> = ({ settings }) => {
  const [prefs] = useInvoicePrefs();
  const devise = settings.currencySymbol || "Ar";
  const tva = settings.tvaRate ?? 0;
  const sousTotal = 54000;
  const montantTva = prefs.showTva && tva > 0 ? Math.round((sousTotal * tva) / 100) : 0;

  return (
    // `[overflow-wrap:anywhere]` : cet aperçu n'est pas un
    // `.printable-receipt` et n'hérite donc pas du filet de sécurité
    // posé dans styles.css. Sans lui, une adresse e-mail — un mot d'un
    // seul tenant — débordait de ces 280 px.
    <div className="mx-auto w-full max-w-[280px] rounded-xl border border-slate-200 bg-white p-4 font-mono text-[10px] leading-relaxed text-slate-900 shadow-sm [overflow-wrap:anywhere]">
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

      {/* La meme disposition que les vrais documents : la designation
          prend toute la largeur, et la ligne de calcul se lit en
          dessous. Sur 58 mm, quatre colonnes serrees deviennent
          illisibles — et cet apercu ne servirait a rien s'il montrait
          autre chose que ce qui sortira de l'imprimante. */}
      <div>
        <p className="font-semibold">Cahier mena</p>
        <div className="flex justify-between gap-3 text-slate-600">
          <span>
            {quantiteEnMots(3)} × {(sousTotal / 3).toLocaleString("fr-FR")} {devise}
          </span>
          <span className="font-semibold text-slate-900">
            {sousTotal.toLocaleString("fr-FR")} {devise}
          </span>
        </div>
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
