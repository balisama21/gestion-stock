import React, { useMemo, useState } from "react";
import {
  CalendarClock,
  Hourglass,
  PackageMinus,
  PencilLine,
  Search,
  ShieldAlert,
} from "lucide-react";
import type { Product, Sale } from "../../types";
import { formatCurrency } from "../../utils/formulas";
import { useConfirmation } from "../../hooks/useConfirmation";
import {
  etatStock,
  lotsParUrgence,
  moisAnnee,
  URGENCES,
  type LotPharma,
  type MouvementLot,
  type Urgence,
} from "../../lib/pharmacie";
import type { Pharmacie } from "../../hooks/usePharmacie";
import { BadgePeremption } from "./badges";
import { CorrigerLotModal, DaterStockModal, RetirerLotModal } from "./ActionsLot";
import { Chiffre, EnTete, EtiquetteLot, Panneau, Pastille, Segments, Vide } from "./ui";

interface Props {
  products: Product[];
  sales: Sale[];
  pharma: Pharmacie;
  aujourdhui: string;
  peutRetirer: boolean;
  onStockModifie: () => void;
}

const TON_LIGNE: Record<Urgence, "danger" | "warning" | "info" | undefined> = {
  perime: "danger",
  un_mois: "danger",
  trois_mois: "warning",
  six_mois: "info",
  plus_tard: undefined,
  sans_date: undefined,
};

/**
 * LES PÉREMPTIONS
 *
 * Tous les lots en rayon, du plus pressé au plus tranquille : les
 * périmés (à sortir tout de suite), ceux du mois, des trois et des six
 * mois. On les retire en un geste — la perte est tracée — et on retrouve
 * à qui un lot a été vendu quand un fabricant le rappelle.
 */
export const PeremptionsView: React.FC<Props> = ({
  products,
  sales,
  pharma,
  aujourdhui,
  peutRetirer,
  onStockModifie,
}) => {
  const groupes = useMemo(
    () => lotsParUrgence(pharma.lots, products, aujourdhui),
    [pharma.lots, products, aujourdhui],
  );
  const nonDates = useMemo(
    () =>
      products
        .map((p) => ({ produit: p, sansDate: etatStock(p, pharma.lots, aujourdhui).sansDate }))
        .filter((x) => x.sansDate > 0),
    [products, pharma.lots, aujourdhui],
  );
  const premiere = URGENCES.find((u) => (groupes.get(u.cle)?.length ?? 0) > 0)?.cle ?? "perime";
  const [section, setSection] = useState<Urgence>(premiere);
  const [aRetirer, setARetirer] = useState<{ lot: LotPharma; nom: string } | null>(null);
  const [aCorriger, setACorriger] = useState<LotPharma | null>(null);
  const [aDater, setADater] = useState<{ produit: Product; sansDate: number } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { confirmer, modaleConfirmation } = useConfirmation();

  const valeurDe = (u: Urgence) => (groupes.get(u) ?? []).reduce((n, l) => n + l.valeur, 0);
  const nombreDe = (u: Urgence) => groupes.get(u)?.length ?? 0;
  const lignes = groupes.get(section) ?? [];
  const titre = URGENCES.find((u) => u.cle === section)!.titre;

  const retirerTousLesPerimes = async () => {
    const perimes = groupes.get("perime") ?? [];
    if (
      !(await confirmer(
        `Retirer du stock les ${perimes.length} lot(s) périmé(s), pour ${formatCurrency(
          valeurDe("perime"),
        )} ? La perte reste tracée.`,
        { danger: true, libelle: "Tout retirer" },
      ))
    )
      return;
    setOccupe(true);
    let faits = 0;
    for (const l of perimes) {
      const r = await pharma.retirerLot(l.lot.id, l.lot.quantite, "perime", null);
      if (r.error) {
        setMessage(r.error);
        break;
      }
      faits += 1;
    }
    setOccupe(false);
    if (faits > 0) {
      setMessage(`${faits} lot(s) périmé(s) retiré(s) du stock.`);
      onStockModifie();
    }
  };

  return (
    <div className="ph-page">
      <EnTete
        titre="Péremptions"
        sousTitre="Le premier qui périme sort le premier. Ici, ce qu'il faut surveiller."
        icone={<Hourglass className="h-6 w-6" />}
      >
        {(["perime", "un_mois", "trois_mois", "six_mois"] as Urgence[]).map((u) => (
          <Chiffre
            key={u}
            valeur={formatCurrency(valeurDe(u))}
            libelle={`${URGENCES.find((x) => x.cle === u)!.titre} · ${nombreDe(u)}`}
            ton={
              nombreDe(u) === 0
                ? undefined
                : u === "perime" || u === "un_mois"
                  ? "danger"
                  : u === "trois_mois"
                    ? "warning"
                    : undefined
            }
            onClick={() => setSection(u)}
            actif={section === u}
          />
        ))}
      </EnTete>

      <Segments
        libelle="Échéance"
        valeur={section}
        onChange={setSection}
        options={URGENCES.map((u) => ({
          cle: u.cle,
          libelle: u.titre,
          compte: nombreDe(u.cle) + (u.cle === "sans_date" ? nonDates.length : 0),
        }))}
      />

      {message && <p className="ph-panneau p-3 text-sm font-semibold">{message}</p>}

      <Panneau
        titre={`${titre} · ${formatCurrency(valeurDe(section))}`}
        icone={<Hourglass className="h-4 w-4" />}
        action={
          section === "perime" && peutRetirer && lignes.length > 0 ? (
            <button
              type="button"
              disabled={occupe}
              onClick={retirerTousLesPerimes}
              className="flex items-center gap-1 t-danger"
            >
              <PackageMinus className="h-4 w-4" />
              {occupe ? "Retrait…" : "Tout retirer"}
            </button>
          ) : undefined
        }
      >
        {section === "sans_date" && nonDates.length > 0 && (
          <ul className="ph-liste border-b border-border">
            {nonDates.map(({ produit, sansDate }) => (
              <li key={produit.id} className="ph-ligne" data-ton="warning">
                <CalendarClock className="h-4 w-4 shrink-0 t-warning" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{produit.displayName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {sansDate} unité(s) reçue(s) sans date de péremption
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setADater({ produit, sansDate })}
                  className="app-btn-secondary !min-h-9"
                >
                  Dater
                </button>
              </li>
            ))}
          </ul>
        )}

        {lignes.length === 0 ? (
          !(section === "sans_date" && nonDates.length > 0) && (
            <Vide icone={<Hourglass className="h-6 w-6" />}>Aucun lot dans cette échéance.</Vide>
          )
        ) : (
          <ul className="ph-liste">
            {lignes.map(({ lot, produit, valeur, urgence }) => (
              <li key={lot.id} className="ph-ligne flex-wrap" data-ton={TON_LIGNE[urgence]}>
                <Pastille nom={produit.displayName} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{produit.displayName}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <EtiquetteLot numero={lot.numero_lot} />
                    {lot.date_peremption && <span>fin {moisAnnee(lot.date_peremption)}</span>}
                    {lot.fournisseur && <span>· {lot.fournisseur}</span>}
                  </span>
                </span>
                <BadgePeremption date={lot.date_peremption} aujourdhui={aujourdhui} />
                <span className="w-16 text-right">
                  <span className="block text-sm font-extrabold tabular-nums">{lot.quantite}</span>
                  <span className="block text-[11px] tabular-nums text-muted-foreground">
                    {formatCurrency(valeur)}
                  </span>
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setACorriger(lot)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                    aria-label="Corriger le lot"
                    title="Corriger le numéro ou la date"
                  >
                    <PencilLine className="h-4 w-4" />
                  </button>
                  {peutRetirer && (
                    <button
                      type="button"
                      onClick={() => setARetirer({ lot, nom: produit.displayName })}
                      className="rounded-lg p-2 t-danger hover:bg-danger-soft"
                      aria-label="Retirer du rayon"
                      title="Retirer du rayon"
                    >
                      <PackageMinus className="h-4 w-4" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panneau>

      <RappelDeLot pharma={pharma} products={products} sales={sales} aujourdhui={aujourdhui} />

      {aRetirer && (
        <RetirerLotModal
          lot={aRetirer.lot}
          nom={aRetirer.nom}
          raisonParDefaut={
            aRetirer.lot.date_peremption && aRetirer.lot.date_peremption < aujourdhui
              ? "perime"
              : "retour_fournisseur"
          }
          onFermer={() => setARetirer(null)}
          onRetirer={async (q, raison, note) => {
            const r = await pharma.retirerLot(aRetirer.lot.id, q, raison, note);
            if (!r.error) onStockModifie();
            return r;
          }}
        />
      )}
      {aCorriger && (
        <CorrigerLotModal
          lot={aCorriger}
          onFermer={() => setACorriger(null)}
          onCorriger={(numero, date) => pharma.corrigerLot(aCorriger.id, numero, date)}
        />
      )}
      {aDater && (
        <DaterStockModal
          nom={aDater.produit.displayName}
          sansDate={aDater.sansDate}
          onFermer={() => setADater(null)}
          onDater={(numero, date, quantite) =>
            pharma.daterStock(aDater.produit.id, numero, date, quantite)
          }
        />
      )}
      {modaleConfirmation}
    </div>
  );
};

/* ── Rappel de lot ─────────────────────────────────────────────── */

const RappelDeLot: React.FC<{
  pharma: Pharmacie;
  products: Product[];
  sales: Sale[];
  aujourdhui: string;
}> = ({ pharma, products, sales, aujourdhui }) => {
  const [numero, setNumero] = useState("");
  const [resultat, setResultat] = useState<
    | {
        lot: LotPharma;
        nom: string;
        ventes: { vente: Sale | null; quantite: number; quand: string }[];
      }[]
    | null
  >(null);
  const [cherche, setCherche] = useState(false);

  const chercher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero.trim()) return;
    setCherche(true);
    const lots = await pharma.lotsParNumero(numero);
    const parId = new Map(sales.map((s) => [s.id, s]));
    const lignes = await Promise.all(
      lots.map(async (lot) => {
        const mouvements: MouvementLot[] = await pharma.mouvementsDuLot(lot.id);
        return {
          lot,
          nom: products.find((p) => p.id === lot.product_id)?.displayName ?? "Produit supprimé",
          ventes: mouvements
            .filter((m) => m.motif === "vente")
            .map((m) => ({
              vente: m.reference_id ? (parId.get(m.reference_id) ?? null) : null,
              quantite: -m.quantite,
              quand: m.cree_le,
            })),
        };
      }),
    );
    setResultat(lignes);
    setCherche(false);
  };

  return (
    <Panneau titre="Rappel de lot" icone={<ShieldAlert className="h-4 w-4" />} corps>
      <p className="mb-3 text-sm text-muted-foreground">
        Un fabricant rappelle un lot ? Retrouvez où il en est et à qui il a été vendu.
      </p>
      <form onSubmit={chercher} className="flex gap-2">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Numéro de lot imprimé sur la boîte"
            className="app-field pl-9 font-mono"
          />
        </label>
        <button type="submit" disabled={cherche} className="app-btn-primary">
          {cherche ? "Recherche…" : "Chercher"}
        </button>
      </form>
      {resultat &&
        (resultat.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Aucun lot ne porte ce numéro.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {resultat.map(({ lot, nom, ventes }) => (
              <li key={lot.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 font-bold">{nom}</span>
                  <EtiquetteLot numero={lot.numero_lot} />
                  <BadgePeremption date={lot.date_peremption} aujourdhui={aujourdhui} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lot.quantite} en rayon sur {lot.quantite_recue} reçus
                  {lot.fournisseur ? ` · ${lot.fournisseur}` : ""}
                </p>
                {ventes.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rien n&apos;a été vendu de ce lot.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1 rounded-lg bg-muted/60 p-2 text-xs">
                    {ventes.map((v, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="w-20 shrink-0 text-muted-foreground">
                          {new Date(v.quand).toLocaleDateString("fr-FR")}
                        </span>
                        <span className="flex-1">
                          {v.vente?.clientCredit || "Client de passage"}
                          {v.vente ? ` · vente ${v.vente.numero}` : ""}
                        </span>
                        <span className="font-bold tabular-nums">{v.quantite}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        ))}
    </Panneau>
  );
};
