/** Les pictogrammes de la maquette, tracés à l'identique. */
const trait = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
} as const;

export const IcTache = () => (
  <svg {...trait} strokeLinecap="round" aria-hidden="true">
    <path d="M4 6l2 2 3-3M4 14l2 2 3-3M13 7h7M13 15h7" />
  </svg>
);
export const IcAgenda = () => (
  <svg {...trait} aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
export const IcCloche = () => (
  <svg {...trait} strokeLinecap="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
  </svg>
);
export const IcAlerte = () => (
  <svg {...trait} strokeLinecap="round" aria-hidden="true">
    <path d="M12 3 2.5 20h19L12 3z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
);
export const IcArgent = () => (
  <svg {...trait} strokeLinecap="round" aria-hidden="true">
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
export const IcHorloge = () => (
  <svg {...trait} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const IcEquipe = () => (
  <svg {...trait} aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
  </svg>
);
export const IcActivite = () => (
  <svg {...trait} strokeLinecap="round" aria-hidden="true">
    <path d="M3 12h4l3-7 4 14 3-7h4" />
  </svg>
);
export const IcPersonne = () => (
  <svg {...trait} aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
export const IcChevron = () => (
  <svg className="chev" {...trait} strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const IcPlus = () => (
  <svg {...trait} strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IcActualiser = () => (
  <svg {...trait} strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);
export const IcRecherche = () => (
  <svg {...trait} strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const IcPrecedent = () => (
  <svg {...trait} strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const IcSuivant = () => (
  <svg {...trait} strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const IcCoche = ({ blanc = false }: { blanc?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    width={blanc ? 16 : undefined}
    height={blanc ? 16 : undefined}
    fill="none"
    stroke={blanc ? "#fff" : "currentColor"}
    strokeWidth={3}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M5 12l5 5 9-10" />
  </svg>
);
export const IcPoints = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="19" cy="12" r="1.7" />
  </svg>
);
export const IcFermer = () => (
  <svg {...trait} strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IcCarton = () => (
  <svg {...trait} aria-hidden="true">
    <path d="M21 8l-9-5-9 5 9 5 9-5z" />
    <path d="M3 8v8l9 5 9-5V8" />
  </svg>
);
