import { useEffect, useState } from "react";

/**
 * LA MÉTÉO DU HAUT DE PAGE
 *
 * La température du moment dans la ville choisie, lue chez Open-Meteo :
 * service gratuit, sans clé ni compte, qui ne reçoit que les
 * coordonnées de la ville — rien sur la boutique ni sur la personne.
 *
 * Le choix de la ville est retenu par ce navigateur. La mesure est
 * gardée une demi-heure pour ne pas interroger le service à chaque
 * ouverture. Si la lecture échoue, la température n'est simplement pas
 * affichée : jamais de chiffre inventé.
 */

export interface Ville {
  nom: string;
  lat: number;
  lon: number;
}

/** Les grandes villes de Madagascar, la capitale en premier. */
export const VILLES: Ville[] = [
  { nom: "Antananarivo", lat: -18.8792, lon: 47.5079 },
  { nom: "Toamasina", lat: -18.1492, lon: 49.4023 },
  { nom: "Antsirabe", lat: -19.8659, lon: 47.0333 },
  { nom: "Fianarantsoa", lat: -21.4527, lon: 47.0857 },
  { nom: "Mahajanga", lat: -15.7167, lon: 46.3167 },
  { nom: "Toliara", lat: -23.35, lon: 43.6667 },
  { nom: "Antsiranana", lat: -12.2787, lon: 49.2917 },
  { nom: "Nosy Be", lat: -13.3333, lon: 48.2667 },
  { nom: "Morondava", lat: -20.2833, lon: 44.2833 },
  { nom: "Taolagnaro", lat: -25.0319, lon: 46.9833 },
];

const CLE_VILLE = "tantana.dash.ville";
const CLE_MESURE = "tantana.dash.meteo";
const DUREE = 30 * 60_000;

/** Ce que le ciel fait, ramené à quelques familles d'icônes. */
export type Ciel = "soleil" | "nuageux" | "couvert" | "brouillard" | "pluie" | "orage";

export interface Meteo {
  temperature: number;
  ciel: Ciel;
  jour: boolean;
}

/** Les codes WMO d'Open-Meteo, regroupés. */
function cielDuCode(code: number): Ciel {
  if (code <= 1) return "soleil";
  if (code === 2) return "nuageux";
  if (code === 3) return "couvert";
  if (code === 45 || code === 48) return "brouillard";
  if (code >= 95) return "orage";
  return "pluie";
}

function lireVille(): string {
  try {
    const v = window.localStorage.getItem(CLE_VILLE);
    if (v && VILLES.some((x) => x.nom === v)) return v;
  } catch {
    /* Navigation privée : la capitale. */
  }
  return VILLES[0].nom;
}

function lireMesure(ville: string): Meteo | null {
  try {
    const brut = window.sessionStorage.getItem(CLE_MESURE);
    if (!brut) return null;
    const m = JSON.parse(brut) as { ville: string; a: number; meteo: Meteo };
    return m.ville === ville && Date.now() - m.a < DUREE ? m.meteo : null;
  } catch {
    return null;
  }
}

/**
 * La ville choisie et sa météo.
 *
 * Lue après le premier rendu seulement : le serveur n'a ni le choix
 * retenu par le navigateur, ni de raison d'appeler le service.
 */
export function useMeteo(): {
  ville: string;
  choisirVille: (nom: string) => void;
  meteo: Meteo | null;
} {
  const [ville, setVille] = useState(VILLES[0].nom);
  const [meteo, setMeteo] = useState<Meteo | null>(null);

  useEffect(() => setVille(lireVille()), []);

  useEffect(() => {
    const enCache = lireMesure(ville);
    if (enCache) {
      setMeteo(enCache);
      return;
    }
    const v = VILLES.find((x) => x.nom === ville) ?? VILLES[0];
    const ctrl = new AbortController();
    setMeteo(null);
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${v.lat}&longitude=${v.lon}` +
        "&current=temperature_2m,weather_code,is_day&timezone=auto",
      { signal: ctrl.signal },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(
        (d: { current?: { temperature_2m?: number; weather_code?: number; is_day?: number } }) => {
          const c = d.current;
          if (typeof c?.temperature_2m !== "number") return;
          const m: Meteo = {
            temperature: Math.round(c.temperature_2m),
            ciel: cielDuCode(c.weather_code ?? 0),
            jour: c.is_day !== 0,
          };
          setMeteo(m);
          try {
            window.sessionStorage.setItem(
              CLE_MESURE,
              JSON.stringify({ ville, a: Date.now(), meteo: m }),
            );
          } catch {
            /* Rien à retenir : on relira la prochaine fois. */
          }
        },
      )
      .catch(() => {
        /* Hors ligne ou service injoignable : pas de température. */
      });
    return () => ctrl.abort();
  }, [ville]);

  const choisirVille = (nom: string) => {
    setVille(nom);
    try {
      window.localStorage.setItem(CLE_VILLE, nom);
    } catch {
      /* Le choix ne vaut que pour cette page. */
    }
  };

  return { ville, choisirVille, meteo };
}
