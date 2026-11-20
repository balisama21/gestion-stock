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
import { nomAffiche } from "../components/pharmacie/FormulaireMedicament";
import { chargerPolicePharmacie } from "../components/pharmacie/ui";
import { abonner, base, BOUTIQUE, payerVente, vendre, versionDeLaBase } from "./faussebase";

const ONGLETS: [ActiveTab, string][] = [
  ["dashboard", "Officine"],
  ["ventes", "Comptoir"],
  ["produits", "Médicaments"],
  ["achats", "Réceptions"],
  ["peremptions", "Péremptions"],
  ["ordonnancier", "Ordonnancier"],
  ["clients", "Patients"],
  ["organismes", "Tiers payant"],
  ["inventaire", "Inventaire"],
];

const lireOnglet = (): ActiveTab => {
  const h = window.location.hash.slice(1);
  return (ONGLETS.find(([id]) => id === h)?.[0] ?? "dashboard") as ActiveTab;
};

/**
 * La pharmacie fictive, écran par écran, comme l'application la montre.
 * L'adresse garde l'écran ouvert (#ventes, #produits…) ; « ?sombre » passe
 * en mode sombre.
 */
export const MaquettePharmacie: React.FC = () => {
  const version = useSyncExternalStore(abonner, versionDeLaBase);
  const [onglet, setOnglet] = useState<ActiveTab>(lireOnglet);
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-30 flex items-center gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2">
        <span className="mr-3 shrink-0 text-sm font-bold">Pharmacie du Lac · maquette</span>
        {ONGLETS.map(([id, libelle]) => (
          <button
            key={id}
            type="button"
            onClick={() => aller(id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
              onglet === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {libelle}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSombre((s) => !s)}
          className="ml-auto shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm"
        >
          {sombre ? "Clair" : "Sombre"}
        </button>
      </nav>
      <main className="px-4 py-6 sm:px-6">
        {onglet === "dashboard" && (
          <OfficineView
            storeId={BOUTIQUE}
            storeName="Pharmacie du Lac"
            products={donnees.produits}
            sales={donnees.ventes}
            pharma={pharma}
            aujourdhui={aujourdhui}
            onAller={aller}
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
              const client = { id: `c-${Date.now()}`, store_id: BOUTIQUE, prenom: null, ...d };
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
        {onglet === "inventaire" && (
          <InventaireView
            storeId={BOUTIQUE}
            products={donnees.produits}
            categories={donnees.categories}
            peutValider
            onValide={() => undefined}
            titre="Inventaire"
            sousTitre="Comptez les boîtes en rayon : le logiciel montre les écarts avec le stock."
          />
        )}
      </main>
    </div>
  );
};
