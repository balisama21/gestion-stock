import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EditeurLibre } from "./EditeurLibre";
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
    fireEvent.keyDown(zone, { key: "Enter" });
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
    const encre = screen.getByRole("group", { name: "Couleur du texte" });
    fireEvent.click(within(encre).getByRole("button", { name: "Bordeaux" }));
    fireEvent.change(screen.getByLabelText("Bordure"), { target: { value: "0.3" } });
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

    fireEvent.click(screen.getByRole("button", { name: "Supprimer de la feuille" }));
    expect(enregistrer()).toEqual([]);
  });

  it("un trait et un cadre s'ajoutent ; la touche Suppr retire l'élément choisi", () => {
    const enregistrer = ouvrirAvec();
    fireEvent.click(screen.getByRole("button", { name: "Trait" }));
    fireEvent.change(screen.getByLabelText("Épaisseur"), { target: { value: "1" } });
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
