import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { useDefilerVers } from "./useDefilerVers";

/** Un écran maître-détail : la fiche n'existe qu'une fois sélectionnée. */
function Ecran() {
  const [choisi, setChoisi] = useState(false);
  const defilerVers = useDefilerVers();
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setChoisi(true);
          defilerVers("fiche");
        }}
      >
        Ouvrir
      </button>
      {choisi && <div id="fiche">La fiche</div>}
    </div>
  );
}

describe("amener la fiche à l'écran", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("défile vers la fiche que le même geste vient de faire apparaître", () => {
    const vus: string[] = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      vus.push(this.id);
    });
    render(<Ecran />);
    fireEvent.click(screen.getByText("Ouvrir"));
    expect(screen.getByText("La fiche")).toBeTruthy();
    expect(vus).toEqual(["fiche"]);
  });
});
