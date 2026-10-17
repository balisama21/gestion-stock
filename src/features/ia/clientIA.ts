/**
 * Accès à l'IA depuis l'application : uniquement par la fonction edge
 * « ia » (la clé reste sur le serveur) et par deux RPC de lecture.
 *
 * Toute indisponibilité — fonction non déployée, clé absente, IA coupée —
 * se traduit par un état explicite, jamais par une réponse imitée.
 */
import { supabase } from "../../lib/supabase";

export const MESSAGE_IA_NON_CONFIGUREE =
  "IA non configurée — activation par l'administrateur requise";

export type FonctionnaliteIA =
  "import_extraction" | "assistant" | "redaction" | "reapprovisionnement" | "anomalies";

export const LIBELLES_FONCTIONNALITES: Record<FonctionnaliteIA, string> = {
  import_extraction: "Import intelligent (PDF, images, Word)",
  assistant: "Questions sur l'activité",
  redaction: "Aide à la rédaction",
  reapprovisionnement: "Suggestions de réapprovisionnement",
  anomalies: "Détection d'anomalies",
};

/** Fonctions qui lisent les chiffres de la boutique : propriétaire seulement. */
export const FONCTIONNALITES_PROPRIETAIRE: FonctionnaliteIA[] = [
  "assistant",
  "anomalies",
  "reapprovisionnement",
];

export interface EtatBoutiqueIA {
  plateforme_active: boolean;
  modele_defini: boolean;
  boutique_active: boolean;
  fonctionnalites: FonctionnaliteIA[];
  requetes_mois: number;
  requetes_mensuelles_max: number | null;
  part_utilisee_pct: number | null;
  cout_mois_usd: number | null;
  plafond_mensuel_usd: number | null;
}

export interface EtatIA {
  /** La fonction edge répond et une clé est enregistrée côté serveur. */
  cleConfiguree: boolean;
  coupe: boolean;
  boutique: EtatBoutiqueIA | null;
}

export interface DisponibiliteIA {
  disponible: boolean;
  /** Raison affichée quand l'IA n'est pas disponible. */
  raison: string | null;
}

/** Une fonction IA est-elle utilisable ? Sinon, pourquoi — en clair. */
export function disponibilite(etat: EtatIA | null, f: FonctionnaliteIA): DisponibiliteIA {
  if (!etat || !etat.cleConfiguree || !etat.boutique) {
    return { disponible: false, raison: MESSAGE_IA_NON_CONFIGUREE };
  }
  if (etat.coupe)
    return { disponible: false, raison: "IA temporairement désactivée par l'administrateur." };
  const b = etat.boutique;
  if (!b.plateforme_active || !b.modele_defini) {
    return { disponible: false, raison: MESSAGE_IA_NON_CONFIGUREE };
  }
  if (!b.boutique_active)
    return { disponible: false, raison: "L'IA n'est pas activée pour cette boutique." };
  if (!b.fonctionnalites.includes(f)) {
    return {
      disponible: false,
      raison: "Cette fonction IA n'est pas activée pour cette boutique.",
    };
  }
  if (b.requetes_mensuelles_max !== null && b.requetes_mois >= b.requetes_mensuelles_max) {
    return { disponible: false, raison: "Quota mensuel de demandes IA atteint." };
  }
  if (b.part_utilisee_pct !== null && b.part_utilisee_pct >= 100) {
    return { disponible: false, raison: "Plafond mensuel d'IA de la boutique atteint." };
  }
  return { disponible: true, raison: null };
}

export async function lireEtatIA(storeId: string): Promise<EtatIA> {
  const [cle, boutique] = await Promise.all([
    supabase.functions
      .invoke("ia", { body: { action: "etat" } })
      .then(({ data, error }) =>
        error || !data
          ? { cle_configuree: false, coupe: false }
          : (data as { cle_configuree: boolean; coupe: boolean }),
      )
      .catch(() => ({ cle_configuree: false, coupe: false })),
    supabase
      .rpc("ia_etat_boutique", { p_store_id: storeId })
      .then(({ data, error }) => (error ? null : (data as EtatBoutiqueIA)))
      .then(
        (d) => d,
        () => null,
      ),
  ]);
  return { cleConfiguree: cle.cle_configuree === true, coupe: cle.coupe === true, boutique };
}

export type EntreeIA =
  | {
      fonctionnalite: "import_extraction";
      cible: "produits" | "clients" | "fournisseurs" | "achats";
      texte?: string;
      fichier?: { mime: string; base64: string; nom?: string };
    }
  | { fonctionnalite: "assistant"; question: string }
  | {
      fonctionnalite: "redaction";
      type: "description_produit" | "message_client" | "libre";
      consignes: string;
      contexte?: string;
    }
  | { fonctionnalite: "reapprovisionnement" }
  | { fonctionnalite: "anomalies" };

export interface SuggestionReappro {
  product_id: string;
  designation: string;
  quantite: number;
  raison: string;
}

export type ResultatIA =
  | {
      ok: true;
      fonctionnalite: "import_extraction";
      cible: "produits" | "clients" | "fournisseurs" | "achats";
      lignes: Record<string, string | number | null>[];
      avertissements: string[];
      action_id: string | null;
    }
  | { ok: true; fonctionnalite: "assistant" | "redaction" | "anomalies"; texte: string }
  | {
      ok: true;
      fonctionnalite: "reapprovisionnement";
      suggestions: SuggestionReappro[];
      texte: string;
      action_id: string | null;
    }
  | { ok: false; code: string; message: string };

/** Le corps d'une réponse d'erreur de la fonction edge, s'il est lisible. */
async function corpsErreur(error: unknown): Promise<{ code?: string; message?: string } | null> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).json === "function") {
    try {
      return await (ctx as Response).json();
    } catch {
      return null;
    }
  }
  return null;
}

export async function executerIA(storeId: string, entree: EntreeIA): Promise<ResultatIA> {
  try {
    const { data, error } = await supabase.functions.invoke("ia", {
      body: { action: "executer", store_id: storeId, entree },
    });
    if (error) {
      const corps = await corpsErreur(error);
      if (corps?.code) {
        return { ok: false, code: corps.code, message: corps.message ?? MESSAGE_IA_NON_CONFIGUREE };
      }
      return { ok: false, code: "ia_injoignable", message: MESSAGE_IA_NON_CONFIGUREE };
    }
    return data as ResultatIA;
  } catch {
    return { ok: false, code: "ia_injoignable", message: MESSAGE_IA_NON_CONFIGUREE };
  }
}

/** Décision humaine sur une action proposée par l'IA (journalisée). */
export async function deciderActionIA(
  actionId: string,
  decision: "confirmee" | "rejetee" | "executee" | "echec",
  resultat?: Record<string, unknown>,
): Promise<string | null> {
  const { error } = await supabase.rpc("ia_decider_action", {
    p_action_id: actionId,
    p_decision: decision,
    p_resultat: resultat ?? null,
  });
  return error?.message ?? null;
}
