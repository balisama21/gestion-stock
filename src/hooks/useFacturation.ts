import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { dateDuJour } from "../lib/dates";
import type { Avoir, LigneAvoir } from "../components/facturation/documents";
import { cleDocument, type EntiteDocument } from "../components/facturation/documents";

/**
 * CE QUE LA PAGE FACTURATION CHARGE EN PLUS.
 *
 * Ventes, devis, clients et factures reçues arrivent déjà par
 * `useStoreData`, qui les charge pour toute l'application. Ne restent
 * ici que les trois choses dont cette page seule a besoin : les
 * avoirs, le journal des envois et la liste des pièces déjà émises.
 *
 * Elles sont chargées À L'OUVERTURE DE LA PAGE et pas avec le reste :
 * trois requêtes de plus au démarrage ralentiraient toutes les
 * boutiques, y compris celles qui n'ouvrent jamais cet écran.
 */

type Envoi = {
  entite: string;
  entite_id: string;
  type: string;
  canal: string;
  relance: boolean;
  envoye_le: string;
};

type Emission = { entite: string; entite_id: string; type: string };

export interface Facturation {
  chargement: boolean;
  erreur: string | null;
  avoirs: Avoir[];
  lignesAvoir: LigneAvoir[];
  /** Les clés des pièces qui sont parties chez quelqu'un. */
  envois: Set<string>;
  /** Les tickets dont la seule pièce émise est un reçu. */
  recus: Set<string>;
  /** Combien de relances ont déjà été faites, par clé de pièce. */
  relances: Map<string, number>;
  /**
   * Le jour du calendrier, dit par le SERVEUR.
   *
   * Une horloge d'appareil faussée — cas courant sur un téléphone
   * d'occasion — cacherait un retard ou en inventerait un. Tant que la
   * réponse n'est pas arrivée, on prend celle de l'appareil : un
   * écran vide serait pire qu'un écran approximatif.
   */
  aujourdhui: string;
  recharger: () => Promise<void>;
  /**
   * Ranger la copie figée d'une pièce qui vient de partir.
   *
   * `snapshot` porte l'identité, les réglages du type et la mise en
   * page TELS QU'ILS ÉTAIENT : si la boutique change son logo ou son
   * adresse demain, la pièce d'aujourd'hui se reconstruit à
   * l'identique. Une seule par pièce — l'index unique le garantit, et
   * une réimpression relit la première au lieu d'en écrire une autre.
   */
  marquerEmis: (
    entite: EntiteDocument,
    id: string,
    type: string,
    snapshot: unknown,
  ) => Promise<void>;
  /** La copie figée d'une pièce déjà émise, ou `null` si elle n'est jamais partie. */
  lireCopie: (entite: EntiteDocument, id: string, type: string) => Promise<unknown | null>;
  marquerEnvoye: (
    entite: EntiteDocument,
    id: string,
    type: string,
    canal: string,
    relance: boolean,
  ) => Promise<{ error: string | null }>;
  creerAvoir: (data: {
    ticketId: string | null;
    factureNumero: string | null;
    clientId: string | null;
    clientNom: string;
    motif: string;
    montant: number;
    lignes: { product_id: string; designation: string; quantite: number; prix_unitaire: number }[];
  }) => Promise<{ avoir: Avoir | null; error: string | null }>;
}

export function useFacturation(storeId: string | null, actif: boolean): Facturation {
  const [avoirs, setAvoirs] = useState<Avoir[]>([]);
  const [lignesAvoir, setLignesAvoir] = useState<LigneAvoir[]>([]);
  const [envois, setEnvois] = useState<Envoi[]>([]);
  const [emissions, setEmissions] = useState<Emission[]>([]);
  const [aujourdhui, setAujourdhui] = useState<string>(() => dateDuJour());
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    if (!storeId) {
      setAvoirs([]);
      setLignesAvoir([]);
      setEnvois([]);
      setEmissions([]);
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      const [avoirsRes, lignesRes, envoisRes, emissionsRes, dateRes] = await Promise.all([
        supabase
          .from("avoirs")
          .select("*")
          .eq("store_id", storeId)
          .order("date", { ascending: false }),
        supabase.from("avoir_items").select("*").eq("store_id", storeId).order("ordre"),
        supabase
          .from("document_envois")
          .select("entite, entite_id, type, canal, relance, envoye_le")
          .eq("store_id", storeId),
        supabase
          .from("document_emissions")
          .select("entite, entite_id, type")
          .eq("store_id", storeId),
        supabase.rpc("date_de_la_boutique"),
      ]);

      const premiere = avoirsRes.error ?? envoisRes.error ?? emissionsRes.error;
      if (premiere) setErreur(premiere.message);

      if (avoirsRes.data) setAvoirs(avoirsRes.data);
      if (lignesRes.data) setLignesAvoir(lignesRes.data);
      if (envoisRes.data) setEnvois(envoisRes.data as Envoi[]);
      if (emissionsRes.data) setEmissions(emissionsRes.data as Emission[]);
      if (!dateRes.error && typeof dateRes.data === "string") setAujourdhui(dateRes.data);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setChargement(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (actif) void recharger();
  }, [actif, recharger]);

  const clesEnvoyees = useMemo(
    () => new Set(envois.map((e) => cleDocument(e.entite as EntiteDocument, e.entite_id))),
    [envois],
  );

  const relances = useMemo(() => {
    const par = new Map<string, number>();
    for (const e of envois) {
      if (!e.relance) continue;
      const cle = cleDocument(e.entite as EntiteDocument, e.entite_id);
      par.set(cle, (par.get(cle) ?? 0) + 1);
    }
    return par;
  }, [envois]);

  /*
   * Un ticket n'est « reçu » que si l'on n'en a JAMAIS tiré de facture.
   * Imprimer un reçu après une facture ne change pas la nature de la
   * pièce : la facture est partie chez le client, elle reste la pièce
   * de référence.
   */
  const recus = useMemo(() => {
    const parTicket = new Map<string, Set<string>>();
    for (const e of emissions) {
      if (e.entite !== "vente") continue;
      const deja = parTicket.get(e.entite_id);
      if (deja) deja.add(e.type);
      else parTicket.set(e.entite_id, new Set([e.type]));
    }
    const seulementRecu = new Set<string>();
    for (const [ticket, types] of parTicket) {
      if (types.has("recu") && !types.has("facture") && !types.has("commission")) {
        seulementRecu.add(ticket);
      }
    }
    return seulementRecu;
  }, [emissions]);

  const marquerEmis = useCallback(
    async (entite: EntiteDocument, id: string, type: string, snapshot: unknown) => {
      if (!storeId) return;
      // Déjà émise : on ne réécrit pas la copie figée, sans quoi une
      // réimpression après un déménagement effacerait l'adresse qui
      // figure sur le papier parti chez le client.
      if (emissions.some((e) => e.entite === entite && e.entite_id === id && e.type === type)) {
        return;
      }
      const { error } = await supabase.from("document_emissions").insert({
        store_id: storeId,
        entite,
        entite_id: id,
        type,
        snapshot: (snapshot ?? {}) as never,
      });
      if (!error) setEmissions((e) => [...e, { entite, entite_id: id, type }]);
    },
    [storeId, emissions],
  );

  const lireCopie = useCallback(
    async (entite: EntiteDocument, id: string, type: string) => {
      if (!storeId) return null;
      if (!emissions.some((e) => e.entite === entite && e.entite_id === id && e.type === type)) {
        return null;
      }
      const { data } = await supabase
        .from("document_emissions")
        .select("snapshot")
        .eq("store_id", storeId)
        .eq("entite", entite)
        .eq("entite_id", id)
        .eq("type", type)
        .maybeSingle();
      return data?.snapshot ?? null;
    },
    [storeId, emissions],
  );

  const marquerEnvoye = useCallback(
    async (entite: EntiteDocument, id: string, type: string, canal: string, relance: boolean) => {
      if (!storeId) return { error: "Non autorisé" };
      const { error } = await supabase
        .from("document_envois")
        .insert({ store_id: storeId, entite, entite_id: id, type, canal, relance });
      if (error) return { error: error.message };
      setEnvois((e) => [
        ...e,
        { entite, entite_id: id, type, canal, relance, envoye_le: new Date().toISOString() },
      ]);
      return { error: null };
    },
    [storeId],
  );

  const creerAvoir = useCallback<Facturation["creerAvoir"]>(
    async (data) => {
      if (!storeId) return { avoir: null, error: "Non autorisé" };
      const { data: cree, error } = await supabase.rpc("creer_avoir", {
        p_store_id: storeId,
        p_ticket_id: data.ticketId,
        p_facture_numero: data.factureNumero,
        p_client_id: data.clientId,
        p_client_nom: data.clientNom,
        p_motif: data.motif,
        p_montant: data.montant,
        p_lignes: data.lignes,
      });
      if (error) return { avoir: null, error: error.message };
      const avoir = cree as unknown as Avoir;
      setAvoirs((a) => [avoir, ...a]);
      // `creer_avoir` rend la pièce, pas son détail : on relit les
      // lignes, sans quoi l'avoir s'imprimerait avec son seul motif.
      const { data: lignes } = await supabase
        .from("avoir_items")
        .select("*")
        .eq("avoir_id", avoir.id)
        .order("ordre");
      if (lignes) setLignesAvoir((l) => [...l, ...lignes]);
      return { avoir, error: null };
    },
    [storeId],
  );

  return {
    chargement,
    erreur,
    avoirs,
    lignesAvoir,
    envois: clesEnvoyees,
    recus,
    relances,
    aujourdhui,
    recharger,
    marquerEmis,
    lireCopie,
    marquerEnvoye,
    creerAvoir,
  };
}
