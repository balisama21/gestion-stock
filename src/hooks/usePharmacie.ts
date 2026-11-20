import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type {
  FichePharma,
  LotPharma,
  MouvementLot,
  OrdonnancePharma,
  OrganismePharma,
} from "../lib/pharmacie";

/**
 * Les données de la pharmacie d'une boutique : les fiches médicament,
 * les lots en rayon, les organismes de tiers payant, et les gestes qui
 * les font bouger.
 *
 * Les tables `pharma_*` sont plus jeunes que les types générés : on les
 * interroge par un client non typé.
 */

interface ClientLibre {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
}
const db = supabase as unknown as ClientLibre;

type Resultat = { error: string | null };

const nombre = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const versLot = (r: any): LotPharma => ({ ...r, prix_achat_unit: nombre(r.prix_achat_unit) });

/** Tout lire, par pages de 1000 (la limite d'une réponse). */
async function toutLire(
  requete: (de: number, a: number) => any,
): Promise<{ data: any[]; error: string | null }> {
  const lignes: any[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await requete(page * 1000, page * 1000 + 999);
    if (error) return { data: lignes, error: error.message };
    lignes.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { data: lignes, error: null };
}

export interface LigneReception {
  productId: string;
  /** En unités de base, quand la ligne n'est pas au carton. */
  quantite?: number;
  prixAchatUnit?: number;
  /** Reçue au carton (boîte de 10 plaquettes…). */
  conditionnementId?: string;
  nombre?: number;
  prixConditionnement?: number;
  numeroLot: string | null;
  datePeremption: string | null;
}

export interface Reception {
  date: string;
  fournisseur: string;
  fournisseurId: string | null;
  lignes: LigneReception[];
  /** `null` : tout payé. */
  montantPaye: number | null;
  dateEcheance: string | null;
}

export type RaisonRetrait = "perime" | "retour_fournisseur" | "casse" | "autre";

export function usePharmacie(storeId: string | null) {
  const [fiches, setFiches] = useState<FichePharma[]>([]);
  const [lots, setLots] = useState<LotPharma[]>([]);
  const [organismes, setOrganismes] = useState<OrganismePharma[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    if (!storeId) return;
    const [f, l, o] = await Promise.all([
      toutLire((de, a) =>
        db.from("pharma_fiches").select("*").eq("store_id", storeId).range(de, a),
      ),
      toutLire((de, a) =>
        db
          .from("pharma_lots")
          .select("*")
          .eq("store_id", storeId)
          .gt("quantite", 0)
          .order("cree_le")
          .range(de, a),
      ),
      toutLire((de, a) =>
        db.from("pharma_organismes").select("*").eq("store_id", storeId).range(de, a),
      ),
    ]);
    const echec = f.error ?? l.error ?? o.error;
    setErreur(echec);
    if (!echec) {
      setFiches(f.data as FichePharma[]);
      setLots(l.data.map(versLot));
      setOrganismes(o.data.map((x: any) => ({ ...x, taux: Number(x.taux) })));
    }
    setChargement(false);
  }, [storeId]);

  useEffect(() => {
    setChargement(true);
    void recharger();
    const auRetour = () => {
      if (document.visibilityState === "visible") void recharger();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => document.removeEventListener("visibilitychange", auRetour);
  }, [recharger]);

  const ficheDe = useMemo(() => new Map(fiches.map((f) => [f.product_id, f])), [fiches]);

  const apres = useCallback(
    async (r: { error: { message: string } | null }): Promise<Resultat> => {
      await recharger();
      return { error: r.error?.message ?? null };
    },
    [recharger],
  );

  /** Crée ou met à jour la fiche d'un médicament. */
  const enregistrerFiche = useCallback(
    async (productId: string, f: Omit<FichePharma, "product_id" | "store_id">) => {
      if (!storeId) return { error: "Aucune boutique." };
      const propre = (s: string | null) => (s && s.trim() ? s.trim() : null);
      return apres(
        await db.from("pharma_fiches").upsert({
          product_id: productId,
          store_id: storeId,
          dci: propre(f.dci),
          dosage: propre(f.dosage),
          forme: propre(f.forme),
          laboratoire: propre(f.laboratoire),
          emplacement: propre(f.emplacement),
          regime: f.regime,
          conservation: f.conservation,
          notes: propre(f.notes),
          modifie_le: new Date().toISOString(),
        }),
      );
    },
    [storeId, apres],
  );

  const recevoir = useCallback(
    async (r: Reception): Promise<Resultat> => {
      if (!storeId) return { error: "Aucune boutique." };
      const cle =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `reception-${Date.now()}-${Math.random()}`;
      const { error } = await db.rpc("pharma_recevoir", {
        p_store_id: storeId,
        p_date: r.date,
        p_fournisseur: r.fournisseur,
        p_lignes: r.lignes.map((l) => ({
          product_id: l.productId,
          ...(l.conditionnementId
            ? {
                conditionnement_id: l.conditionnementId,
                nombre: l.nombre,
                prix_conditionnement: l.prixConditionnement,
              }
            : { quantite: l.quantite, prix_achat_unit: l.prixAchatUnit }),
          numero_lot: l.numeroLot ?? "",
          date_peremption: l.datePeremption ?? "",
        })),
        p_montant_paye: r.montantPaye,
        p_date_echeance: r.dateEcheance,
        p_idempotency_key: cle,
      });
      // La fiche fournisseur se rattache après coup, comme pour un achat ordinaire.
      if (!error && r.fournisseurId) {
        await db
          .from("purchases")
          .update({ supplier_id: r.fournisseurId })
          .eq("store_id", storeId)
          .like("idempotency_key", `${cle}:%`);
      }
      return apres({ error });
    },
    [storeId, apres],
  );

  const daterStock = useCallback(
    async (
      productId: string,
      numeroLot: string | null,
      datePeremption: string | null,
      quantite: number,
    ) =>
      apres(
        await db.rpc("pharma_dater_stock", {
          p_product_id: productId,
          p_numero_lot: numeroLot ?? "",
          p_date_peremption: datePeremption,
          p_quantite: quantite,
        }),
      ),
    [apres],
  );

  const corrigerLot = useCallback(
    async (lotId: string, numeroLot: string | null, datePeremption: string | null) =>
      apres(
        await db.rpc("pharma_corriger_lot", {
          p_lot_id: lotId,
          p_numero_lot: numeroLot ?? "",
          p_date_peremption: datePeremption,
        }),
      ),
    [apres],
  );

  const retirerLot = useCallback(
    async (lotId: string, quantite: number, raison: RaisonRetrait, note: string | null) =>
      apres(
        await db.rpc("pharma_retirer_lot", {
          p_lot_id: lotId,
          p_quantite: quantite,
          p_raison: raison,
          p_note: note ?? "",
        }),
      ),
    [apres],
  );

  const enregistrerOrganisme = useCallback(
    async (o: { clientId: string; taux: number; convention: string | null; actif: boolean }) => {
      if (!storeId) return { error: "Aucune boutique." };
      return apres(
        await db.from("pharma_organismes").upsert({
          client_id: o.clientId,
          store_id: storeId,
          taux: o.taux,
          convention: o.convention?.trim() || null,
          actif: o.actif,
        }),
      );
    },
    [storeId, apres],
  );

  /** L'historique d'un lot : réception, ventes, retours, retraits. */
  const mouvementsDuLot = useCallback(async (lotId: string): Promise<MouvementLot[]> => {
    const { data } = await db
      .from("pharma_lot_mouvements")
      .select("*")
      .eq("lot_id", lotId)
      .order("cree_le", { ascending: false })
      .limit(500);
    return (data ?? []) as MouvementLot[];
  }, []);

  /** Tous les lots portant ce numéro, même épuisés : pour un rappel de lot. */
  const lotsParNumero = useCallback(
    async (numero: string): Promise<LotPharma[]> => {
      if (!storeId || !numero.trim()) return [];
      const { data } = await db
        .from("pharma_lots")
        .select("*")
        .eq("store_id", storeId)
        .ilike("numero_lot", numero.trim())
        .limit(50);
      return (data ?? []).map(versLot);
    },
    [storeId],
  );

  return {
    fiches,
    ficheDe,
    lots,
    organismes,
    chargement,
    erreur,
    recharger,
    enregistrerFiche,
    recevoir,
    daterStock,
    corrigerLot,
    retirerLot,
    enregistrerOrganisme,
    mouvementsDuLot,
    lotsParNumero,
  };
}

export type Pharmacie = ReturnType<typeof usePharmacie>;

/* ── L'ordonnancier ─────────────────────────────────────────────── */

export interface NouvelleOrdonnance {
  patientNom: string;
  patientAge: string | null;
  patientTelephone: string | null;
  patientClientId: string | null;
  prescripteur: string | null;
  datePrescription: string | null;
  organismeId: string | null;
  matricule: string | null;
  partOrganisme: number;
  ticketId: string | null;
  notes: string | null;
}

export async function inscrireOrdonnance(
  storeId: string,
  o: NouvelleOrdonnance,
): Promise<{ ordonnance: OrdonnancePharma | null; error: string | null }> {
  const propre = (s: string | null) => (s && s.trim() ? s.trim() : null);
  const { data, error } = await db
    .from("pharma_ordonnances")
    .insert({
      store_id: storeId,
      patient_nom: o.patientNom.trim(),
      patient_age: propre(o.patientAge),
      patient_telephone: propre(o.patientTelephone),
      patient_client_id: o.patientClientId,
      prescripteur: propre(o.prescripteur),
      date_prescription: o.datePrescription,
      organisme_id: o.organismeId,
      matricule: propre(o.matricule),
      part_organisme: o.partOrganisme,
      ticket_id: o.ticketId,
      notes: propre(o.notes),
    })
    .select("*")
    .single();
  return {
    ordonnance: data
      ? ({ ...data, part_organisme: Number(data.part_organisme) } as OrdonnancePharma)
      : null,
    error: error?.message ?? null,
  };
}

/** Les ordonnances d'une période, la plus récente en tête. */
export function useOrdonnances(storeId: string | null, debut: string, fin: string) {
  const [ordonnances, setOrdonnances] = useState<OrdonnancePharma[]>([]);
  const [chargement, setChargement] = useState(true);
  const recharger = useCallback(async () => {
    if (!storeId) return;
    const r = await toutLire((de, a) =>
      db
        .from("pharma_ordonnances")
        .select("*")
        .eq("store_id", storeId)
        .gte("date_delivrance", debut)
        .lte("date_delivrance", fin)
        .order("numero", { ascending: false })
        .range(de, a),
    );
    setOrdonnances(r.data.map((x: any) => ({ ...x, part_organisme: Number(x.part_organisme) })));
    setChargement(false);
  }, [storeId, debut, fin]);
  useEffect(() => {
    setChargement(true);
    void recharger();
  }, [recharger]);
  return { ordonnances, chargement, recharger };
}
