import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import {
  REGLAGES_PAR_DEFAUT,
  decaler,
  etatSerie,
  serieComplete,
  type ALaFin,
  type Moment,
  type Phrase,
  type ReglagesPhrases,
} from "./phrases";

/**
 * LES PHRASES AJOUTÉES PAR LE CRÉATEUR DE LA PLATEFORME
 *
 * Rangées dans `phrases_tableau_de_bord`, avec leurs réglages dans
 * `reglages_phrases` (une seule ligne). Une seule liste pour toutes les
 * boutiques, comme les photos d'« Inspiration du moment ».
 *
 * Lecture : tout utilisateur connecté. Écriture : super admin seulement,
 * la base le garantit (RLS) — l'interface ne fait que ne pas proposer.
 *
 * Si les tables n'existent pas encore, ou si la lecture échoue, le
 * tableau de bord garde les phrases livrées avec l'application.
 */

export interface PhraseAjoutee extends Phrase {
  id: string;
  moment: Moment;
  position: number;
}

interface Ligne {
  id: string;
  moment: Moment;
  ligne1: string;
  ligne2: string;
  devise1: string;
  devise2: string;
  position: number;
}

const enPhrase = (l: Ligne): PhraseAjoutee => ({
  id: l.id,
  moment: l.moment,
  position: l.position,
  lignes: [l.ligne1, l.ligne2],
  devise: [l.devise1, l.devise2],
});

export async function lirePhrases(): Promise<{ phrases: PhraseAjoutee[]; error: string | null }> {
  const { data, error } = await supabase
    .from("phrases_tableau_de_bord")
    .select("id, moment, ligne1, ligne2, devise1, devise2, position")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { phrases: [], error: error.message };
  return { phrases: ((data ?? []) as Ligne[]).map(enPhrase), error: null };
}

export async function lireReglages(): Promise<{ reglages: ReglagesPhrases; error: string | null }> {
  const { data, error } = await supabase
    .from("reglages_phrases")
    .select("a_la_fin, debut_jour, debut_soir")
    .maybeSingle();
  if (error) return { reglages: REGLAGES_PAR_DEFAUT, error: error.message };
  if (!data) return { reglages: REGLAGES_PAR_DEFAUT, error: null };
  return {
    reglages: {
      aLaFin: data.a_la_fin === "attendre" ? "attendre" : "reutiliser",
      debut: { jour: data.debut_jour, soir: data.debut_soir },
    },
    error: null,
  };
}

/** Les phrases ajoutées, rangées par moment. */
export const parMoment = (phrases: PhraseAjoutee[]): Record<Moment, Phrase[]> => ({
  jour: phrases.filter((p) => p.moment === "jour"),
  soir: phrases.filter((p) => p.moment === "soir"),
});

async function enregistrerReglages(champs: Record<string, string>): Promise<string | null> {
  const { error } = await supabase
    .from("reglages_phrases")
    .upsert({ id: true, ...champs, updated_at: new Date().toISOString() });
  return error ? error.message : null;
}

/**
 * Ajoute une phrase à la fin de sa série.
 *
 * Si la série était déjà épuisée, sa date de début recule d'autant : la
 * nouvelle phrase s'affiche dès aujourd'hui, au lieu d'être sautée parce
 * que son rang est déjà dans le passé.
 */
export async function ajouterPhrase(
  moment: Moment,
  phrase: Phrase,
  existantes: PhraseAjoutee[],
  reglages: ReglagesPhrases,
  aujourdhui: string,
): Promise<string | null> {
  const memeMoment = existantes.filter((p) => p.moment === moment);
  const avant = etatSerie(
    serieComplete(moment, memeMoment),
    reglages.debut[moment],
    aujourdhui,
    reglages.aLaFin,
  );
  const position = memeMoment.length ? Math.max(...memeMoment.map((p) => p.position)) + 1 : 0;
  const { error } = await supabase.from("phrases_tableau_de_bord").insert({
    moment,
    ligne1: phrase.lignes[0].trim(),
    ligne2: phrase.lignes[1].trim(),
    devise1: phrase.devise[0].trim(),
    devise2: phrase.devise[1].trim(),
    position,
  });
  if (error) return error.message;
  if (avant.epuisee) {
    return enregistrerReglages({ [`debut_${moment}`]: decaler(aujourdhui, -avant.total) });
  }
  return null;
}

export async function supprimerPhrase(id: string): Promise<string | null> {
  const { error } = await supabase.from("phrases_tableau_de_bord").delete().eq("id", id);
  return error ? error.message : null;
}

/** Ce qui se passe quand une série est épuisée. */
export const choisirALaFin = (aLaFin: ALaFin) => enregistrerReglages({ a_la_fin: aLaFin });

/** Réutiliser les phrases : la série repart de la première, aujourd'hui. */
export const recommencerSerie = (moment: Moment, aujourdhui: string) =>
  enregistrerReglages({ [`debut_${moment}`]: aujourdhui });

// ─── Pour le tableau de bord ──────────────────────────────────────────

const CLE_CACHE = "tantana.phrases";

interface Cache {
  ajoutees: Record<Moment, Phrase[]>;
  reglages: ReglagesPhrases;
}

const VIDE: Cache = { ajoutees: { jour: [], soir: [] }, reglages: REGLAGES_PAR_DEFAUT };

/**
 * Les phrases ajoutées et les réglages, pour la bannière.
 *
 * La dernière lecture est gardée dans ce navigateur : au retour sur le
 * tableau de bord, la bonne phrase s'affiche tout de suite.
 */
export function usePhrasesAjoutees(): Cache {
  const [etat, setEtat] = useState<Cache>(VIDE);

  useEffect(() => {
    let actif = true;
    try {
      const brut = window.localStorage.getItem(CLE_CACHE);
      if (brut) setEtat(JSON.parse(brut) as Cache);
    } catch {
      /* Cache illisible : on attend la base. */
    }
    void Promise.all([lirePhrases(), lireReglages()]).then(([p, r]) => {
      if (!actif || p.error || r.error) return;
      const frais: Cache = { ajoutees: parMoment(p.phrases), reglages: r.reglages };
      setEtat(frais);
      try {
        window.localStorage.setItem(CLE_CACHE, JSON.stringify(frais));
      } catch {
        /* Navigation privée : pas de cache. */
      }
    });
    return () => {
      actif = false;
    };
  }, []);

  return etat;
}
