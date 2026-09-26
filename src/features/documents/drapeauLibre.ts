import { useEffect, useState } from "react";

/**
 * L'éditeur libre reste caché tant que les documents imprimés ne savent pas
 * encore le rendre. `?editeur_libre=1` l'ouvre sur cet appareil, `=0` le referme.
 */
const CLE = "tantana.editeurLibre";

export function editeurLibreVisible(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const p = new URLSearchParams(window.location.search).get("editeur_libre");
    if (p === "1") window.localStorage.setItem(CLE, "1");
    if (p === "0") window.localStorage.removeItem(CLE);
    return window.localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}

export function useEditeurLibreVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(editeurLibreVisible()), []);
  return visible;
}
