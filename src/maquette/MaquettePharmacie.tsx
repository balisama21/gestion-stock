import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ActiveTab, Product } from "../types";
import { usePharmacie } from "../hooks/usePharmacie";
import { dateDuJour } from "../lib/dates";
import { OfficineView } from "../components/pharmacie/OfficineView";
import { ComptoirView } from "../components/pharmacie/ComptoirView";
import { MedicamentsView } from "../components/pharmacie/MedicamentsView";
import { ReceptionsView } from "../components/pharmacie/ReceptionsView";
import { PeremptionsView } from "../components/pharmacie/PeremptionsView";
import { OrdonnancierView } from "../components/pharmacie/OrdonnancierView";
import { OrganismesView } from "../components/pharmacie/OrganismesView";
import { PatientsView } from "../components/pharmacie/PatientsView";
import { InventaireView } from "../components/bar/InventaireView";
import { CaisseOfficineView } from "../components/pharmacie/CaisseOfficineView";
import { BilanOfficineView } from "../components/pharmacie/BilanOfficineView";
import { JournalOfficineView } from "../components/pharmacie/JournalOfficineView";
import { CapitalView } from "../components/CapitalView";
import { DepensesView } from "../components/DepensesView";
import { SalairesView } from "../components/SalairesView";
import { FournisseursView } from "../components/FournisseursView";
import { Sidebar } from "../components/Sidebar";
import { SousNavigation } from "../components/shared/SousNavigation";
import { universDe, visibleNavGroups, visibleNavItems } from "../components/navigation";
import { avecLInterieur } from "../lib/natures";
import { contextePersonnalisation } from "../lib/personnalisation";
import { Croix } from "../components/pharmacie/ui";
import { formatCurrency } from "../utils/formulas";
import type { Expense, Payment } from "../types";
import { nomAffiche } from "../components/pharmacie/FormulaireMedicament";
import { chargerPolicePharmacie } from "../components/pharmacie/ui";
import { abonner, base, BOUTIQUE, payerVente, vendre, versionDeLaBase } from "./faussebase";

/** La personnalisation d'une pharmacie neuve : son intérieur, sans autre choix. */
const PERSO = avecLInterieur({ nature: "pharmacie" } as Record<string, unknown>);
const GROUPES = visibleNavGroups(null, PERSO);
const ONGLETS = visibleNavItems(null, PERSO);

const lireOnglet = (): ActiveTab => {
  const h = window.location.hash.slice(1);
  return (ONGLETS.find((o) => o.id === h)?.id ?? "dashboard") as ActiveTab;
};

const jourDecale = (n: number) => dateDuJour(new Date(Date.now() - n * 86400000));

/** Quelques dépenses de la pharmacie fictive. */
const DEPENSES: Expense[] = (
  [
    ["Loyer de l'officine", 80000, 18],
    ["Électricité (JIRAMA)", 32000, 12],
    ["Réfrigérateur : entretien", 15000, 9],
    ["Sacs et étiquettes", 8000, 4],
    ["Transport des livraisons", 5000, 1],
  ] as [string, number, number][]
).map(([note, montant, recul], i) => ({
  id: `dep-${i}`,
  numero: `DEP${i + 1}`,
  date: jourDecale(recul),
  vendeur: "Hanitra",
  type: "Autre dépense" as const,
  montant,
  note,
  impactTresorerieGlobale: -montant,
  categoryId: null,
}));

/**
 * La pharmacie fictive, écran par écran, comme l'application la montre.
 * L'adresse garde l'écran ouvert (#ventes, #produits…) ; « ?sombre » passe
 * en mode sombre.
 */
export const MaquettePharmacie: React.FC = () => {
  const version = useSyncExternalStore(abonner, versionDeLaBase);
  const [onglet, setOnglet] = useState<ActiveTab>(lireOnglet);
  const [cibleOfficine, setCibleOfficine] = useState<import("../lib/pharmacie").CibleOfficine>();
  useEffect(() => {
    if (onglet !== "peremptions" && onglet !== "achats") setCibleOfficine(undefined);
  }, [onglet]);
  const [sombre, setSombre] = useState(() => window.location.search.includes("sombre"));
  const pharma = usePharmacie(BOUTIQUE);
  const aujourdhui = dateDuJour();

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.nature = "pharmacie";
    chargerPolicePharmacie();
    html.classList.toggle("dark", sombre);
  }, [sombre]);
  useEffect(() => {
    const suivre = () => setOnglet(lireOnglet());
    window.addEventListener("hashchange", suivre);
    return () => window.removeEventListener("hashchange", suivre);
  }, []);
  const [replie, setReplie] = useState(false);
  const aller = (t: ActiveTab) => {
    window.location.hash = t;
    setOnglet(t);
  };

  // Des copies fraîches à chaque changement : les écrans comparent les tableaux.
  const donnees = useMemo(
    () => ({
      produits: base.produits.map((p) => ({ ...p })),
      ventes: base.ventes.map((v) => ({ ...v })),
      achats: base.achats.map((a) => ({ ...a })),
      clients: base.tables.clients.map((c) => ({ ...c })) as any[],
      fournisseurs: base.tables.suppliers.map((f) => ({ ...f })) as any[],
      categories: base.tables.categories.map((c) => ({ ...c })) as any[],
      paiements: base.paiements.map((p) => ({ ...p })) as Payment[],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const modifierProduit = (
    p: Product,
    v: {
      nom: string;
      dosage: string;
      prixAchat: number;
      prixVente: number;
      seuil: number;
      categorieId: string | null;
      codeBarres: string;
    },
  ) => {
    const cible = base.produits.find((x) => x.id === p.id)!;
    Object.assign(cible, {
      designation: v.nom,
      displayName: nomAffiche(v.nom, v.dosage),
      prixAchat: v.prixAchat,
      prixVenteDefaut: v.prixVente,
      seuilAlerte: v.seuil,
      categoryId: v.categorieId,
      codeBarres: v.codeBarres || null,
    });
    void pharma.recharger();
    return { error: null };
  };

  const tresorerie =
    donnees.paiements.reduce((n, p) => n + p.montant, 0) -
    DEPENSES.reduce((n, d) => n + d.montant, 0);
  const marque = (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md">
        <Croix className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="coq-nom truncate">Pharmacie du Lac</p>
        <p className="coq-treso">
          Trésorerie <span className="ok">{formatCurrency(tresorerie)}</span>
        </p>
      </div>
    </div>
  );

  return (
    <contextePersonnalisation.Provider value={PERSO}>
      <div className="min-h-screen bg-background text-foreground">
        <Sidebar
          groups={GROUPES}
          activeTab={onglet}
          onTabClick={aller}
          collapsed={replie}
          onToggleCollapsed={() => setReplie((r) => !r)}
          brand={marque}
          brandCompact={
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Croix className="h-5 w-5" />
            </span>
          }
        />
        <div className={replie ? "lg:pl-18" : "lg:pl-[268px]"}>
          <nav className="sticky top-0 z-30 flex items-center gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 lg:justify-end lg:bg-background/80 lg:backdrop-blur">
            <span className="mr-3 shrink-0 text-sm font-bold lg:hidden">Pharmacie du Lac</span>
            <select
              value={onglet}
              onChange={(e) => aller(e.target.value as ActiveTab)}
              className="app-field-sm lg:hidden"
              aria-label="Écran"
            >
              {ONGLETS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="hidden text-xs font-semibold text-muted-foreground lg:inline">
              Maquette · données fictives
            </span>
            <button
              type="button"
              onClick={() => setSombre((s) => !s)}
              className="ml-auto shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm lg:ml-3"
            >
              {sombre ? "Clair" : "Sombre"}
            </button>
          </nav>
          <main className="app-container py-4 md:py-6">
            <SousNavigation
              actif={onglet}
              items={universDe(onglet, null, PERSO)}
              onChoisir={aller}
            />
            <div className="app-vue">
              {onglet === "dashboard" && (
                <OfficineView
                  storeId={BOUTIQUE}
                  storeName="Pharmacie du Lac"
                  products={donnees.produits}
                  sales={donnees.ventes}
                  pharma={pharma}
                  aujourdhui={aujourdhui}
                  onAller={(tab, cible) => {
                    setCibleOfficine(cible);
                    aller(tab);
                  }}
                />
              )}
              {onglet === "ventes" && (
                <ComptoirView
                  storeId={BOUTIQUE}
                  storeName="Pharmacie du Lac"
                  products={donnees.produits}
                  sales={donnees.ventes}
                  clients={donnees.clients}
                  pharma={pharma}
                  aujourdhui={aujourdhui}
                  vendeur="Hanitra"
                  onVendre={async (p) => vendre(p)}
                />
              )}
              {onglet === "produits" && (
                <MedicamentsView
                  products={donnees.produits}
                  categories={donnees.categories}
                  pharma={pharma}
                  aujourdhui={aujourdhui}
                  peutModifier
                  onStockModifie={() => undefined}
                  onCreer={async (v) => {
                    const id = `med-n${base.produits.length}`;
                    base.produits.push({
                      ...base.produits[0],
                      id,
                      designation: v.nom,
                      displayName: nomAffiche(v.nom, v.dosage),
                      prixAchat: v.prixAchat,
                      prixVenteDefaut: v.prixVente,
                      seuilAlerte: v.seuil,
                      categoryId: v.categorieId,
                      codeBarres: v.codeBarres || null,
                      stockActuel: 0,
                      stockDisponible: 0,
                      stockInitial: 0,
                      conditionnements: [],
                    });
                    return { error: null, id };
                  }}
                  onModifier={async (p, v) => modifierProduit(p, v)}
                />
              )}
              {onglet === "achats" && (
                <ReceptionsView
                  ouvrirCommande={cibleOfficine?.commande}
                  storeName="Pharmacie du Lac"
                  products={donnees.produits}
                  purchases={donnees.achats}
                  fournisseurs={donnees.fournisseurs}
                  pharma={pharma}
                  aujourdhui={aujourdhui}
                  peutRecevoir
                  onRecue={() => undefined}
                />
              )}
              {onglet === "peremptions" && (
                <PeremptionsView
                  cibleInitiale={cibleOfficine}
                  products={donnees.produits}
                  sales={donnees.ventes}
                  pharma={pharma}
                  aujourdhui={aujourdhui}
                  peutRetirer
                  onStockModifie={() => undefined}
                />
              )}
              {onglet === "ordonnancier" && (
                <OrdonnancierView
                  storeId={BOUTIQUE}
                  storeName="Pharmacie du Lac"
                  sales={donnees.ventes}
                  clients={donnees.clients}
                  aujourdhui={aujourdhui}
                />
              )}
              {onglet === "organismes" && (
                <OrganismesView
                  storeName="Pharmacie du Lac"
                  clients={donnees.clients}
                  sales={donnees.ventes}
                  pharma={pharma}
                  estProprietaire
                  onAddClient={async (d) => {
                    const client = {
                      id: `c-${Date.now()}`,
                      store_id: BOUTIQUE,
                      prenom: null,
                      ...d,
                    };
                    base.tables.clients.push(client);
                    return { client, error: null };
                  }}
                  onAddPaymentToSale={async (saleId, d) => payerVente(saleId, d.montant)}
                />
              )}
              {onglet === "clients" && (
                <PatientsView
                  storeId={BOUTIQUE}
                  clients={donnees.clients}
                  sales={donnees.ventes}
                  pharma={pharma}
                  aujourdhui={aujourdhui}
                  onAddClient={async (d) => {
                    base.tables.clients.push({ id: `c-${Date.now()}`, store_id: BOUTIQUE, ...d });
                    await pharma.recharger();
                    return { error: null };
                  }}
                  onUpdateClient={async (id, d) => {
                    Object.assign(
                      base.tables.clients.find((c) => c.id === id)!,
                      d,
                    );
                    await pharma.recharger();
                    return { error: null };
                  }}
                  onAddPaymentToSale={async (saleId, d) => payerVente(saleId, d.montant)}
                />
              )}
              {onglet === "caisse" && (
                <CaisseOfficineView
                  storeId={BOUTIQUE}
                  storeName="Pharmacie du Lac"
                  sales={donnees.ventes}
                  payments={donnees.paiements}
                  organismes={pharma.organismes}
                  aujourdhui={aujourdhui}
                />
              )}
              {onglet === "rapports" && (
                <BilanOfficineView
                  storeId={BOUTIQUE}
                  sales={donnees.ventes}
                  expenses={DEPENSES}
                  products={donnees.produits}
                  categories={donnees.categories}
                  organismes={pharma.organismes}
                  aujourdhui={aujourdhui}
                  vueComptable={<p className="text-sm">Le bilan comptable standard.</p>}
                />
              )}
              {onglet === "historique" && (
                <JournalOfficineView
                  sales={donnees.ventes}
                  payments={donnees.paiements}
                  purchases={donnees.achats}
                  expenses={DEPENSES}
                  apports={[]}
                  aujourdhui={aujourdhui}
                />
              )}
              {onglet === "capital" && (
                <CapitalView
                  capital={{
                    capitalInitial: 8000000,
                    apportsTotal: 0,
                    ventesTotalEncaisse: donnees.paiements.reduce((n, p) => n + p.montant, 0),
                    achatsTotal: 0,
                    depensesVendeursTotal: DEPENSES.reduce((n, d) => n + d.montant, 0),
                    remboursementsTotal: 0,
                    salairesTotal: 0,
                    tresorerieGlobaleActuelle: 8000000 + tresorerie,
                    seuilAlerteTresorerie: 500000,
                  }}
                  apports={[]}
                  locale="FR"
                  onUpdateCapitalInitial={() => undefined}
                  onUpdateSeuil={() => undefined}
                  onAddApport={() => undefined}
                  onDeleteApport={() => undefined}
                />
              )}
              {onglet === "depenses" && (
                <DepensesView
                  expenses={DEPENSES}
                  sellers={[]}
                  locale="FR"
                  postes={[]}
                  personnes={[]}
                  prestataires={[]}
                  storeId={BOUTIQUE}
                  onAddExpense={() => undefined}
                />
              )}
              {onglet === "salaires" && (
                <SalairesView
                  salaires={[]}
                  paiements={[]}
                  nomsConnus={["Hanitra", "Fara"]}
                  membres={[]}
                  locale="FR"
                  peutGerer
                  onAddSalaire={async () => ({ error: null })}
                  onDeleteSalaire={async () => ({ error: null })}
                  onAddPaiement={async () => ({ error: null })}
                  onUpdatePaiement={async () => ({ error: null })}
                  onDeletePaiement={async () => ({ error: null })}
                />
              )}
              {onglet === "fournisseurs" && (
                <FournisseursView
                  suppliers={donnees.fournisseurs}
                  purchases={donnees.achats}
                  products={donnees.produits}
                  onAddSupplier={async () => ({ supplier: null, error: null })}
                  onUpdateSupplier={async () => ({ error: null })}
                  onDeleteSupplier={async () => ({ error: null })}
                  onAddSupplierPayment={async () => ({ error: null })}
                  champsPersonnalises={[]}
                />
              )}
              {["vendeurs", "assistant_ia"].includes(onglet) && (
                <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                  Cet écran n&apos;est pas rempli dans la maquette.
                </p>
              )}
              {onglet === "inventaire" && (
                <InventaireView
                  storeId={BOUTIQUE}
                  products={donnees.produits}
                  categories={donnees.categories}
                  peutValider
                  onValide={() => undefined}
                  titre="Inventaire"
                  habit="officine"
                  sousTitre="Comptez les boîtes en rayon : le logiciel montre les écarts avec le stock."
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </contextePersonnalisation.Provider>
  );
};
