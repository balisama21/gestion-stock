import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { dateLocale } from "../lib/format";
import type { BesoinDonnees } from "../registry";
import type { Intervalle } from "./useDashboardPeriod";

/**
 * LES DEUX LECTURES QUE L'APPLICATION NE FAIT PAS ENCORE
 *
 * CE HOOK NE RECHARGE PAS CE QUI EST DÉJÀ LÀ. `useStoreData` charge
 * vingt et une tables à l'ouverture de la boutique, et le tableau de
 * bord les reçoit par props, exactement comme l'ancien. Les redemander
 * ici doublerait chaque requête sur l'écran le plus visité — le
 * contraire de ce qu'on cherche.
 *
 * Restent deux manques, relevés à l'audit (`docs/dashboard-v2/audit.md`,
 * § 5) :
 *
 *   `stock_movements` — la table existe, elle est alimentée par les
 *   déclencheurs, et AUCUNE requête de l'application ne la lit. Les
 *   entrées et sorties de stock jour par jour en dépendent.
 *
 *   `journal_activite` — `useJournalActivite` écarte volontairement les
 *   créations (`action ≠ "creation"`), parce que la cloche les déduit
 *   déjà des données chargées et les afficherait deux fois. Le journal
 *   de la maquette, lui, montre précisément les créations : « Vente
 *   créée », « Paiement reçu », « Nouveau client ». On relit donc la
 *   table sans ce filtre, pour cet écran seulement. Le hook de la
 *   cloche n'est pas touché.
 *
 * TOUT EST EN LECTURE. Aucune écriture, aucune RPC d'écriture, aucun
 * appel qui modifie quoi que ce soit — l'onglet Réseau ne doit montrer
 * que des GET au chargement du tableau de bord.
 *
 * LES REQUÊTES PARTENT EN MÊME TEMPS et ne partent QUE si une carte
 * autorisée en a besoin : un vendeur dont la vue ne montre pas les
 * mouvements de stock n'en déclenche jamais la lecture.
 */

/** Plafond de PostgREST. Au-delà, il faut redemander la page suivante. */
const PAGE = 1000;

/** Garde-fou : au-delà, ce n'est plus un tableau de bord. */
const PAGES_MAX = 10;

/** Le journal ne sert pas de registre : on en lit le haut. */
const LIGNES_JOURNAL = 120;

/** Deux minutes, et seulement si quelqu'un regarde. */
const RAFRAICHISSEMENT_MS = 120_000;

export interface MouvementStock {
  id: string;
  product_id: string | null;
  type_mouvement: string;
  stock_actuel_delta: number;
  created_at: string;
}

export interface LigneJournalComplete {
  id: number;
  cree_le: string;
  entite: string;
  /**
   * La ligne visée. Sert à rapprocher une modification de la création
   * qu'elle prolonge — voir `retouchesDeCreation` dans `lib/activite`.
   */
  entite_id: string | null;
  action: string;
  etiquette: string | null;
  montant: number | null;
  acteur_id: string | null;
}

export interface DonneesDashboard {
  mouvements: MouvementStock[];
  journal: LigneJournalComplete[];
  /** Une erreur par source : une lecture refusée n'emporte pas l'autre. */
  erreurs: { mouvements: string | null; journal: string | null };
  chargement: boolean;
  /** Quand la dernière lecture a abouti. `null` avant la première. */
  luA: Date | null;
  recharger: () => void;
}

/**
 * Le début d'un jour local, en instant.
 *
 * `stock_movements.created_at` et `journal_activite.cree_le` sont des
 * horodatages avec fuseau ; les bornes de période sont des jours du
 * calendrier local. On convertit donc le jour en instant plutôt que
 * l'inverse — `new Date("2026-09-01")` vaudrait minuit UTC, soit le
 * 31 août à 21 h à Antananarivo, et la journée entière basculerait.
 */
function debutDuJourLocal(jour: string): string {
  const d = dateLocale(jour);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
}

/**
 * Lit une table page par page jusqu'à ce qu'elle se tarisse.
 *
 * `useStoreData` n'a aucune pagination : au-delà de mille lignes,
 * PostgREST tronque en silence. Ce défaut est ancien et n'est pas
 * corrigé ici — mais les lectures nouvelles, elles, ne le reprendront
 * pas.
 */
async function lirePages<T>(
  construire: (debut: number, fin: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const tout: T[] = [];
  for (let page = 0; page < PAGES_MAX; page++) {
    const { data, error } = await construire(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    const lot = data ?? [];
    tout.push(...lot);
    if (lot.length < PAGE) break;
  }
  return tout;
}

const message = (e: unknown): string =>
  e && typeof e === "object" && "message" in e
    ? String((e as { message: unknown }).message)
    : "Lecture refusée";

export function useDashboardData(
  storeId: string | null,
  intervalle: Intervalle,
  besoins: Set<BesoinDonnees>,
): DonneesDashboard {
  const [mouvements, setMouvements] = useState<MouvementStock[]>([]);
  const [journal, setJournal] = useState<LigneJournalComplete[]>([]);
  const [erreurs, setErreurs] = useState({
    mouvements: null as string | null,
    journal: null as string | null,
  });
  const [chargement, setChargement] = useState(false);
  const [luA, setLuA] = useState<Date | null>(null);

  const veutMouvements = besoins.has("mouvements");
  const veutJournal = besoins.has("journal");

  // Le début de la fenêtre lue : le plus ancien entre le début de la
  // période choisie et aujourd'hui, pour que la tuile du jour ait ses
  // mouvements même quand on regarde un mois passé.
  const debut = intervalle.debut;

  // Un compteur plutôt qu'un booléen : deux rechargements de suite
  // doivent bien déclencher deux lectures.
  const [tour, setTour] = useState(0);
  const recharger = useCallback(() => setTour((t) => t + 1), []);

  // Pour ignorer la réponse d'une lecture devenue obsolète : sans cela,
  // un changement de période pendant une requête lente laisserait
  // l'ancienne réponse écraser la nouvelle.
  const jeton = useRef(0);

  useEffect(() => {
    if (!storeId || (!veutMouvements && !veutJournal)) {
      setMouvements([]);
      setJournal([]);
      setErreurs({ mouvements: null, journal: null });
      return;
    }

    const mien = ++jeton.current;
    let annule = false;
    setChargement(true);

    const lireMouvements = async (): Promise<
      { ok: true; lignes: MouvementStock[] } | { ok: false; erreur: string }
    > => {
      if (!veutMouvements) return { ok: true, lignes: [] };
      try {
        const lignes = await lirePages<MouvementStock>((a, b) =>
          supabase
            .from("stock_movements")
            .select("id, product_id, type_mouvement, stock_actuel_delta, created_at")
            .eq("store_id", storeId)
            .gte("created_at", debutDuJourLocal(debut))
            .order("created_at", { ascending: true })
            .range(a, b),
        );
        return { ok: true, lignes };
      } catch (e) {
        return { ok: false, erreur: message(e) };
      }
    };

    const lireJournal = async (): Promise<
      { ok: true; lignes: LigneJournalComplete[] } | { ok: false; erreur: string }
    > => {
      if (!veutJournal) return { ok: true, lignes: [] };
      const { data, error } = await supabase
        .from("journal_activite")
        .select("id, cree_le, entite, entite_id, action, etiquette, montant, acteur_id")
        .eq("store_id", storeId)
        .order("cree_le", { ascending: false })
        .limit(LIGNES_JOURNAL);
      if (error) return { ok: false, erreur: message(error) };
      return { ok: true, lignes: (data ?? []) as LigneJournalComplete[] };
    };

    Promise.all([lireMouvements(), lireJournal()]).then(([m, j]) => {
      if (annule || mien !== jeton.current) return;
      setMouvements(m.ok ? m.lignes : []);
      setJournal(j.ok ? j.lignes : []);
      setErreurs({
        mouvements: m.ok ? null : m.erreur,
        journal: j.ok ? null : j.erreur,
      });
      setChargement(false);
      setLuA(new Date());
    });

    return () => {
      annule = true;
    };
  }, [storeId, debut, veutMouvements, veutJournal, tour]);

  /**
   * Toutes les deux minutes, et seulement si l'onglet est visible.
   *
   * Un téléphone posé sur le comptoir toute la journée n'a aucune raison
   * d'interroger la base sept cents fois : quand l'onglet revient au
   * premier plan, on relit une fois et on repart.
   */
  useEffect(() => {
    if (!storeId) return;
    const battement = window.setInterval(() => {
      if (document.visibilityState === "visible") recharger();
    }, RAFRAICHISSEMENT_MS);
    const auRetour = () => {
      if (document.visibilityState === "visible") recharger();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      window.clearInterval(battement);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [storeId, recharger]);

  return { mouvements, journal, erreurs, chargement, luA, recharger };
}
