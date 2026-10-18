import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LivraisonsView } from "./LivraisonsView";
import type { Livraison } from "../lib/livraisons";

/**
 * « CONFIÉE À » N'ÉCRIT QU'UNE FOIS LA SAISIE FINIE.
 *
 * Le champ écrivait en base à chaque lettre : confier une course à
 * « Rakoto » envoyait six modifications, dont cinq à des noms faux.
 */

const COURSE = {
  id: "l1",
  numero: "LIV001",
  statut: "a_faire",
  destinataire: "Rasoa",
  adresse: "Analakely",
  telephone: null,
  precisions: null,
  date_prevue: "2026-10-18",
  montant_a_encaisser: 0,
  montant_encaisse: 0,
  argent_remis_le: null,
  contenu: [],
  livreur_id: null,
  confie_a: null,
  note: null,
  motif_echec: null,
  prise_en_charge_le: null,
  remise_le: null,
} as unknown as Livraison;

function afficher() {
  const onUpdateDelivery = vi.fn().mockResolvedValue({ error: null });
  render(
    <LivraisonsView
      deliveries={[COURSE]}
      membres={[]}
      onAddDelivery={vi.fn()}
      onUpdateDelivery={onUpdateDelivery}
      onDeleteDelivery={vi.fn()}
      onRemettreArgent={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText("Rasoa"));
  return { onUpdateDelivery, champ: screen.getByLabelText("Confiée à") };
}

afterEach(cleanup);

describe("confier une course", () => {
  it("rien ne part pendant la frappe ; une seule écriture en quittant le champ", () => {
    const { onUpdateDelivery, champ } = afficher();
    for (const v of ["R", "Ra", "Rak", "Rakoto"]) fireEvent.change(champ, { target: { value: v } });
    expect(onUpdateDelivery).not.toHaveBeenCalled();

    fireEvent.blur(champ);
    expect(onUpdateDelivery).toHaveBeenCalledTimes(1);
    expect(onUpdateDelivery).toHaveBeenCalledWith("l1", { livreur_id: null, confie_a: "Rakoto" });
  });

  it("Entrée valide aussi", () => {
    const { onUpdateDelivery, champ } = afficher();
    fireEvent.change(champ, { target: { value: "Rakoto" } });
    fireEvent.keyDown(champ, { key: "Enter" });
    expect(onUpdateDelivery).toHaveBeenCalledTimes(1);
  });

  it("quitter le champ sans rien changer n'écrit rien", () => {
    const { onUpdateDelivery, champ } = afficher();
    fireEvent.blur(champ);
    expect(onUpdateDelivery).not.toHaveBeenCalled();
  });
});
