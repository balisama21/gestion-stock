import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  droitDeTable,
  resteAPayer,
  type LigneNote,
  type NoteBar,
  type TableBar,
  type ZoneBar,
} from "../lib/bar";

/**
 * Les données du bar-karaoké d'une boutique : sa salle (zones, tables),
 * ses notes ouvertes et leurs lignes, et les gestes du service.
 *
 * Les quatre tables (`bar_*`) sont plus jeunes que les types générés de
 * la base : on les interroge par un client non typé, et ce fichier
 * redonne leur forme aux lignes (`lib/bar.ts`).
 */

interface ClientLibre {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
}
const db = supabase as unknown as ClientLibre;

const nombre = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

const versZone = (r: any): ZoneBar => ({ ...r, droit_table: nombre(r.droit_table) });
const versTable = (r: any): TableBar => ({
  ...r,
  droit_table: r.droit_table === null ? null : Number(r.droit_table),
});
const versLigne = (r: any): LigneNote => ({ ...r, prix_unit: nombre(r.prix_unit) });

const cleUnique = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `bar-${Date.now()}-${Math.random()}`;

export interface ArticleAServir {
  productId: string;
  designation: string;
  quantite: number;
  prixUnit: number;
  serveur?: string | null;
}

export interface Encaissement {
  /** `null` : toute la note. Sinon les lignes choisies (addition partagée). */
  ligneIds: string[] | null;
  date: string;
  vendeur: string;
  clientId: string | null;
  montantPaye: number;
  methode: string;
}

type Resultat = { error: string | null };

export function useBar(storeId: string | null) {
  const [zones, setZones] = useState<ZoneBar[]>([]);
  const [tables, setTables] = useState<TableBar[]>([]);
  const [notes, setNotes] = useState<NoteBar[]>([]);
  const [lignes, setLignes] = useState<LigneNote[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    if (!storeId) return;
    const [z, t, n] = await Promise.all([
      db.from("bar_zones").select("*").eq("store_id", storeId),
      db.from("bar_tables").select("*").eq("store_id", storeId),
      db.from("bar_notes").select("*").eq("store_id", storeId).eq("statut", "ouverte"),
    ]);
    const echec = z.error ?? t.error ?? n.error;
    if (echec) {
      setErreur(echec.message);
      setChargement(false);
      return;
    }
    const ouvertes = (n.data ?? []) as NoteBar[];
    let lues: LigneNote[] = [];
    if (ouvertes.length > 0) {
      const l = await db
        .from("bar_note_lignes")
        .select("*")
        .in(
          "note_id",
          ouvertes.map((x) => x.id),
        );
      if (l.error) {
        setErreur(l.error.message);
        setChargement(false);
        return;
      }
      lues = (l.data ?? []).map(versLigne);
    }
    setZones((z.data ?? []).map(versZone));
    setTables((t.data ?? []).map(versTable));
    setNotes(ouvertes);
    setLignes(lues);
    setErreur(null);
    setChargement(false);
  }, [storeId]);

  useEffect(() => {
    setChargement(true);
    void recharger();
    // Une autre caisse, un autre téléphone : on relit en revenant sur l'écran.
    const auRetour = () => {
      if (document.visibilityState === "visible") void recharger();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => document.removeEventListener("visibilitychange", auRetour);
  }, [recharger]);

  /** La note ouverte de chaque table. */
  const noteDeLaTable = useMemo(() => new Map(notes.map((n) => [n.table_id, n])), [notes]);
  const lignesDeLaNote = useCallback(
    (noteId: string) => lignes.filter((l) => l.note_id === noteId),
    [lignes],
  );

  const apres = useCallback(
    async (r: { error: { message: string } | null }): Promise<Resultat> => {
      await recharger();
      return { error: r.error?.message ?? null };
    },
    [recharger],
  );

  /* ── Réglage de la salle (propriétaire) ─────────────────────── */

  const enregistrerZone = useCallback(
    async (z: { id?: string; nom: string; droit_table: number; ordre?: number }) => {
      if (!storeId) return { error: "Aucune boutique." };
      const ligne = {
        store_id: storeId,
        nom: z.nom.trim(),
        droit_table: Math.max(0, z.droit_table || 0),
        ordre: z.ordre ?? zones.length,
      };
      return apres(
        z.id
          ? await db.from("bar_zones").update(ligne).eq("id", z.id)
          : await db.from("bar_zones").insert(ligne),
      );
    },
    [storeId, zones.length, apres],
  );

  const supprimerZone = useCallback(
    async (id: string) => apres(await db.from("bar_zones").delete().eq("id", id)),
    [apres],
  );

  const enregistrerTable = useCallback(
    async (t: {
      id?: string;
      numero: string;
      zone_id: string | null;
      places?: number | null;
      droit_table?: number | null;
      active?: boolean;
    }) => {
      if (!storeId) return { error: "Aucune boutique." };
      const ligne = {
        store_id: storeId,
        numero: t.numero.trim(),
        zone_id: t.zone_id,
        places: t.places ?? null,
        droit_table: t.droit_table ?? null,
        active: t.active ?? true,
      };
      return apres(
        t.id
          ? await db.from("bar_tables").update(ligne).eq("id", t.id)
          : await db.from("bar_tables").insert({ ...ligne, ordre: tables.length }),
      );
    },
    [storeId, tables.length, apres],
  );

  /** Crée d'un coup les tables numérotées de `de` à `a` dans une zone. */
  const creerTables = useCallback(
    async (zoneId: string | null, de: number, a: number, prefixe = "") => {
      if (!storeId) return { error: "Aucune boutique." };
      const existants = new Set(tables.map((t) => t.numero));
      const nouvelles = [];
      for (let i = Math.min(de, a); i <= Math.max(de, a) && nouvelles.length < 200; i++) {
        const numero = `${prefixe}${i}`;
        if (!existants.has(numero)) {
          nouvelles.push({
            store_id: storeId,
            zone_id: zoneId,
            numero,
            ordre: tables.length + nouvelles.length,
          });
        }
      }
      if (nouvelles.length === 0) return { error: "Ces numéros de table existent déjà." };
      return apres(await db.from("bar_tables").insert(nouvelles));
    },
    [storeId, tables, apres],
  );

  /* ── Le service ─────────────────────────────────────────────── */

  /** Ouvre la note d'une table ; le droit de table s'y inscrit d'emblée. */
  const ouvrirNote = useCallback(
    async (
      tableId: string,
      options: { nbPersonnes?: number | null; clientId?: string | null } = {},
    ): Promise<{ note: NoteBar | null; error: string | null }> => {
      if (!storeId) return { note: null, error: "Aucune boutique." };
      const table = tables.find((t) => t.id === tableId);
      if (!table) return { note: null, error: "Table introuvable." };
      const { data, error } = await db
        .from("bar_notes")
        .insert({
          store_id: storeId,
          table_id: tableId,
          nb_personnes: options.nbPersonnes ?? null,
          client_id: options.clientId ?? null,
        })
        .select("*")
        .single();
      if (error || !data) {
        await recharger();
        return {
          note: null,
          error: error?.message?.includes("uniq_bar_notes_ouverte")
            ? "Cette table a déjà une note ouverte."
            : (error?.message ?? "La note n'a pas pu s'ouvrir."),
        };
      }
      const droit = droitDeTable(table, zones);
      if (droit > 0) {
        const zone = zones.find((z) => z.id === table.zone_id);
        await db.from("bar_note_lignes").insert({
          store_id: storeId,
          note_id: data.id,
          product_id: null,
          designation: zone ? `Droit de table · ${zone.nom}` : "Droit de table",
          genre: "droit_table",
          quantite: 1,
          prix_unit: droit,
        });
      }
      await recharger();
      return { note: data as NoteBar, error: null };
    },
    [storeId, tables, zones, recharger],
  );

  const servir = useCallback(
    async (noteId: string, articles: ArticleAServir[]) => {
      if (!storeId || articles.length === 0) return { error: null };
      return apres(
        await db.from("bar_note_lignes").insert(
          articles.map((a) => ({
            store_id: storeId,
            note_id: noteId,
            product_id: a.productId,
            designation: a.designation,
            quantite: a.quantite,
            prix_unit: a.prixUnit,
            serveur: a.serveur || null,
          })),
        ),
      );
    },
    [storeId, apres],
  );

  /** Retire `combien` unités d'un groupe de lignes, en commençant par les dernières servies. */
  const retirer = useCallback(
    async (groupe: LigneNote[], combien: number, motif: string | null) => {
      let reste = combien;
      const aPayer = groupe.filter(resteAPayer).sort((a, b) => b.cree_le.localeCompare(a.cree_le));
      for (const l of aPayer) {
        if (reste <= 0) break;
        if (l.quantite <= reste) {
          const r = await db
            .from("bar_note_lignes")
            .update({ annulee: true, motif })
            .eq("id", l.id);
          if (r.error) return apres(r);
          reste -= l.quantite;
        } else {
          const r = await db
            .from("bar_note_lignes")
            .update({ quantite: l.quantite - reste })
            .eq("id", l.id);
          if (r.error) return apres(r);
          reste = 0;
        }
      }
      return apres({ error: null });
    },
    [apres],
  );

  const offrir = useCallback(
    async (groupe: LigneNote[], offert: boolean) =>
      apres(
        await db
          .from("bar_note_lignes")
          .update({ offert })
          .in(
            "id",
            groupe.filter(resteAPayer).map((l) => l.id),
          ),
      ),
    [apres],
  );

  const changerDeTable = useCallback(
    async (noteId: string, tableId: string) => {
      const r = await db.from("bar_notes").update({ table_id: tableId }).eq("id", noteId);
      return apres({
        error: r.error?.message?.includes("uniq_bar_notes_ouverte")
          ? { message: "Cette table est déjà occupée : regroupez plutôt les deux tables." }
          : r.error,
      });
    },
    [apres],
  );

  /** Verse la note `source` dans `cible`, puis ferme la source. */
  const regrouper = useCallback(
    async (sourceId: string, cibleId: string, motif: string) => {
      const aDeplacer = lignes.filter((l) => l.note_id === sourceId && resteAPayer(l));
      if (lignes.some((l) => l.note_id === sourceId && l.sale_id)) {
        return { error: "Une partie de cette note est déjà encaissée : encaissez le reste." };
      }
      if (aDeplacer.length > 0) {
        const r = await db
          .from("bar_note_lignes")
          .update({ note_id: cibleId })
          .in(
            "id",
            aDeplacer.map((l) => l.id),
          );
        if (r.error) return apres(r);
      }
      return apres(
        await db
          .from("bar_notes")
          .update({ statut: "annulee", motif_annulation: motif })
          .eq("id", sourceId),
      );
    },
    [lignes, apres],
  );

  const annulerNote = useCallback(
    async (noteId: string, motif: string) =>
      apres(
        await db
          .from("bar_notes")
          .update({ statut: "annulee", motif_annulation: motif || null })
          .eq("id", noteId),
      ),
    [apres],
  );

  const encaisser = useCallback(
    async (noteId: string, e: Encaissement) => {
      const r = await db.rpc("encaisser_note_bar", {
        p_note_id: noteId,
        p_ligne_ids: e.ligneIds,
        p_date: e.date,
        p_vendeur: e.vendeur,
        p_client_id: e.clientId,
        p_montant_paye: e.montantPaye,
        p_methode: e.methode,
        p_idempotency_key: cleUnique(),
      });
      return apres(r);
    },
    [apres],
  );

  return {
    zones,
    tables,
    notes,
    lignes,
    chargement,
    erreur,
    recharger,
    noteDeLaTable,
    lignesDeLaNote,
    enregistrerZone,
    supprimerZone,
    enregistrerTable,
    creerTables,
    ouvrirNote,
    servir,
    retirer,
    offrir,
    changerDeTable,
    regrouper,
    annulerNote,
    encaisser,
  };
}

export type Bar = ReturnType<typeof useBar>;
