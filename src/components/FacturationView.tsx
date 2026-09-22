import React, { useMemo, useState } from "react";
import { AlertTriangle, FileText, Plus, ReceiptText, RotateCw } from "lucide-react";
import type { LocaleSetting, Payment, StoreSettings } from "../types";
import { formatCurrency, formatDateLocale } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import { FilterBar, FilterField } from "./shared/FilterBar";
import { DataList, type DataListItem } from "./shared/DataList";
import { StatCol } from "./shared/StatBar";
import { SquelettePage } from "./shared/SquelettePage";
import {
  construirePeriode,
  debutDeMois,
  type ClePeriode,
  type Intervalle,
} from "../features/dashboard-v2/hooks/useDashboardPeriod";
import type { Facturation } from "../hooks/useFacturation";
import type { DocumentCommercial, TypeDocument } from "./facturation/documents";
import { CLASSE_STATUT, LIBELLE_STATUT, joursDeRetard } from "./facturation/statuts";
import { calculerIndicateurs } from "./facturation/indicateurs";
import {
  compterFiltres,
  filtrerDocuments,
  trierDocuments,
  FILTRES_VIDES,
  TRIS,
  type CleTri,
  type FiltresFacturation,
} from "./facturation/filtrer";
import { OngletsType, type CleOnglet, type Onglet } from "./facturation/OngletsType";
import { PucesFiltres, type Puce } from "./facturation/PucesFiltres";
import { SelecteurPeriodeFacturation } from "./facturation/SelecteurPeriodeFacturation";

/**
 * LA PAGE FACTURATION
 *
 * Elle ne possède aucune table à elle. Ventes, devis, avoirs et
 * factures reçues sont écrits ailleurs ; ici, ils sont relus et rangés
 * en PIÈCES — une opération, une ligne. C'est ce qui garantit qu'aucune
 * opération n'est comptée deux fois, et que ses chiffres sont ceux du
 * tableau de bord : ce sont les mêmes lignes, lues au même endroit.
 *
 * Voir `facturation/documents.ts` pour le modèle, `statuts.ts` pour le
 * calcul des statuts, `indicateurs.ts` pour les quatre chiffres du
 * haut.
 */

const LIBELLE_TYPE: Record<TypeDocument, string> = {
  facture: "Factures",
  commission: "Avec commission",
  recu: "Reçus",
  proforma: "Proformas",
  devis: "Devis",
  avoir: "Avoirs",
  facture_achat: "Factures d'achat",
};

const ORDRE_ONGLETS: TypeDocument[] = [
  "facture",
  "commission",
  "proforma",
  "devis",
  "avoir",
  "facture_achat",
  "recu",
];

/** Le mot au singulier, pour la ligne grise sous le numéro. */
const NOM_TYPE: Record<TypeDocument, string> = {
  facture: "Facture",
  commission: "Facture avec commission",
  recu: "Reçu",
  proforma: "Proforma",
  devis: "Devis",
  avoir: "Avoir",
  facture_achat: "Facture d'achat",
};

export interface FacturationViewProps {
  /**
   * Les pièces, déjà assemblées par l'écran parent.
   *
   * Elles sont construites une seule fois, en haut de l'application :
   * le badge des retards du menu et cette liste comptent alors
   * exactement les mêmes documents, sans que deux assemblages puissent
   * diverger.
   */
  documents: DocumentCommercial[];
  payments: Payment[];
  settings: StoreSettings;
  locale: LocaleSetting;
  facturation: Facturation;
  /** Le nom de la personne connectée, pour la portée « mes documents ». */
  moiNom: string;
  /** Faux quand la portée du module vaut « mes données ». */
  voitTout: boolean;
  peutCreer: boolean;
  /** Le panneau d'actions d'une pièce, fourni par l'écran parent. */
  actionsDuDocument?: (doc: DocumentCommercial) => React.ReactNode;
  /** Le menu « + Nouveau document ». */
  menuNouveau?: React.ReactNode;
  /** Les boutons d'export de la liste affichée. */
  exports?: (documents: DocumentCommercial[]) => React.ReactNode;
  onCreerPremiere?: () => void;
}

export const FacturationView: React.FC<FacturationViewProps> = ({
  documents: tous,
  payments,
  settings,
  locale,
  facturation,
  moiNom,
  voitTout,
  peutCreer,
  actionsDuDocument,
  menuNouveau,
  exports,
  onCreerPremiere,
}) => {
  const [cle, setCle] = useState<ClePeriode>("month");
  const [libre, setLibre] = useState<Intervalle>({
    debut: debutDeMois(facturation.aujourdhui),
    fin: facturation.aujourdhui,
  });
  const [filtres, setFiltres] = useState<FiltresFacturation>(FILTRES_VIDES);
  const [tri, setTri] = useState<CleTri>("date");
  const [descendant, setDescendant] = useState(true);

  const periode = useMemo(
    () => construirePeriode(cle, libre, facturation.aujourdhui),
    [cle, libre, facturation.aujourdhui],
  );

  const apercus = useMemo(
    () =>
      (["today", "week", "month"] as const).map((c) => {
        const p = construirePeriode(c, libre, facturation.aujourdhui);
        return { cle: c, nom: p.nom, libelle: p.libelle };
      }),
    [libre, facturation.aujourdhui],
  );

  /*
   * Le dernier tour de vis de la portée : une personne qui ne voit que
   * ses propres pièces n'a rien à faire dans le classeur des factures
   * reçues, qui appartient à la boutique entière.
   */
  const documents = useMemo(
    () => (voitTout ? tous : tous.filter((d) => d.entite !== "facture_achat")),
    [tous, voitTout],
  );

  const indicateurs = useMemo(
    () => calculerIndicateurs({ documents, payments, intervalle: periode.intervalle }),
    [documents, payments, periode.intervalle],
  );

  /* La période s'applique à la liste comme aux indicateurs : le chiffre
     du haut et les lignes du bas parlent du même intervalle. */
  const avecPeriode = useMemo(
    () => ({ ...filtres, intervalle: periode.intervalle }),
    [filtres, periode.intervalle],
  );

  const dansLaPeriode = useMemo(
    () => filtrerDocuments(documents, { ...FILTRES_VIDES, intervalle: periode.intervalle }),
    [documents, periode.intervalle],
  );

  const onglets: Onglet[] = useMemo(() => {
    const comptes = new Map<TypeDocument, number>();
    for (const d of dansLaPeriode) comptes.set(d.type, (comptes.get(d.type) ?? 0) + 1);
    const presents = ORDRE_ONGLETS.filter(
      (t) => (comptes.get(t) ?? 0) > 0 || documents.some((d) => d.type === t),
    );
    return [
      { cle: "tous" as CleOnglet, label: "Tous", compte: dansLaPeriode.length },
      ...presents.map((t) => ({
        cle: t as CleOnglet,
        label: LIBELLE_TYPE[t],
        compte: comptes.get(t) ?? 0,
      })),
    ];
  }, [dansLaPeriode, documents]);

  const visibles = useMemo(
    () => trierDocuments(filtrerDocuments(documents, avecPeriode), tri, descendant),
    [documents, avecPeriode, tri, descendant],
  );

  const tiersConnus = useMemo(
    () => [...new Set(dansLaPeriode.map((d) => d.tiers))].sort((a, b) => a.localeCompare(b)),
    [dansLaPeriode],
  );
  const vendeursConnus = useMemo(
    () =>
      [...new Set(dansLaPeriode.map((d) => d.vendeur).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [dansLaPeriode],
  );
  const statutsConnus = useMemo(
    () => [...new Set(dansLaPeriode.map((d) => d.statut))],
    [dansLaPeriode],
  );

  const poser = (p: Partial<FiltresFacturation>) => setFiltres((f) => ({ ...f, ...p }));

  const puces: Puce[] = [];
  if (filtres.vue) {
    const mots = {
      a_encaisser: "À encaisser",
      en_retard: "En retard",
      offres: "Devis en attente",
    } as const;
    puces.push({
      cle: "vue",
      libelle: mots[filtres.vue],
      onRetirer: () => poser({ vue: "" }),
    });
  }
  if (filtres.statut) {
    puces.push({
      cle: "statut",
      libelle: LIBELLE_STATUT[filtres.statut],
      onRetirer: () => poser({ statut: "" }),
    });
  }
  if (filtres.tiers) {
    puces.push({ cle: "tiers", libelle: filtres.tiers, onRetirer: () => poser({ tiers: "" }) });
  }
  if (filtres.vendeur) {
    puces.push({
      cle: "vendeur",
      libelle: filtres.vendeur,
      onRetirer: () => poser({ vendeur: "" }),
    });
  }

  const devise = settings.currencySymbol ?? "Ar";
  const argent = (n: number) => `${formatCurrency(n)} ${devise}`;

  const lignes: DataListItem[] = visibles.map((d) => {
    const retard = d.statut === "retard" && d.echeance;
    const jours = retard ? joursDeRetard(d.echeance!, facturation.aujourdhui) : 0;

    const details = [
      { label: "Type", value: NOM_TYPE[d.type] },
      { label: "Numéro", value: d.numero || "—" },
      { label: d.entite === "facture_achat" ? "Fournisseur" : "Client", value: d.tiers },
      { label: "Date", value: formatDateLocale(d.date, locale) },
      {
        label: "Échéance",
        value: d.echeance ? formatDateLocale(d.echeance, locale) : "",
        hideIfEmpty: true,
      },
      { label: "Vendeur", value: d.vendeur, hideIfEmpty: true },
      { label: "Référence client", value: d.reference ?? "", hideIfEmpty: true },
      { label: "Montant", value: argent(d.montant) },
      { label: "Déjà payé", value: d.paye > 0 ? argent(d.paye) : "", hideIfEmpty: true },
      { label: "Reste à payer", value: d.reste > 0 ? argent(d.reste) : "", hideIfEmpty: true },
      { label: "Annulée par", value: d.avoirDe ?? "", hideIfEmpty: true },
      { label: "Motif", value: d.avoir?.motif ?? "", hideIfEmpty: true },
      { label: "Statut", value: LIBELLE_STATUT[d.statut] },
    ];

    return {
      id: d.cle,
      primary: d.numero || NOM_TYPE[d.type],
      meta: [
        NOM_TYPE[d.type],
        d.tiers,
        formatDateLocale(d.date, locale),
        d.echeance && d.reste > 0 ? `échéance ${formatDateLocale(d.echeance, locale)}` : null,
        retard ? `${jours} jour${jours > 1 ? "s" : ""} de retard` : null,
      ],
      amount: argent(d.montant),
      amountHint: d.reste > 0 ? `reste ${argent(d.reste)}` : undefined,
      badge: <span className={CLASSE_STATUT[d.statut]}>{LIBELLE_STATUT[d.statut]}</span>,
      detailTitle: d.numero || NOM_TYPE[d.type],
      detailSubtitle: `${NOM_TYPE[d.type]} · ${d.tiers}`,
      details,
      actions: actionsDuDocument?.(d),
    };
  });

  if (facturation.chargement && documents.length === 0) return <SquelettePage />;

  if (facturation.erreur && documents.length === 0) {
    return (
      <div className="app-card flex flex-col items-center gap-3 px-4 py-12 text-center">
        <AlertTriangle className="h-7 w-7 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          Les documents n&apos;ont pas pu être chargés.
        </p>
        <button type="button" onClick={() => void facturation.recharger()} className="app-btn-secondary">
          <RotateCw className="h-4 w-4" />
          Réessayer
        </button>
      </div>
    );
  }

  const listeVide = documents.length === 0;

  return (
    <div>
      <PageHeader
        icon={<ReceiptText className="h-5 w-5" />}
        title="Facturation"
        module="facturation"
        subtitle="Tous les documents commerciaux de la boutique, au même endroit."
        actions={menuNouveau}
      />

      {listeVide ? (
        <div className="app-card mt-4 flex flex-col items-center gap-3 px-4 py-14 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <p className="max-w-md text-sm text-muted-foreground">
            Les factures, devis, proformas et avoirs de la boutique se rangeront ici. Chaque pièce
            y garde son numéro, son statut et ce qu&apos;il reste à encaisser.
          </p>
          {peutCreer && onCreerPremiere && (
            <button type="button" onClick={onCreerPremiere} className="app-btn-primary">
              <Plus className="h-4 w-4" />
              Créer ma première facture
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <SelecteurPeriodeFacturation
              periode={periode}
              apercus={apercus}
              intervalleLibre={libre}
              aujourdhui={facturation.aujourdhui}
              onChoisir={(c) => setCle(c)}
              onChoisirIntervalle={(debut, fin) => {
                setLibre({ debut, fin });
                setCle("custom");
              }}
            />
            {exports?.(visibles)}
          </div>

          <div className="app-statbar mt-3 grid-cols-2 xl:grid-cols-4">
            <StatCol
              label="À encaisser"
              value={argent(indicateurs.aEncaisser.montant)}
              hint={`${indicateurs.aEncaisser.nombre} facture${indicateurs.aEncaisser.nombre > 1 ? "s" : ""}`}
              ariaLabel="Ne montrer que ce qui reste à encaisser"
              actif={filtres.vue === "a_encaisser"}
              onClick={() => poser({ vue: filtres.vue === "a_encaisser" ? "" : "a_encaisser" })}
            />
            <StatCol
              label="En retard"
              value={argent(indicateurs.enRetard.montant)}
              hint={`${indicateurs.enRetard.nombre} facture${indicateurs.enRetard.nombre > 1 ? "s" : ""}`}
              alert={indicateurs.enRetard.nombre > 0}
              ariaLabel="Ne montrer que les factures en retard"
              actif={filtres.vue === "en_retard"}
              onClick={() => poser({ vue: filtres.vue === "en_retard" ? "" : "en_retard" })}
            />
            <StatCol
              label="Encaissé"
              value={argent(indicateurs.encaisse.montant)}
              hint={periode.libelle}
            />
            <StatCol
              label="Devis en attente"
              value={argent(indicateurs.offres.montant)}
              hint={`${indicateurs.offres.nombre} sans réponse`}
              ariaLabel="Ne montrer que les devis restés sans réponse"
              actif={filtres.vue === "offres"}
              onClick={() => poser({ vue: filtres.vue === "offres" ? "" : "offres" })}
            />
          </div>

          <div className="mt-4">
            <OngletsType
              onglets={onglets}
              actif={filtres.onglet}
              onChoisir={(o) => poser({ onglet: o })}
            />

            <FilterBar
              searchValue={filtres.recherche}
              onSearchChange={(v) => poser({ recherche: v })}
              searchPlaceholder="Numéro, client, montant, référence…"
              activeFilterCount={compterFiltres(filtres)}
              onReset={() => setFiltres({ ...FILTRES_VIDES, onglet: filtres.onglet })}
            >
              <FilterField label="Statut">
                <select
                  value={filtres.statut}
                  onChange={(e) =>
                    poser({ statut: e.target.value as FiltresFacturation["statut"] })
                  }
                  className="app-field-sm"
                >
                  <option value="">Tous</option>
                  {statutsConnus.map((s) => (
                    <option key={s} value={s}>
                      {LIBELLE_STATUT[s]}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Client ou fournisseur">
                <select
                  value={filtres.tiers}
                  onChange={(e) => poser({ tiers: e.target.value })}
                  className="app-field-sm"
                >
                  <option value="">Tous</option>
                  {tiersConnus.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </FilterField>

              {vendeursConnus.length > 0 && (
                <FilterField label="Vendeur">
                  <select
                    value={filtres.vendeur}
                    onChange={(e) => poser({ vendeur: e.target.value })}
                    className="app-field-sm"
                  >
                    <option value="">Tous</option>
                    {vendeursConnus.map((v) => (
                      <option key={v} value={v}>
                        {v === moiNom ? `${v} (moi)` : v}
                      </option>
                    ))}
                  </select>
                </FilterField>
              )}

              <FilterField label="Trier par">
                <div className="flex gap-2">
                  <select
                    value={tri}
                    onChange={(e) => setTri(e.target.value as CleTri)}
                    className="app-field-sm"
                  >
                    {TRIS.map((t) => (
                      <option key={t.cle} value={t.cle}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setDescendant((d) => !d)}
                    className="app-chip shrink-0"
                    aria-label={descendant ? "Trier par ordre croissant" : "Trier par ordre décroissant"}
                  >
                    {descendant ? "↓" : "↑"}
                  </button>
                </div>
              </FilterField>
            </FilterBar>

            <PucesFiltres
              puces={puces}
              onToutEffacer={() => setFiltres({ ...FILTRES_VIDES, onglet: filtres.onglet })}
            />

            <div className="app-card">
              {visibles.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                  <p className="text-sm text-muted-foreground">Aucun document ne correspond.</p>
                  <button
                    type="button"
                    onClick={() => setFiltres(FILTRES_VIDES)}
                    className="app-btn-secondary"
                  >
                    Effacer les filtres
                  </button>
                </div>
              ) : (
                <DataList items={lignes} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
