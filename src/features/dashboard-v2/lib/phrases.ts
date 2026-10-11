/**
 * LES PHRASES DU HAUT DE PAGE
 *
 * Deux séries : celle de la journée, celle du soir. Le texte change donc
 * deux fois par jour — au réveil, puis à l'heure du « Bonsoir » — et
 * d'un jour à l'autre on passe à la phrase suivante de la série. Avec
 * huit phrases par série, aucune ne revient avant huit jours.
 *
 * Chaque phrase a son sous-titre (deux lignes) et sa devise manuscrite
 * (deux lignes, posée à droite sur la photo).
 */

export interface Phrase {
  lignes: [string, string];
  devise: [string, string];
}

const JOUR: Phrase[] = [
  {
    lignes: [
      "Chaque jour est une nouvelle opportunité.",
      "Votre boutique grandit, pas à pas, vers de nouveaux horizons !",
    ],
    devise: ["Ensemble vers", "plus de réussite !"],
  },
  {
    lignes: [
      "Une nouvelle journée commence.",
      "Chaque client servi avec le sourire est une victoire.",
    ],
    devise: ["Le succès se cultive", "chaque jour !"],
  },
  {
    lignes: ["Les petites actions d'aujourd'hui", "font les grandes réussites de demain."],
    devise: ["Pas à pas,", "on avance !"],
  },
  {
    lignes: [
      "Votre énergie donne le ton de la journée.",
      "Faites-en une belle journée de ventes !",
    ],
    devise: ["Belle journée", "de ventes !"],
  },
  {
    lignes: [
      "Un stock bien tenu, des clients satisfaits :",
      "c'est ainsi que se bâtit une belle boutique.",
    ],
    devise: ["Rigueur", "et passion !"],
  },
  {
    lignes: [
      "Osez, essayez, progressez.",
      "Chaque effort rapproche votre boutique de ses objectifs.",
    ],
    devise: ["Cap sur", "vos objectifs !"],
  },
  {
    lignes: [
      "La réussite appartient à ceux qui avancent avec un projet.",
      "Le vôtre progresse aujourd'hui encore.",
    ],
    devise: ["Croyez en", "votre projet !"],
  },
  {
    lignes: [
      "Chaque vente raconte une histoire de confiance.",
      "Continuez à l'écrire, client après client.",
    ],
    devise: ["La confiance,", "ça se construit !"],
  },
];

const SOIR: Phrase[] = [
  {
    lignes: ["Belle journée accomplie.", "Prenez un moment pour mesurer le chemin parcouru."],
    devise: ["Fier du", "chemin parcouru !"],
  },
  {
    lignes: [
      "Le travail d'aujourd'hui prépare les succès de demain.",
      "Reposez-vous, vous l'avez bien mérité.",
    ],
    devise: ["Demain sera", "encore meilleur !"],
  },
  {
    lignes: [
      "Chaque journée compte, même les plus calmes.",
      "L'essentiel est de continuer d'avancer.",
    ],
    devise: ["On continue,", "ensemble !"],
  },
  {
    lignes: [
      "Faites le point, souriez, et préparez demain :",
      "votre boutique est entre de bonnes mains.",
    ],
    devise: ["Bravo pour", "cette journée !"],
  },
  {
    lignes: [
      "Les belles boutiques se construisent soir après soir,",
      "avec patience et constance.",
    ],
    devise: ["Patience", "et constance !"],
  },
  {
    lignes: ["Un bilan clair ce soir,", "c'est une journée plus sereine demain."],
    devise: ["Sereinement", "vers demain !"],
  },
  {
    lignes: [
      "Merci pour votre engagement aujourd'hui.",
      "Chaque effort compte pour l'avenir de votre boutique.",
    ],
    devise: ["Merci pour", "vos efforts !"],
  },
  {
    lignes: [
      "Ce soir, célébrez vos petites victoires :",
      "ce sont elles qui font les grandes réussites.",
    ],
    devise: ["Petites victoires,", "grandes réussites !"],
  },
];

/** Le soir commence avec le « Bonsoir » : de 18 h à 4 h. */
export const estLeSoir = (d: Date): boolean => d.getHours() >= 18 || d.getHours() < 4;

/**
 * La phrase du moment. Après minuit et jusqu'à 4 h, on reste sur celle
 * de la veille au soir : la nuit ne doit pas changer de phrase en cours.
 */
export function phraseDuMoment(d: Date): Phrase {
  const soir = estLeSoir(d);
  const ref = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getHours() < 4 ? 1 : 0));
  const jour = Math.floor(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()) / 86_400_000);
  const serie = soir ? SOIR : JOUR;
  return serie[jour % serie.length];
}

/** Toutes les lettres des devises, pour ne charger que celles-là de la police. */
export const LETTRES_DES_DEVISES: string = [
  ...new Set([...JOUR, ...SOIR].flatMap((p) => [...p.devise.join(" ")])),
].join("");
