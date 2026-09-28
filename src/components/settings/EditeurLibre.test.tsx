import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EditeurLibre } from "./EditeurLibre";
import { ContexteReglagesDocuments } from "../../features/documents/contexteReglages";
import { documentDeVente } from "../../features/documents/lib/buildDocument";
import {
  BOUTIQUE,
  CLIENT,
  PAIEMENT,
  PRODUITS,
  TICKET_TROIS_LIGNES,
} from "../../features/documents/lib/fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "../../features/documents/lib/reglages";
import {
  blocsResolus,
  creerDisposition,
  type Disposition,
} from "../../features/documents/lib/disposition";

vi.mock("../../features/documents/lib/traiterCachet", () => ({
  imageCachet: vi.fn(async () => null),
  imageVersPng: vi.fn(async () => ({ blob: new Blob(["x"]), largeur: 400, hauteur: 200 })),
  envoyerCachet: vi.fn(async () => ({ id: "i", chemin: "boutique-1/image.png", error: null })),
}));

afterEach(cleanup);

function ouvrir() {
  const disposition = creerDisposition("facture", "classique", "Essai");
  const onEnregistrer = vi.fn();
  const onFermer = vi.fn();
  render(
    <EditeurLibre
      disposition={disposition}
      document={null}
      couleur="#0E7C5A"
      enCours={false}
      onEnregistrer={onEnregistrer}
      onFermer={onFermer}
    />,
  );
  const enregistre = () => onEnregistrer.mock.calls.at(-1)?.[0] as Disposition;
  return { disposition, enregistre, onFermer };
}

describe("l'éditeur libre", () => {
  it("déplace le bloc choisi au clavier, au millimètre", () => {
    const { enregistre } = ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Logo" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowDown", shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    const logo = blocsResolus(enregistre()).logo;
    expect(logo.x).toBe(16);
    expect(logo.y).toBe(19);
  });

  it("n'offre pas de masquer une mention obligatoire", () => {
    ouvrir();
    expect(screen.queryByRole("button", { name: /Masquer Totaux/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Masquer Numéro et date/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Masquer Logo/ })).toBeTruthy();
  });

  it("masque un bloc facultatif et le retire de la feuille", () => {
    const { enregistre } = ouvrir();
    fireEvent.click(screen.getByRole("button", { name: /Masquer Mot de fin/ }));
    expect(document.querySelector('[data-cadre="motDeFin"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(blocsResolus(enregistre()).motDeFin.masque).toBe(true);
  });

  it("revient au modèle d'origine", () => {
    const { disposition, enregistre } = ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Logo" }));
    fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Revenir au modèle d'origine/ }));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(blocsResolus(enregistre())).toEqual(blocsResolus(disposition));
  });

  it("rend la disposition modifiée en revenant aux réglages", () => {
    const { onFermer } = ouvrir();
    fireEvent.change(screen.getByLabelText("Nom de la disposition"), {
      target: { value: "Factures pro" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revenir aux réglages" }));
    expect(onFermer.mock.calls[0][0].nom).toBe("Factures pro");
  });
});

describe("écrire sur la feuille", () => {
  const doc = documentDeVente({
    ventes: TICKET_TROIS_LIGNES,
    produits: PRODUITS,
    client: CLIENT,
    paiements: [PAIEMENT],
    boutique: BOUTIQUE,
    reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
  });

  function ouvrirAvecDocument() {
    const onEnregistrer = vi.fn();
    render(
      <EditeurLibre
        disposition={creerDisposition("facture", "classique", "Essai")}
        document={doc}
        couleur="#0E7C5A"
        enCours={false}
        onEnregistrer={onEnregistrer}
        onFermer={vi.fn()}
      />,
    );
    return () => {
      fireEvent.click(screen.getByRole("button", { name: /^Enregistrer/ }));
      return onEnregistrer.mock.calls.at(-1)?.[0] as Disposition;
    };
  }

  it("un double-clic sur le titre l'écrit sur place, et la feuille le montre", () => {
    const enregistrer = ouvrirAvecDocument();
    fireEvent.doubleClick(document.querySelector('[data-cadre="titre"]')!);
    const zone = screen.getByLabelText("Écrire : Titre du document");
    fireEvent.change(zone, { target: { value: "DEVIS ESTIMATIF" } });
    fireEvent.keyDown(zone, { key: "Enter", ctrlKey: true });
    expect(document.querySelector('.doc-libre [data-bloc="titre"]')?.textContent).toBe(
      "DEVIS ESTIMATIF",
    );
    expect(blocsResolus(enregistrer()).titre.textes).toEqual({ titre: "DEVIS ESTIMATIF" });
  });

  it("Échap abandonne ce qu'on écrivait", () => {
    const enregistrer = ouvrirAvecDocument();
    fireEvent.doubleClick(document.querySelector('[data-cadre="motDeFin"]')!);
    const zone = screen.getByLabelText("Écrire : Mot de fin");
    fireEvent.change(zone, { target: { value: "À bientôt" } });
    fireEvent.keyDown(zone, { key: "Escape" });
    expect(blocsResolus(enregistrer()).motDeFin.textes).toBeUndefined();
  });

  it("un bloc à plusieurs mots s'écrit dans le panneau, et se rétablit", () => {
    const enregistrer = ouvrirAvecDocument();
    fireEvent.doubleClick(document.querySelector('[data-cadre="totaux"]')!);
    const champ = screen.getByLabelText("Total") as HTMLInputElement;
    fireEvent.change(champ, { target: { value: "Net à payer" } });
    expect(document.querySelector('.doc-libre [data-bloc="totaux"]')?.textContent).toContain(
      "Net à payer",
    );
    expect(blocsResolus(enregistrer()).totaux.textes).toEqual({ libelleTotal: "Net à payer" });
    fireEvent.click(screen.getByRole("button", { name: "Rétablir Total" }));
    expect(blocsResolus(enregistrer()).totaux.textes).toBeUndefined();
  });

  it("n'offre pas d'écrire le nom de la boutique", () => {
    ouvrirAvecDocument();
    fireEvent.doubleClick(document.querySelector('[data-cadre="nom"]')!);
    expect(screen.queryByLabelText(/^Écrire/)).toBeNull();
    expect(screen.queryByText("Textes")).toBeNull();
  });
});

describe("l'allure depuis la feuille", () => {
  it("police, taille, gras et couleurs se règlent sur le bloc choisi", () => {
    const { enregistre } = ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Titre du document" }));
    fireEvent.change(screen.getByLabelText("Police"), { target: { value: "serif" } });
    fireEvent.click(screen.getByRole("button", { name: "Texte plus grand" }));
    fireEvent.click(screen.getByRole("button", { name: "Texte plus grand" }));
    fireEvent.click(screen.getByRole("button", { name: "Gras" }));
    fireEvent.click(screen.getByRole("button", { name: "Couleurs" }));
    const encre = screen.getByRole("group", { name: "Couleur du texte" });
    fireEvent.click(within(encre).getByRole("button", { name: "Bordeaux" }));
    fireEvent.click(
      within(screen.getByRole("group", { name: "Bordure" })).getByRole("button", { name: "Fine" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(blocsResolus(enregistre()).titre.habillage).toEqual({
      police: "serif",
      taille: 120,
      gras: true,
      encre: "#8E2F3C",
      bordure: 0.3,
    });

    fireEvent.click(screen.getByRole("button", { name: "Style du modèle" }));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(blocsResolus(enregistre()).titre.habillage).toBeUndefined();
  });

  it("la couleur du document se choisit ici, et se rend aux réglages", () => {
    const { enregistre } = ouvrir();
    const choix = screen.getByRole("group", { name: "Couleur du document" });
    fireEvent.click(within(choix).getByRole("button", { name: "Bleu nuit" }));
    expect(
      document.querySelector<HTMLElement>(".doc-feuille")?.style.getPropertyValue("--doc"),
    ).toBe("#1F4E79");
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(enregistre().couleur).toBe("#1F4E79");

    fireEvent.click(screen.getByRole("button", { name: /Celle des réglages/ }));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(enregistre()).not.toHaveProperty("couleur");
  });

  it("un bloc ordinaire propose son style", () => {
    ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Logo" }));
    expect(screen.getByLabelText("Police")).toBeTruthy();
  });
});

describe("ajouter sur la feuille", () => {
  function ouvrirAvec(storeId?: string) {
    const onEnregistrer = vi.fn();
    render(
      <EditeurLibre
        disposition={creerDisposition("facture", "classique", "Essai")}
        document={null}
        couleur="#0E7C5A"
        storeId={storeId}
        enCours={false}
        onEnregistrer={onEnregistrer}
        onFermer={vi.fn()}
      />,
    );
    return () => {
      fireEvent.click(screen.getByRole("button", { name: /^Enregistrer/ }));
      const d = onEnregistrer.mock.calls.at(-1)?.[0] as Disposition;
      return Object.entries(d.blocs).filter(([cle]) => cle.startsWith("el:"));
    };
  }

  it("un texte libre s'ajoute, s'écrit et se supprime", () => {
    const enregistrer = ouvrirAvec();
    fireEvent.click(screen.getByRole("button", { name: "Texte" }));
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Livraison offerte" } });
    const [[, bloc]] = enregistrer();
    expect(bloc).toMatchObject({
      element: { genre: "texte" },
      textes: { texte: "Livraison offerte" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(enregistrer()).toEqual([]);
  });

  it("un trait et un cadre s'ajoutent ; la touche Suppr retire l'élément choisi", () => {
    const enregistrer = ouvrirAvec();
    fireEvent.click(screen.getByRole("button", { name: "Trait" }));
    fireEvent.click(screen.getByRole("button", { name: "Couleurs" }));
    fireEvent.click(
      within(screen.getByRole("group", { name: "Épaisseur" })).getByRole("button", {
        name: "Épaisse",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cadre" }));
    const ajoutes = enregistrer();
    expect(ajoutes.map(([, b]) => b?.element?.genre)).toEqual(["trait", "cadre"]);
    expect(ajoutes[0][1]?.habillage?.bordure).toBe(1);

    fireEvent.keyDown(window, { key: "Delete" });
    expect(enregistrer().map(([, b]) => b?.element?.genre)).toEqual(["trait"]);
  });

  it("une image s'envoie, puis se pose à ses proportions", async () => {
    const enregistrer = ouvrirAvec("boutique-1");
    const champ = screen.getByLabelText("Ajouter une image");
    fireEvent.change(champ, {
      target: { files: [new File(["x"], "logo.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(enregistrer()).toHaveLength(1));
    const [[, bloc]] = enregistrer();
    expect(bloc?.element?.image).toEqual({
      chemin: "boutique-1/image.png",
      largeur: 400,
      hauteur: 200,
    });
    expect(bloc!.h / bloc!.l).toBeCloseTo(0.5, 1);
  });

  it("sans boutique, l'image n'est pas proposée", () => {
    ouvrirAvec();
    expect((screen.getByLabelText("Ajouter une image") as HTMLInputElement).disabled).toBe(true);
  });
});

describe("comme sur Canva : la barre, Suppr, Annuler", () => {
  it("la barre d'outils apparaît au-dessus du bloc choisi", () => {
    ouvrir();
    expect(screen.queryByRole("toolbar", { name: /^Outils/ })).toBeNull();
    fireEvent.pointerDown(document.querySelector('[data-cadre="titre"]')!, {
      pointerType: "mouse",
    });
    // Pendant le geste, la barre s'efface pour laisser voir la feuille.
    expect(screen.queryByRole("toolbar", { name: /^Outils/ })).toBeNull();
    fireEvent.pointerUp(document.querySelector('[data-cadre="titre"]')!);
    expect(screen.getByRole("toolbar", { name: "Outils : Titre du document" })).toBeTruthy();
  });

  it("Suppr masque un bloc du modèle, jamais une mention obligatoire", () => {
    const { enregistre } = ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Mot de fin" }));
    fireEvent.keyDown(window, { key: "Delete" });
    fireEvent.click(screen.getByRole("button", { name: "Totaux" }));
    fireEvent.keyDown(window, { key: "Delete" });
    expect(
      within(screen.getByRole("toolbar", { name: /^Outils/ })).getByLabelText(
        "Mention obligatoire",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    const blocs = blocsResolus(enregistre());
    expect(blocs.motDeFin.masque).toBe(true);
    expect(blocs.totaux.masque).toBeUndefined();
  });

  it("Ctrl+Z annule une suppression, Ctrl+Y la refait", () => {
    const { enregistre } = ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Mot de fin" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(blocsResolus(enregistre()).motDeFin.masque).toBeUndefined();

    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(blocsResolus(enregistre()).motDeFin.masque).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(blocsResolus(enregistre()).motDeFin.masque).toBeUndefined();
  });

  it("un élément ajouté se duplique, décalé", () => {
    const { enregistre } = ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Cadre" }));
    fireEvent.click(screen.getByRole("button", { name: "Dupliquer" }));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    const cadres = Object.entries(enregistre().blocs).filter(([c]) => c.startsWith("el:"));
    expect(cadres).toHaveLength(2);
    expect(cadres[1][1]!.x - cadres[0][1]!.x).toBe(5);
  });
});

describe("écrire le mot visé, comme sur Canva", () => {
  const doc = documentDeVente({
    ventes: TICKET_TROIS_LIGNES,
    produits: PRODUITS,
    client: CLIENT,
    paiements: [PAIEMENT],
    boutique: BOUTIQUE,
    reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
  });

  function ouvrirAvecDocument() {
    const onEnregistrer = vi.fn();
    render(
      <EditeurLibre
        disposition={creerDisposition("facture", "classique", "Essai")}
        document={doc}
        couleur="#0E7C5A"
        enCours={false}
        onEnregistrer={onEnregistrer}
        onFermer={vi.fn()}
      />,
    );
    return () => {
      fireEvent.click(screen.getByRole("button", { name: /^Enregistrer/ }));
      return blocsResolus(onEnregistrer.mock.calls.at(-1)?.[0] as Disposition);
    };
  }

  /** jsdom ne sait pas ce qui est sous le pointeur : on le lui dit. */
  function viser(selecteur: string) {
    const cible = document.querySelector(selecteur)!;
    document.elementsFromPoint = vi.fn(() => [cible]);
    return cible;
  }

  afterEach(() => {
    delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
  });

  it("un double-clic sur « Désignation » l'écrit là, dans le tableau", () => {
    const enregistrer = ouvrirAvecDocument();
    const th = [
      ...document.querySelectorAll<HTMLElement>('.doc-libre [data-bloc="tableau"] th'),
    ].find((t) => t.textContent === "Désignation")!;
    document.elementsFromPoint = vi.fn(() => [th]);
    fireEvent.doubleClick(document.querySelector('[data-cadre="tableau"]')!);
    const zone = screen.getByLabelText("Écrire : Tableau des lignes") as HTMLTextAreaElement;
    expect(zone.value).toBe("Désignation");
    fireEvent.change(zone, { target: { value: "Article" } });
    fireEvent.keyDown(zone, { key: "Enter" });
    expect(screen.queryByLabelText(/^Écrire/)).toBeNull();
    expect(enregistrer().tableau.textes).toEqual({ designation: "Article" });
  });

  it("un clic sur un chiffre n'ouvre rien : il vient de la base", () => {
    ouvrirAvecDocument();
    viser('.doc-libre [data-bloc="tableau"] tbody td:last-child');
    const cadre = document.querySelector('[data-cadre="tableau"]')!;
    fireEvent.doubleClick(cadre);
    expect(screen.queryByLabelText(/^Écrire/)).toBeNull();
  });

  it("un second clic sur le bloc déjà choisi ouvre l'écriture", () => {
    ouvrirAvecDocument();
    viser('.doc-libre [data-bloc="totaux"] .encadre span');
    const cadre = document.querySelector('[data-cadre="totaux"]')!;
    fireEvent.pointerDown(cadre, { pointerType: "mouse", pointerId: 1 });
    fireEvent.pointerUp(cadre, { pointerId: 1 });
    expect(screen.queryByLabelText(/^Écrire/)).toBeNull();
    fireEvent.pointerDown(cadre, { pointerType: "mouse", pointerId: 1 });
    fireEvent.pointerUp(cadre, { pointerId: 1 });
    expect((screen.getByLabelText("Écrire : Totaux") as HTMLTextAreaElement).value).toBe(
      doc.totaux.libelleTotal,
    );
  });

  it("Entrée passe à la ligne dans un titre ; cliquer à côté valide", () => {
    const enregistrer = ouvrirAvecDocument();
    fireEvent.doubleClick(document.querySelector('[data-cadre="titre"]')!);
    const zone = screen.getByLabelText("Écrire : Titre du document");
    fireEvent.change(zone, { target: { value: "FACTURE" } });
    fireEvent.keyDown(zone, { key: "Enter" });
    expect(screen.getByLabelText("Écrire : Titre du document")).toBeTruthy();
    fireEvent.change(zone, { target: { value: "FACTURE\nPROFORMA" } });
    fireEvent.blur(zone);
    expect(enregistrer().titre.textes).toEqual({ titre: "FACTURE\nPROFORMA" });
  });
});

describe("chaque coordonnée se règle sur la feuille", () => {
  const doc = documentDeVente({
    ventes: TICKET_TROIS_LIGNES,
    produits: PRODUITS,
    client: CLIENT,
    paiements: [PAIEMENT],
    boutique: BOUTIQUE,
    reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
  });

  function ouvrirEtToucher(champ: string) {
    const onEnregistrer = vi.fn();
    render(
      <EditeurLibre
        disposition={creerDisposition("facture", "classique", "Essai")}
        document={doc}
        couleur="#0E7C5A"
        enCours={false}
        onEnregistrer={onEnregistrer}
        onFermer={vi.fn()}
      />,
    );
    const cible = document.querySelector(`.doc-libre [data-champ="${champ}"]`)!;
    document.elementsFromPoint = vi.fn(() => [cible]);
    const cadre = document.querySelector('[data-cadre="emetteur"]')!;
    for (let i = 0; i < 2; i++) {
      fireEvent.pointerDown(cadre, { pointerType: "mouse", pointerId: 1 });
      fireEvent.pointerUp(cadre, { pointerId: 1 });
    }
    return () => {
      fireEvent.click(screen.getByRole("button", { name: /^Enregistrer/ }));
      return onEnregistrer.mock.calls.at(-1)?.[0] as Disposition;
    };
  }

  afterEach(() => {
    delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
  });

  it("toucher l'e-mail le choisit ; on le met sur sa ligne et on lui donne un libellé", () => {
    const enregistrer = ouvrirEtToucher("entete.email");
    expect(screen.getByRole("toolbar", { name: "Ligne : E-mail" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mettre sur sa propre ligne" }));
    fireEvent.click(screen.getByRole("button", { name: "Libellé devant" }));
    const zone = screen.getByLabelText(
      "Écrire : Coordonnées de la boutique",
    ) as HTMLTextAreaElement;
    expect(zone.value).toBe("E-mail : ");
    fireEvent.blur(zone);
    const em = blocsResolus(enregistrer()).emetteur;
    expect(em.coordonnees?.accole).toEqual({ "entete.email": false });
    expect(em.textes).toEqual({ "libelle:entete.email": "E-mail : " });
    expect(document.querySelector('.doc-libre [data-ligne="entete.email"]')?.textContent).toBe(
      `E-mail : ${BOUTIQUE.email}`,
    );
  });

  it("Suppr masque la ligne ; le panneau la rend", () => {
    const enregistrer = ouvrirEtToucher("entete.telephone");
    fireEvent.keyDown(window, { key: "Delete" });
    expect(blocsResolus(enregistrer()).emetteur.coordonnees?.masques).toEqual(["entete.telephone"]);
    // Le bloc reste choisi : seule la ligne est partie.
    fireEvent.click(screen.getByRole("button", { name: "Afficher Téléphone" }));
    expect(blocsResolus(enregistrer()).emetteur.coordonnees?.masques).toEqual([]);
  });

  it("le NIF/STAT ne se masque pas", () => {
    const enregistrer = ouvrirEtToucher("entete.nifStat");
    expect(screen.queryByRole("button", { name: "Masquer la ligne" })).toBeNull();
    fireEvent.keyDown(window, { key: "Delete" });
    expect(blocsResolus(enregistrer()).emetteur.coordonnees).toBeUndefined();
  });

  it("détacher le téléphone en fait un bloc à part", () => {
    const enregistrer = ouvrirEtToucher("entete.telephone");
    fireEvent.click(screen.getByRole("button", { name: "Détacher" }));
    const d = enregistrer();
    const detache = Object.values(d.blocs).find((b) => b?.element?.genre === "donnee");
    expect(detache?.element?.source).toEqual({ bloc: "emetteur", champ: "entete.telephone" });
    expect(blocsResolus(d).emetteur.coordonnees?.masques).toEqual(["entete.telephone"]);
  });
});

describe("retirer une ligne d'un clic", () => {
  const doc = documentDeVente({
    ventes: TICKET_TROIS_LIGNES,
    produits: PRODUITS,
    client: CLIENT,
    paiements: [PAIEMENT],
    boutique: BOUTIQUE,
    reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
  });

  function toucherLaLigne(texte: string) {
    const onEnregistrer = vi.fn();
    render(
      <EditeurLibre
        disposition={creerDisposition("facture", "classique", "Essai")}
        document={doc}
        couleur="#0E7C5A"
        enCours={false}
        onEnregistrer={onEnregistrer}
        onFermer={vi.fn()}
      />,
    );
    const rangee = [
      ...document.querySelectorAll<HTMLElement>('.doc-libre [data-bloc="reperes"] .doc-meta > div'),
    ].find((n) => n.textContent?.startsWith(texte))!;
    // Le pointeur tombe sur la valeur, pas sur le libellé : on choisit la ligne.
    document.elementsFromPoint = vi.fn(() => [(rangee.lastChild as Element) ?? rangee, rangee]);
    const cadre = document.querySelector('[data-cadre="reperes"]')!;
    for (let i = 0; i < 2; i++) {
      fireEvent.pointerDown(cadre, { pointerType: "mouse", pointerId: 1 });
      fireEvent.pointerUp(cadre, { pointerId: 1 });
    }
    return () => {
      fireEvent.click(screen.getByRole("button", { name: /^Enregistrer/ }));
      return blocsResolus(onEnregistrer.mock.calls.at(-1)?.[0] as Disposition);
    };
  }

  afterEach(() => {
    delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
  });

  it("« Vendeur » se choisit et part avec Suppr ; le panneau le rend", () => {
    const enregistrer = toucherLaLigne("Vendeur");
    expect(screen.getByRole("toolbar", { name: "Ligne : Vendeur" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Détacher" })).toBeNull();
    fireEvent.keyDown(window, { key: "Delete" });
    expect(enregistrer().reperes.masquees).toEqual(["Vendeur"]);
    expect(document.querySelector('.doc-libre [data-bloc="reperes"]')?.textContent).not.toContain(
      "Vendeur",
    );
    fireEvent.click(screen.getByRole("button", { name: "Afficher Vendeur" }));
    expect(enregistrer().reperes.masquees).toBeUndefined();
  });

  it("le numéro ne se retire pas", () => {
    const enregistrer = toucherLaLigne("N°");
    expect(screen.getByRole("toolbar", { name: "Ligne : N°" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Delete" });
    expect(enregistrer().reperes.masquees).toBeUndefined();
  });
});

describe("un petit bloc posé sur un grand reste attrapable", () => {
  afterEach(() => {
    delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
  });

  it("le tableau choisi, un clic sur le texte posé dessus choisit le texte", () => {
    ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Texte" }));
    const texte = document.querySelector<HTMLElement>('[data-cadre^="el:"]')!;
    fireEvent.click(screen.getByRole("button", { name: "Tableau des lignes" }));
    const tableau = document.querySelector<HTMLElement>('[data-cadre="tableau"]')!;
    document.elementsFromPoint = vi.fn(() => [tableau, texte]);
    fireEvent.pointerDown(tableau, { pointerType: "mouse", pointerId: 1 });
    fireEvent.pointerUp(tableau, { pointerId: 1 });
    expect(screen.getByRole("toolbar", { name: "Outils : Texte libre" })).toBeTruthy();
  });
});

describe("les coordonnées de la boutique s'écrivent sur la feuille", () => {
  const doc = documentDeVente({
    ventes: TICKET_TROIS_LIGNES,
    produits: PRODUITS,
    client: CLIENT,
    paiements: [PAIEMENT],
    boutique: BOUTIQUE,
    reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
  });

  afterEach(() => {
    delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
  });

  function ouvrirAvecFiche(base: "classique" | "compact" = "classique") {
    const onEnregistrer = vi.fn();
    const enregistrerBoutique = vi.fn(async () => null);
    render(
      <ContexteReglagesDocuments.Provider
        value={{
          peutRegler: true,
          reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
          enregistrer: async () => null,
          enregistrerBoutique,
        }}
      >
        <EditeurLibre
          disposition={creerDisposition("facture", base, "Essai")}
          document={doc}
          couleur="#0E7C5A"
          enCours={false}
          onEnregistrer={onEnregistrer}
          onFermer={vi.fn()}
        />
      </ContexteReglagesDocuments.Provider>,
    );
    return { onEnregistrer, enregistrerBoutique };
  }

  it("double-clic sur le téléphone : on l'écrit, la fiche est mise à jour à l'enregistrement", async () => {
    const { onEnregistrer, enregistrerBoutique } = ouvrirAvecFiche();
    const tel = document.querySelector('.doc-libre [data-champ="entete.telephone"]')!;
    document.elementsFromPoint = vi.fn(() => [tel]);
    fireEvent.doubleClick(document.querySelector('[data-cadre="emetteur"]')!);
    const zone = screen.getByLabelText(
      "Écrire : Coordonnées de la boutique",
    ) as HTMLTextAreaElement;
    expect(zone.value).toBe(BOUTIQUE.phone);
    fireEvent.change(zone, { target: { value: "034 11 222 33" } });
    fireEvent.keyDown(zone, { key: "Enter" });
    expect(document.querySelector('.doc-libre [data-champ="entete.telephone"]')?.textContent).toBe(
      "034 11 222 33",
    );
    expect(screen.getByText("Modifications non enregistrées.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer/ }));
    await waitFor(() => expect(onEnregistrer).toHaveBeenCalled());
    expect(enregistrerBoutique).toHaveBeenCalledWith({ phone: "034 11 222 33" });
  });

  it("sans droit sur la fiche, la valeur ne s'écrit pas", () => {
    render(
      <EditeurLibre
        disposition={creerDisposition("facture", "classique", "Essai")}
        document={doc}
        couleur="#0E7C5A"
        enCours={false}
        onEnregistrer={vi.fn()}
        onFermer={vi.fn()}
      />,
    );
    const tel = document.querySelector('.doc-libre [data-champ="entete.telephone"]')!;
    document.elementsFromPoint = vi.fn(() => [tel]);
    fireEvent.doubleClick(document.querySelector('[data-cadre="emetteur"]')!);
    expect(screen.queryByLabelText(/^Écrire/)).toBeNull();
  });

  it("Compact : « Une coordonnée par ligne » depuis la barre du bloc", () => {
    const { onEnregistrer } = ouvrirAvecFiche("compact");
    fireEvent.click(screen.getByRole("button", { name: "Coordonnées de la boutique" }));
    fireEvent.click(screen.getByRole("button", { name: "Une coordonnée par ligne" }));
    expect(
      document.querySelectorAll('.doc-libre [data-bloc="emetteur"] [data-ligne]').length,
    ).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer/ }));
    return waitFor(() =>
      expect(
        blocsResolus(onEnregistrer.mock.calls.at(-1)?.[0] as Disposition).emetteur.coordonnees
          ?.accole?.["entete.email"],
      ).toBe(false),
    );
  });
});
