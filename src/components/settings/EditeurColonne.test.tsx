import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EditeurColonne, rangDeDepot } from "./EditeurColonne";
import {
  colonneResolue,
  creerDisposition,
  type CleTicket,
  type Disposition,
} from "../../features/documents/lib/disposition";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "../../features/documents/lib/reglages";

afterEach(cleanup);

describe("le point de dépôt d'une section", () => {
  const cadres = {
    entete: { top: 0, h: 40 },
    infos: { top: 40, h: 20 },
    articles: { top: 60, h: 60 },
  };
  const ordre: CleTicket[] = ["entete", "infos", "articles"];

  it("se pose entre les deux milieux les plus proches", () => {
    expect(rangDeDepot(cadres, ordre, "articles", 10)).toBe(0);
    expect(rangDeDepot(cadres, ordre, "articles", 45)).toBe(1);
    expect(rangDeDepot(cadres, ordre, "entete", 200)).toBe(2);
  });
});

describe("l'éditeur du ticket", () => {
  it("réordonne aux flèches et masque le code-barres, jamais la mention légale", () => {
    const onEnregistrer = vi.fn();
    render(
      <EditeurColonne
        disposition={creerDisposition("ticket", "classique", "Caisse")}
        document={null}
        ticket={REGLAGES_DOCUMENTS_PAR_DEFAUT.ticket}
        enCours={false}
        onFermer={vi.fn()}
        onEnregistrer={onEnregistrer}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Monter Totaux" }));
    fireEvent.click(screen.getByRole("button", { name: "Masquer Code-barres" }));
    expect(screen.queryByRole("button", { name: /Masquer Message et mention légale/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    const d = onEnregistrer.mock.calls[0][0] as Disposition;
    expect(colonneResolue(d)).toEqual({
      ordre: ["entete", "infos", "totaux", "articles", "pied", "codeBarres"],
      masques: ["codeBarres"],
    });
  });
});
