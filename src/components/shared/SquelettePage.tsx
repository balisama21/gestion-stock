import React from "react";

/**
 * Ce qu'on voit pendant qu'un écran arrive.
 *
 * À la place, il y avait le mot « Chargement… » seul au milieu d'une
 * page blanche. Un squelette dit deux choses de plus : ce qui arrive —
 * un en-tête, puis une liste — et surtout *où* cela se posera, si bien
 * que rien ne saute au moment où le contenu prend sa place.
 *
 * Il ne paraît qu'après un quart de seconde (voir `.app-squelette` dans
 * styles.css). Les écrans de cette application sont découpés en
 * morceaux de quelques dizaines de kilo-octets qui arrivent le plus
 * souvent en un clin d'œil : un squelette montré aussitôt ne ferait que
 * clignoter, et l'application paraîtrait plus lente qu'elle ne l'est.
 *
 * Le texte lu par les lecteurs d'écran reste explicite : une suite de
 * rectangles gris ne dit rien à qui ne voit pas l'écran.
 */
export const SquelettePage: React.FC = () => (
  <div className="app-squelette" role="status" aria-busy="true">
    <span className="sr-only">Chargement de l&apos;écran…</span>

    {/* L'en-tête de page : titre à gauche, bouton d'action à droite. */}
    <div className="app-page-head" aria-hidden="true">
      <div className="app-page-head-text">
        <div className="skeleton h-5 w-40" />
        <div className="skeleton mt-2 h-3 w-56 max-w-full" />
      </div>
      <div className="app-page-actions">
        <div className="skeleton h-11 w-32" />
      </div>
    </div>

    {/* Quelques lignes de liste. Cinq : de quoi occuper le haut de
        l'écran sans donner à croire que la liste en compte exactement
        autant. */}
    <div className="app-card mt-4 divide-y divide-border" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="skeleton h-4" style={{ width: `${64 - i * 6}%` }} />
            <div className="skeleton mt-2 h-3" style={{ width: `${42 - i * 4}%` }} />
          </div>
          <div className="skeleton h-4 w-20 shrink-0" />
        </div>
      ))}
    </div>
  </div>
);
