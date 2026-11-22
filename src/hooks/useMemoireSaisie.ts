import { useCallback, useState } from "react";

/**
 * Ce qu'on a tapé récemment dans un champ, gardé sur l'appareil : les
 * médecins prescripteurs, les grossistes, les emplacements… Le plus
 * récent d'abord, sans doublon, au plus `max`. Le stockage peut manquer
 * (navigation privée) : on se contente alors de la session.
 */
export function useMemoireSaisie(cle: string, max = 6) {
  const lire = (): string[] => {
    try {
      const brut = typeof window !== "undefined" ? window.localStorage.getItem(cle) : null;
      const v = brut ? (JSON.parse(brut) as unknown) : [];
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  };
  const [liste, setListe] = useState<string[]>(lire);

  const retenir = useCallback(
    (valeur: string) => {
      const v = valeur.trim();
      if (!v) return;
      setListe((avant) => {
        const suite = [v, ...avant.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(
          0,
          max,
        );
        try {
          window.localStorage.setItem(cle, JSON.stringify(suite));
        } catch {
          /* rien à faire */
        }
        return suite;
      });
    },
    [cle, max],
  );

  return [liste, retenir] as const;
}
