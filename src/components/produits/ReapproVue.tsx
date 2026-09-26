import React, { useMemo, useState } from "react";
import { FileText, Printer } from "lucide-react";
import type { StoreSettings } from "../../types";
import { DataList } from "../shared/DataList";
import { Modal } from "../shared/Modal";
import { Toggle } from "../shared/Toggle";
import type { ProduitARecommander } from "../../lib/bonDeCommande";
import type { ReglagesAlertesStock } from "../../lib/prealerteStock";
import {
  grouperParFournisseur,
  lignesDeReappro,
  nombreDeFournisseurs,
  type LigneReappro,
} from "../../lib/reapprovisionnement";
import { usePersonnalisation } from "../../lib/personnalisation";
import { lireReglagesDocuments } from "../../features/documents/lib/reglages";
import { FeuilleReappro } from "../../features/documents/FeuilleReappro";
import { dateDuJour } from "../../lib/dates";

interface ReapproVueProps {
  produits: ProduitARecommander[];
  reglages: ReglagesAlertesStock;
  settings?: StoreSettings;
  montrerFournisseur: boolean;
}

const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

export const ReapproVue: React.FC<ReapproVueProps> = ({
  produits,
  reglages,
  settings,
  montrerFournisseur,
}) => {
  const personnalisation = usePersonnalisation();
  const couleur = useMemo(
    () => lireReglagesDocuments(personnalisation.documents).couleur,
    [personnalisation.documents],
  );

  const lignes = useMemo(() => {
    const brutes = lignesDeReappro(produits, reglages);
    return montrerFournisseur ? brutes : brutes.map((l) => ({ ...l, fournisseur: "" }));
  }, [produits, reglages, montrerFournisseur]);

  const plusieurs = nombreDeFournisseurs(lignes) > 1;
  const [regrouper, setRegrouper] = useState(true);
  const grouper = plusieurs && regrouper;
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);

  const groupes = grouper ? grouperParFournisseur(lignes) : [{ fournisseur: "", lignes }];

  const item = (l: LigneReappro) => ({
    id: l.id,
    primary: <span className="truncate">{l.produit}</span>,
    meta: [
      l.reference || null,
      !grouper && l.fournisseur ? l.fournisseur : null,
      `seuil ${nombre(l.seuil)}`,
      `cible ${nombre(l.cible)}${l.cibleDeLaFiche ? "" : " (règle)"}`,
    ],
    amount: `${nombre(l.quantite)}${l.unite ? ` ${l.unite}` : ""}`,
    amountHint: "à commander",
    badge: (
      <span className={`app-badge ${l.stock <= 0 ? "app-badge-danger" : "app-badge-warning"}`}>
        {l.stock <= 0 ? "Rupture" : `${nombre(l.stock)} en stock`}
      </span>
    ),
    detailTitle: l.produit,
    detailSubtitle: l.reference,
    details: [
      { label: "Stock actuel", value: nombre(l.stock) },
      { label: "Seuil d'alerte", value: nombre(l.seuil) },
      {
        label: "Niveau cible",
        value: `${nombre(l.cible)}${l.cibleDeLaFiche ? "" : " — règle de la boutique"}`,
      },
      { label: "Quantité à commander", value: nombre(l.quantite) },
      ...(montrerFournisseur
        ? [{ label: "Fournisseur", value: l.fournisseur, hideIfEmpty: true }]
        : []),
    ],
  });

  return (
    <div className="space-y-4">
      <div className="app-card flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="mr-auto min-w-0">
          <p className="text-sm font-medium text-foreground">
            {lignes.length === 0
              ? "Aucun produit sous son seuil d'alerte"
              : `${lignes.length} produit${lignes.length > 1 ? "s" : ""} sous le seuil`}
          </p>
          <p className="text-xs text-muted-foreground">
            Quantité à commander = niveau cible − stock actuel.
          </p>
        </div>
        {plusieurs && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Toggle
              id="reappro-grouper"
              label="Regrouper par fournisseur"
              checked={regrouper}
              onChange={setRegrouper}
            />
            <span aria-hidden="true">Par fournisseur</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setFeuilleOuverte(true)}
          disabled={lignes.length === 0}
          className="app-btn-secondary"
        >
          <Printer className="h-4 w-4" />
          Feuille A4
        </button>
      </div>

      {lignes.length === 0 ? (
        <div className="app-card px-4 py-10 text-center text-sm text-muted-foreground">
          Tout est au-dessus du seuil. Rien à racheter pour l&apos;instant.
        </div>
      ) : (
        groupes.map((g) => (
          <section key={g.fournisseur || "_"} className="space-y-2">
            {grouper && (
              <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {g.fournisseur || "Sans fournisseur"} · {g.lignes.length}
              </h3>
            )}
            <div className="app-card overflow-hidden">
              <DataList items={g.lignes.map(item)} />
            </div>
          </section>
        ))
      )}

      <Modal
        open={feuilleOuverte}
        onClose={() => setFeuilleOuverte(false)}
        size="3xl"
        icon={<FileText className="h-4 w-4" />}
        title="Feuille de réapprovisionnement"
        description={`${lignes.length} produit${lignes.length > 1 ? "s" : ""}${grouper ? " · par fournisseur" : ""}`}
      >
        {feuilleOuverte && (
          <FeuilleReappro
            lignes={lignes}
            grouper={grouper}
            montrerFournisseur={montrerFournisseur}
            date={dateDuJour()}
            settings={settings}
            couleur={couleur}
          />
        )}
      </Modal>
    </div>
  );
};
