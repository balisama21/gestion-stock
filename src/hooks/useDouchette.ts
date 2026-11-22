import { useEffect, useRef } from "react";

/**
 * LA DOUCHETTE, OÙ QUE SOIT LE CURSEUR
 *
 * Un lecteur de codes-barres USB ou Bluetooth se comporte comme un
 * clavier : il tape le code, très vite, puis Entrée. Quand le curseur est
 * dans un champ, le champ reçoit le code et s'en occupe lui-même. Quand il
 * n'est nulle part (on vient de cliquer un bouton, de fermer une fenêtre),
 * les touches se perdraient : ce crochet les écoute sur toute la page et
 * reconnaît un code à sa vitesse de frappe — aucune main ne tape huit
 * chiffres en un dixième de seconde.
 */

/** Plus long que ça entre deux touches : c'est une main, pas un lecteur. */
const ECART_MAX_MS = 60;
const LONGUEUR_MIN = 6;

const estUnChamp = (cible: EventTarget | null) => {
  const el = cible as HTMLElement | null;
  if (!el) return false;
  const balise = el.tagName;
  return balise === "INPUT" || balise === "TEXTAREA" || balise === "SELECT" || el.isContentEditable;
};

/** Découpe une frappe en code : vraie si la frappe a le rythme d'un lecteur. */
export function lireFrappe(touches: { touche: string; quand: number }[]): string | null {
  if (touches.length < LONGUEUR_MIN) return null;
  for (let i = 1; i < touches.length; i += 1) {
    if (touches[i].quand - touches[i - 1].quand > ECART_MAX_MS) return null;
  }
  return touches.map((t) => t.touche).join("");
}

export function useDouchette(onCode: (code: string) => void, actif = true) {
  const rappel = useRef(onCode);
  rappel.current = onCode;

  useEffect(() => {
    if (!actif || typeof document === "undefined") return;
    let touches: { touche: string; quand: number }[] = [];
    const ecouter = (e: KeyboardEvent) => {
      if (estUnChamp(e.target) || e.ctrlKey || e.altKey || e.metaKey) {
        touches = [];
        return;
      }
      const quand = performance.now();
      const derniere = touches[touches.length - 1];
      if (derniere && quand - derniere.quand > ECART_MAX_MS * 3) touches = [];
      if (e.key === "Enter") {
        const code = lireFrappe(touches);
        touches = [];
        if (code) {
          e.preventDefault();
          rappel.current(code);
        }
        return;
      }
      if (e.key.length === 1) touches.push({ touche: e.key, quand });
    };
    document.addEventListener("keydown", ecouter);
    return () => document.removeEventListener("keydown", ecouter);
  }, [actif]);
}

/** Le code tel qu'on le compare : sans espaces. */
export const codePropre = (code: string | null | undefined) => (code ?? "").replace(/\s/g, "");
