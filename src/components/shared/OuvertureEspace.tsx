import React from "react";

/** Les liens fonctionnent aussi avant l’hydratation de la page publique. */
export function OuvertureEspace({ etape }: { etape: string }) {
  return (
    <main className="app-container py-8">
      <h1 className="text-2xl font-semibold">Mon espace</h1>
      <p role="status" className="mt-2 text-sm text-muted-foreground">
        {etape}
      </p>
      <nav aria-label="Écran à ouvrir" className="mt-6 flex flex-wrap gap-3">
        <a
          id="ouvrir-accueil"
          href="#ouvrir-accueil"
          className="rounded-lg border px-4 py-3 target:bg-muted"
        >
          Accueil
        </a>
        <a
          id="ouvrir-compte"
          href="#ouvrir-compte"
          className="rounded-lg border px-4 py-3 target:bg-muted"
        >
          Mon compte
        </a>
      </nav>
    </main>
  );
}
