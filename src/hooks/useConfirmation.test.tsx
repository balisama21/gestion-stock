import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useConfirmation, type OptionsConfirmation } from "./useConfirmation";

afterEach(cleanup);

/** Un bouton qui pose la question et rapporte la réponse. */
const Banc = ({
  onReponse,
  options,
}: {
  onReponse: (oui: boolean) => void;
  options?: OptionsConfirmation;
}) => {
  const { confirmer, modaleConfirmation } = useConfirmation();
  return (
    <>
      <button onClick={async () => onReponse(await confirmer("Supprimer la note N-1 ?", options))}>
        Demander
      </button>
      {modaleConfirmation}
    </>
  );
};

const ouvrir = async (options?: OptionsConfirmation) => {
  const onReponse = vi.fn();
  render(<Banc onReponse={onReponse} options={options} />);
  fireEvent.click(screen.getByRole("button", { name: "Demander" }));
  const modale = await screen.findByRole("dialog", { name: "Confirmation" });
  return { onReponse, modale };
};

describe("useConfirmation", () => {
  it("n'affiche rien tant qu'aucune question n'est posée", () => {
    render(<Banc onReponse={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("répond oui sur le bouton de confirmation, et une seule fois", async () => {
    const { onReponse, modale } = await ouvrir({ danger: true, libelle: "Supprimer" });
    expect(within(modale).getByText("Supprimer la note N-1 ?")).toBeTruthy();
    const oui = within(modale).getByRole("button", { name: "Supprimer" });
    fireEvent.click(oui);
    fireEvent.click(oui);
    await waitFor(() => expect(onReponse).toHaveBeenCalledWith(true));
    expect(onReponse).toHaveBeenCalledTimes(1);
    expect((oui as HTMLButtonElement).disabled).toBe(true);
  });

  it("répond non sur « Annuler »", async () => {
    const { onReponse, modale } = await ouvrir();
    fireEvent.click(within(modale).getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(onReponse).toHaveBeenCalledWith(false));
  });

  it("répond non sur Échap", async () => {
    const { onReponse } = await ouvrir();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onReponse).toHaveBeenCalledWith(false));
  });
});
