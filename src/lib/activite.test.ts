import { describe, expect, it } from "vitest";
import { construireNotifications, type SourcesActivite } from "./activite";
import type { PrealerteAnnoncee } from "../hooks/usePrealertesStock";

/**
 * CE QUE LA CLOCHE DIT DE LA PRÉALERTE DE STOCK.
 *
 * Le reste de `construireNotifications` n'est pas couvert ici : ce
 * fichier est né avec la préalerte, et porte ce qu'elle a apporté.
 */

/** Le strict nécessaire : tout le reste est vide, donc muet. */
const sources = (patch: Partial<SourcesActivite> = {}): SourcesActivite =>
  ({
    products: [],
    sales: [],
    purchases: [],
    expenses: [],
    apports: [],
    reglements: [],
    quotes: [],
    deliveries: [],
    orders: [],
    clients: [],
    tresorerie: 100_000,
    seuilAlerteTresorerie: 0,
    permissions: null,
    permissionsDetaillees: null,
    membres: [],
    moiId: null,
    journal: [],
    taches: [],
    evenements: [],
    rappels: [],
    alertesStock: true,
    prealertes: [],
    boutique: null,
    avancesEnAttente: [],
    delaisRappel: { veilleHeure: 18, memeJourMinutes: 60 },
    formatMontant: (n: number) => `${n} Ar`,
    ...patch,
  }) as unknown as SourcesActivite;

const prealerte = (nom: string, stock: number, seuil: number): PrealerteAnnoncee => ({
  productId: nom,
  produit: nom,
  stock,
  seuil,
  unite: null,
});

const laPrealerte = (s: SourcesActivite) =>
  construireNotifications(s).find((n) => n.id.startsWith("alerte-prealerte-stock"));

describe("la cloche annonce les produits qui approchent de leur seuil", () => {
  it("se tait quand la base n'a rien laissé sortir", () => {
    // C'est le cas de toute boutique qui n'a pas activé la fonction :
    // la table n'a aucune ligne pour elle.
    expect(laPrealerte(sources())).toBeUndefined();
  });

  it("une seule notification pour tous les produits", () => {
    // Une par produit ferait une colonne qu'on cesserait de lire.
    const n = construireNotifications(
      sources({
        prealertes: [prealerte("Huile 1 L", 5, 3), prealerte("Savon", 4, 3)],
      }),
    ).filter((x) => x.id.startsWith("alerte-prealerte-stock"));

    expect(n).toHaveLength(1);
    expect(n[0].titre).toBe("2 produits approchent de leur seuil");
  });

  it("accorde son titre au singulier", () => {
    expect(laPrealerte(sources({ prealertes: [prealerte("Huile 1 L", 5, 3)] }))?.titre).toBe(
      "1 produit approche de son seuil",
    );
  });

  it("dit le nom, le stock restant et le seuil, produit par produit", () => {
    // C'est ce qu'il faut pour décider quoi commander ; « 2 produits »
    // ne le dit pas.
    const n = laPrealerte(sources({ prealertes: [prealerte("Huile 1 L", 5, 3)] }));
    expect(n?.lignes).toEqual(["Huile 1 L : 5 unités restantes, seuil défini à 3."]);
  });

  it("s'arrête à cinq lignes et compte le reste", () => {
    // Au-delà, ce n'est plus une notification qu'on lit mais une liste
    // qu'on ouvre — et le bouton mène précisément à cette liste.
    const huit = Array.from({ length: 8 }, (_, i) => prealerte(`Produit ${i}`, 5, 3));
    const n = laPrealerte(sources({ prealertes: huit }));

    expect(n?.titre).toBe("8 produits approchent de leur seuil");
    expect(n?.lignes).toHaveLength(6);
    expect(n?.lignes?.at(-1)).toBe("et 3 autres.");
  });

  it("propose de préparer la commande", () => {
    const n = laPrealerte(sources({ prealertes: [prealerte("Huile 1 L", 5, 3)] }));
    expect(n?.actions).toEqual(["preparer-la-commande"]);
  });

  it("suit le réglage « Alertes de stock bas » comme les autres", () => {
    // Qui a éteint les alertes de stock ne doit pas en recevoir une
    // nouvelle sorte.
    const n = laPrealerte(
      sources({ alertesStock: false, prealertes: [prealerte("Huile 1 L", 5, 3)] }),
    );
    expect(n).toBeUndefined();
  });

  it("reste muette pour qui ne voit pas les produits", () => {
    // Un collaborateur sans le module Produits n'a rien à faire d'une
    // liste de réapprovisionnement.
    const n = laPrealerte(
      sources({
        permissions: ["ventes"],
        permissionsDetaillees: {},
        prealertes: [prealerte("Huile 1 L", 5, 3)],
      }),
    );
    expect(n).toBeUndefined();
  });
});
