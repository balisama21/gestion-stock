import React, { useMemo } from "react";
import {
  AlertTriangle,
  Banknote,
  ChevronRight,
  ClipboardList,
  Hourglass,
  PackagePlus,
  PackageX,
  ReceiptText,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import type { ActiveTab, Product, Sale } from "../../types";
import { formatCurrency } from "../../utils/formulas";
import { estEnRupture, estSousLeSeuil, stockEstSuivi } from "../../lib/prealerteStock";
import { lotsParUrgence, type Urgence } from "../../lib/pharmacie";
import { useOrdonnances, type Pharmacie } from "../../hooks/usePharmacie";
import { Chiffre, EnTete, EtiquetteLot, Panneau, Pastille, Vide } from "./ui";
import { BadgePeremption } from "./badges";

interface Props {
  storeId: string;
  storeName: string;
  products: Product[];
  sales: Sale[];
  pharma: Pharmacie;
  aujourdhui: string;
  onAller: (tab: ActiveTab) => void;
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const salutation = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
};

/**
 * L'OFFICINE : L'ACCUEIL DE LA PHARMACIE
 *
 * En arrivant : la recette du jour, ce qui périme et ce qui manque, ce
 * que doivent les organismes, les dernières délivrances. Les gestes du
 * quotidien sont dans l'en-tête, à portée de doigt.
 */
export const OfficineView: React.FC<Props> = ({
  storeId,
  storeName,
  products,
  sales,
  pharma,
  aujourdhui,
  onAller,
}) => {
  const duJour = useMemo(() => sales.filter((s) => s.date === aujourdhui), [sales, aujourdhui]);
  const vendu = duJour.reduce((n, s) => n + s.totalVente, 0);
  const encaisse = duJour.reduce((n, s) => n + s.montantPaye, 0);
  const tickets = useMemo(() => {
    const m = new Map<string, Sale[]>();
    for (const s of duJour) m.set(s.ticketId ?? s.id, [...(m.get(s.ticketId ?? s.id) ?? []), s]);
    return [...m.values()]
      .map((vs) => ({
        cle: vs[0].ticketId ?? vs[0].id,
        quand: vs[0].saisieLe ?? "",
        client: vs.find((v) => v.clientCredit)?.clientCredit ?? null,
        articles: vs.map((v) => v.designation),
        total: vs.reduce((n, v) => n + v.totalVente, 0),
        du: vs.reduce((n, v) => n + Math.max(0, v.soldeDu), 0),
      }))
      .sort((a, b) => b.quand.localeCompare(a.quand));
  }, [duJour]);
  const { ordonnances } = useOrdonnances(storeId, aujourdhui, aujourdhui);

  const groupes = useMemo(
    () => lotsParUrgence(pharma.lots, products, aujourdhui),
    [pharma.lots, products, aujourdhui],
  );
  const resume = (u: Urgence) => {
    const l = groupes.get(u) ?? [];
    return { n: l.length, valeur: l.reduce((s, x) => s + x.valeur, 0) };
  };
  const perimes = resume("perime");
  const unMois = resume("un_mois");
  const troisMois = resume("trois_mois");
  const prochains = [
    ...(groupes.get("perime") ?? []),
    ...(groupes.get("un_mois") ?? []),
    ...(groupes.get("trois_mois") ?? []),
  ].slice(0, 4);

  const manques = useMemo(
    () =>
      products
        .filter(
          (p) =>
            p.statut !== "archive" &&
            stockEstSuivi(p) &&
            (estEnRupture(p.stockActuel) || estSousLeSeuil(p.stockActuel, p.seuilAlerte)),
        )
        .sort((a, b) => a.stockActuel - b.stockActuel),
    [products],
  );
  const aRecouvrer = useMemo(() => {
    const ids = new Set(pharma.organismes.map((o) => o.client_id));
    return sales
      .filter((s) => s.clientId && ids.has(s.clientId))
      .reduce((n, s) => n + Math.max(0, s.soldeDu), 0);
  }, [sales, pharma.organismes]);

  const d = new Date(`${aujourdhui}T12:00:00`);
  const date = `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
  const heure = (iso: string) =>
    iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="ph-page">
      <EnTete
        titre={storeName}
        sousTitre={
          <>
            {salutation()} · {date}
          </>
        }
        actions={
          <>
            <button type="button" onClick={() => onAller("ventes")} className="app-btn-primary">
              <Banknote className="h-4 w-4" />
              Comptoir
            </button>
            <button type="button" onClick={() => onAller("achats")} className="app-btn-secondary">
              <PackagePlus className="h-4 w-4" />
              Réception
            </button>
          </>
        }
      >
        <Chiffre ton="plein" valeur={formatCurrency(vendu)} libelle="Vendu aujourd'hui" />
        <Chiffre valeur={formatCurrency(encaisse)} libelle="Encaissé" />
        <Chiffre valeur={tickets.length} libelle="Clients servis" />
        <Chiffre
          valeur={ordonnances.length}
          libelle="Ordonnances"
          icone={<ScrollText className="h-3 w-3" />}
          onClick={() => onAller("ordonnancier")}
        />
      </EnTete>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panneau
          titre="À surveiller"
          icone={<Hourglass className="h-4 w-4" />}
          action={
            <button
              type="button"
              onClick={() => onAller("peremptions")}
              className="flex items-center"
            >
              Péremptions
              <ChevronRight className="h-4 w-4" />
            </button>
          }
          corps
        >
          <div className="grid grid-cols-3 gap-2">
            <Chiffre
              ton={perimes.n ? "danger" : undefined}
              valeur={perimes.n}
              libelle="Périmés"
              onClick={() => onAller("peremptions")}
            />
            <Chiffre
              ton={unMois.n ? "danger" : undefined}
              valeur={unMois.n}
              libelle="Dans le mois"
              onClick={() => onAller("peremptions")}
            />
            <Chiffre
              ton={troisMois.n ? "warning" : undefined}
              valeur={troisMois.n}
              libelle="Sous 3 mois"
              onClick={() => onAller("peremptions")}
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {perimes.n + unMois.n + troisMois.n === 0
              ? "Aucun lot ne périme dans les trois mois."
              : `${formatCurrency(perimes.valeur + unMois.valeur + troisMois.valeur)} de stock à écouler ou à retirer.`}
          </p>
          {prochains.length > 0 && (
            <ul className="ph-liste -mx-[0.9rem] -mb-[0.9rem] mt-3 border-t border-border">
              {prochains.map(({ lot, produit, urgence }) => (
                <li
                  key={lot.id}
                  className="ph-ligne"
                  data-ton={urgence === "trois_mois" ? "warning" : "danger"}
                >
                  <Pastille nom={produit.displayName} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {produit.displayName}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <EtiquetteLot numero={lot.numero_lot} />
                      {lot.quantite} en rayon
                    </span>
                  </span>
                  <BadgePeremption date={lot.date_peremption} aujourdhui={aujourdhui} />
                </li>
              ))}
            </ul>
          )}
        </Panneau>

        <Panneau
          titre={`À commander · ${manques.length}`}
          icone={<ClipboardList className="h-4 w-4" />}
          action={
            manques.length > 0 ? (
              <button type="button" onClick={() => onAller("achats")} className="flex items-center">
                Préparer la commande
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : undefined
          }
        >
          {manques.length === 0 ? (
            <Vide>Tous les stocks sont au-dessus de leur seuil.</Vide>
          ) : (
            <ul className="ph-liste max-h-64 overflow-y-auto">
              {manques.slice(0, 8).map((p) => {
                const rupture = estEnRupture(p.stockActuel);
                return (
                  <li key={p.id} className="ph-ligne" data-ton={rupture ? "danger" : "warning"}>
                    {rupture ? (
                      <PackageX className="h-4 w-4 shrink-0 t-danger" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 t-warning" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {p.displayName}
                    </span>
                    <span className={`text-xs font-bold ${rupture ? "t-danger" : "t-warning"}`}>
                      {rupture ? "Rupture" : `${p.stockActuel} / ${p.seuilAlerte}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panneau>

        <Panneau
          titre="Dernières délivrances"
          icone={<ReceiptText className="h-4 w-4" />}
          action={
            <button type="button" onClick={() => onAller("ventes")} className="flex items-center">
              Comptoir
              <ChevronRight className="h-4 w-4" />
            </button>
          }
        >
          {tickets.length === 0 ? (
            <Vide>Aucune vente aujourd&apos;hui pour l&apos;instant.</Vide>
          ) : (
            <ul className="ph-liste">
              {tickets.slice(0, 6).map((t) => (
                <li key={t.cle} className="ph-ligne" data-ton={t.du > 0 ? "warning" : undefined}>
                  <span className="w-12 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                    {heure(t.quand)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {t.articles.join(", ")}
                    </span>
                    {t.client && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.client}
                        {t.du > 0 ? ` · ${formatCurrency(t.du)} dû` : ""}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(t.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panneau>

        <div className="space-y-5">
          {pharma.organismes.length > 0 && (
            <Panneau
              titre="Tiers payant"
              icone={<ShieldCheck className="h-4 w-4" />}
              action={
                <button
                  type="button"
                  onClick={() => onAller("organismes")}
                  className="flex items-center"
                >
                  Relevés
                  <ChevronRight className="h-4 w-4" />
                </button>
              }
              corps
            >
              <p className="text-2xl font-extrabold tabular-nums">{formatCurrency(aRecouvrer)}</p>
              <p className="text-sm text-muted-foreground">
                à recouvrer auprès de {pharma.organismes.filter((o) => o.actif).length} organisme(s)
              </p>
            </Panneau>
          )}
          <Panneau titre="Les plus délivrés aujourd'hui">
            <PlusDelivres ventes={duJour} />
          </Panneau>
        </div>
      </div>
    </div>
  );
};

const PlusDelivres: React.FC<{ ventes: Sale[] }> = ({ ventes }) => {
  const liste = useMemo(() => {
    const m = new Map<string, { nom: string; quantite: number }>();
    for (const s of ventes) {
      if (!s.productId) continue;
      const x = m.get(s.productId) ?? { nom: s.designation, quantite: 0 };
      x.quantite += s.quantite;
      m.set(s.productId, x);
    }
    return [...m.values()].sort((a, b) => b.quantite - a.quantite).slice(0, 5);
  }, [ventes]);
  if (liste.length === 0) return <Vide>Rien de délivré pour l&apos;instant.</Vide>;
  return (
    <ul className="ph-liste">
      {liste.map((p) => (
        <li key={p.nom} className="ph-ligne">
          <Pastille nom={p.nom} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.nom}</span>
          <span className="text-sm font-bold tabular-nums">× {p.quantite}</span>
        </li>
      ))}
    </ul>
  );
};
