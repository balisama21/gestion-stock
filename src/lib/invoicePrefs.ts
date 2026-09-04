import { useCallback, useEffect, useState } from "react";

/**
 * Personnalisation des reçus et factures.
 *
 * Le CONTENU (nom de la boutique, logo, adresse, téléphone, e-mail,
 * NIF/STAT, taux de TVA, mention de pied de page) vient de la table
 * `stores` et se modifie dans Paramètres → Ma boutique : ces valeurs sont
 * partagées par toute la boutique.
 *
 * Ce module ne gère que le CHOIX DE CE QUI EST IMPRIMÉ. Ces options sont
 * stockées dans le navigateur, faute de colonne prévue côté base : créer
 * une migration pour des préférences d'impression ne se justifiait pas.
 * Conséquence assumée et affichée à l'utilisateur : elles ne suivent pas
 * d'un appareil à l'autre.
 */

export interface InvoicePrefs {
  /** Format proposé en premier à l'ouverture d'un reçu. */
  defaultFormat: "ticket" | "facture";
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showNif: boolean;
  /** Nom du vendeur ayant réalisé la vente. */
  showSeller: boolean;
  /** Ligne de TVA — sans effet si le taux est à 0. */
  showTva: boolean;
  /** Mention de pied de page (le texte lui-même vient de `stores`). */
  showFooter: boolean;
}

export const DEFAULT_INVOICE_PREFS: InvoicePrefs = {
  defaultFormat: "ticket",
  showLogo: true,
  showAddress: true,
  showPhone: true,
  showEmail: false,
  showNif: true,
  showSeller: true,
  showTva: true,
  showFooter: true,
};

const STORAGE_KEY = "balsama-invoice";
const CHANGE_EVENT = "balsama-invoice-change";

export function readInvoicePrefs(): InvoicePrefs {
  if (typeof window === "undefined") return DEFAULT_INVOICE_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INVOICE_PREFS;
    // Fusion avec les valeurs par défaut : une option ajoutée plus tard
    // ne doit pas arriver à `undefined` chez quelqu'un qui a déjà
    // enregistré ses choix.
    return { ...DEFAULT_INVOICE_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_INVOICE_PREFS;
  }
}

export function writeInvoicePrefs(prefs: InvoicePrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // Navigation privée ou stockage refusé : on garde les réglages de la
    // session en cours sans faire échouer l'application.
  }
}

export function useInvoicePrefs(): [InvoicePrefs, (patch: Partial<InvoicePrefs>) => void, () => void] {
  const [prefs, setPrefs] = useState<InvoicePrefs>(DEFAULT_INVOICE_PREFS);

  useEffect(() => {
    setPrefs(readInvoicePrefs());
    const sync = () => setPrefs(readInvoicePrefs());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<InvoicePrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      writeInvoicePrefs(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    writeInvoicePrefs(DEFAULT_INVOICE_PREFS);
    setPrefs(DEFAULT_INVOICE_PREFS);
  }, []);

  return [prefs, update, reset];
}
