import React from "react";

/**
 * Le jeu d'icônes de l'application : trait fin, avec un aplat teinté
 * dessous (duotone). Repris de la maquette `docs/maquette/dashboard-tantana.html`.
 *
 * Le trait suit `currentColor` ; l'aplat (`.f`) aussi, à 17 % d'opacité.
 * Les tracés sont des constantes du code : aucune donnée n'y entre.
 */
const TRACES = {
  home: '<path class="f" d="M4.5 10.2 12 4l7.5 6.2V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19z"/><path d="M3 11 12 3.5 21 11M5.5 9.5V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.5M10 20.5V15a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5.5"/>',
  clipboard:
    '<rect class="f" x="4.5" y="5" width="15" height="16" rx="2.5"/><rect x="4.5" y="5" width="15" height="16" rx="2.5"/><path d="M9 3.5h6V7H9zM8.5 12h7M8.5 16H13"/>',
  history:
    '<circle class="f" cx="12" cy="12" r="8.5"/><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 4v4.5H8M12 7.5V12l3 2"/>',
  grid: '<rect class="f" x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect class="f" x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect class="f" x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect class="f" x="13.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  tasks:
    '<rect class="f" x="3.5" y="4" width="17" height="16" rx="3"/><rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="m7.5 9.5 1.3 1.3 2.5-2.6M13.5 10H17M7.5 15.5l1.3 1.3 2.5-2.6M13.5 16H17"/>',
  calendar:
    '<rect class="f" x="3.5" y="5" width="17" height="15.5" rx="3"/><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2"/>',
  bell: '<path class="f" d="M6.5 17v-6a5.5 5.5 0 0 1 11 0v6l1.5 1.5H5z"/><path d="M6.5 17v-6a5.5 5.5 0 0 1 11 0v6l1.5 1.5H5zM10 21h4M12 3.5v2"/>',
  dollar:
    '<circle class="f" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5"/>',
  wallet:
    '<rect class="f" x="3" y="6.5" width="18" height="13" rx="3"/><path d="M17 6.5V6a2 2 0 0 0-2-2H6a3 3 0 0 0-3 3v9.5a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-7a3 3 0 0 0-3-3H5"/><circle cx="16.5" cy="13.5" r="1.1"/>',
  box: '<path class="f" d="M12 3.5 19.5 7.5v9L12 20.5 4.5 16.5v-9z"/><path d="M12 3 20 7.5v9L12 21 4 16.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>',
  users:
    '<circle class="f" cx="9" cy="8.5" r="3.5"/><path class="f" d="M2.5 19.5a6.5 6 0 0 1 13 0z"/><circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5a6.5 6 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14a6 5.5 0 0 1 3.5 5.5"/>',
  user: '<circle class="f" cx="12" cy="8.5" r="4"/><path class="f" d="M4.5 20a7.5 7 0 0 1 15 0z"/><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20a7.5 7 0 0 1 15 0"/>',
  userplus:
    '<circle class="f" cx="9" cy="8.5" r="3.5"/><path class="f" d="M2.5 19.5a6.5 6 0 0 1 13 0z"/><circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5a6.5 6 0 0 1 13 0M19 8v6M16 11h6"/>',
  usercheck:
    '<circle class="f" cx="9" cy="8.5" r="3.5"/><path class="f" d="M2.5 19.5a6.5 6 0 0 1 13 0z"/><circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5a6.5 6 0 0 1 13 0M16 11l2 2 4-4"/>',
  search:
    '<circle class="f" cx="11" cy="11" r="6.5"/><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  help: '<circle class="f" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
  moon: '<path class="f" d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/><path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
  sun: '<circle class="f" cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  settings:
    '<circle class="f" cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  cart: '<path class="f" d="M5.8 7h14.7l-1.8 8H7.5z"/><path d="M2.5 3.5h3L7.6 15h11l1.9-8H6"/><circle cx="9.5" cy="19.8" r="1.3"/><circle cx="17.5" cy="19.8" r="1.3"/>',
  bag: '<path class="f" d="M5 8h14l-1 12.5H6z"/><path d="M5 8h14l-1 12.5H6zM9 10.5V6.5a3 3 0 0 1 6 0v4"/>',
  clock:
    '<circle class="f" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  trophy:
    '<path class="f" d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8.5 20.5h7M9.5 18h5"/>',
  chart:
    '<rect class="f" x="4" y="12" width="4" height="8" rx="1.2"/><rect x="4" y="12" width="4" height="8" rx="1.2"/><rect class="f" x="10" y="4.5" width="4" height="15.5" rx="1.2"/><rect x="10" y="4.5" width="4" height="15.5" rx="1.2"/><rect class="f" x="16" y="9" width="4" height="11" rx="1.2"/><rect x="16" y="9" width="4" height="11" rx="1.2"/>',
  truck:
    '<path class="f" d="M2.5 6.5h11V16h-11zM13.5 9.5h3.7l3.3 3.5V16h-7z"/><path d="M2.5 6.5h11V16h-11zM13.5 9.5h3.7l3.3 3.5V16h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  mail: '<rect class="f" x="3" y="5" width="18" height="14" rx="3"/><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3.5 8 8.5 5.5L20.5 8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  filter:
    '<path class="f" d="M4 5h16l-6 7.5V19l-4 2v-8.5z"/><path d="M4 5h16l-6 7.5V19l-4 2v-8.5z"/>',
  alert:
    '<path class="f" d="M12 3.5 21 19.5H3z"/><path d="M12 3.5 21 19.5H3zM12 10v4.5M12 17h.01"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.5-5.8M20 4.5v4h-4"/>',
  swap: '<path d="M4 8h14.5L15 4.5M20 16H5.5L9 19.5"/>',
  file: '<path class="f" d="M6.5 3.5h7L18 8v12a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1z"/><path d="M6.5 3.5h7L18 8v12a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1zM13.5 3.5V8H18M9 13h6M9 16.5h6"/>',
  receipt:
    '<path class="f" d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/>',
  card: '<rect class="f" x="3" y="5.5" width="18" height="13" rx="2.5"/><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
  wrench:
    '<path class="f" d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z"/><path d="M14.7 6.3a4 4 0 0 1 5-2.5l-2.6 2.6.5 2 2 .5 2.6-2.6a4 4 0 0 1-5.3 5L9.4 18.8a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1 .8-2z"/>',
  banknote:
    '<rect class="f" x="2.5" y="6" width="19" height="12" rx="2.5"/><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  zap: '<path class="f" d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/><path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
  info: '<circle class="f" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  pie: '<circle class="f" cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z"/><path d="M15 3.5A8.5 8.5 0 0 1 20.5 9H15z"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',
  pulse: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  arrowleft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowdown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  arrowup: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  chevright: '<path d="m9 6 6 6-6 6"/>',
  chevleft: '<path d="m15 6-6 6 6 6"/>',
  chevdown: '<path d="m6 9 6 6 6-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  dots: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
  eye: '<path class="f" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  store:
    '<path class="f" d="M4.5 10v9.5h15V10z"/><path d="M3.5 9.5 5 4.5h14l1.5 5M3.5 9.5a2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.4 0M5 12.5V20h14v-7.5M10 20v-4.5h4V20"/>',
  leaf: '<path class="f" d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15z"/><path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15zM5 19l8-8"/>',
  sidebarclose:
    '<rect class="f" x="3" y="4" width="18" height="16" rx="3"/><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15.5 10 13.5 12l2 2"/>',
  sidebaropen:
    '<rect class="f" x="3" y="4" width="18" height="16" rx="3"/><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M13.5 10l2 2-2 2"/>',
} as const;

export type NomIcone = keyof typeof TRACES;

export const IconeDuo: React.FC<{
  nom: NomIcone;
  className?: string;
  style?: React.CSSProperties;
  titre?: string;
}> = ({ nom, className, style, titre }) => (
  <span
    className={`ico-duo${className ? ` ${className}` : ""}`}
    style={style}
    role={titre ? "img" : undefined}
    aria-label={titre}
    aria-hidden={titre ? undefined : true}
  >
    <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: TRACES[nom] }} />
  </span>
);
