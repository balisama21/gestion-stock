import React from "react";
import { MiniEcran } from "./MiniEcran";
import { GROUPES_ECRANS } from "./ecrans";

/**
 * L'inventaire des écrans livrés.
 *
 * Les six bandes illustrées montrent le travail quotidien ; celle-ci dit
 * l'étendue. Chaque écran est nommé par le libellé exact de la
 * navigation — un visiteur retrouvera ces mots dans le menu une fois
 * entré — et accompagné d'un aperçu de ce qu'il contient.
 *
 * Les aperçus partagent un gabarit, contrairement aux six objets du
 * registre. C'est voulu : ceci est un catalogue, et un catalogue se lit
 * comme une liste. La variété tient à ce que chaque miniature montre.
 *
 * La liste est repliée par défaut. Déployée, elle doublait la hauteur de
 * la page sur téléphone pour une information qu'on consulte une fois,
 * avant de se décider. Le repli est un "details" natif : il s'ouvre au
 * clavier, fonctionne sans JavaScript, et son contenu reste lisible par
 * un moteur de recherche même fermé.
 *
 * Rien n'est ajouté qui n'existe pas : chaque ligne correspond à un
 * écran ou à un réglage réellement livré.
 */
/** Déduit des données : le chiffre annoncé ne peut pas mentir. */
const NOMBRE_ECRANS = GROUPES_ECRANS.reduce((n, g) => n + g.ecrans.length, 0);

export const InventaireApplication: React.FC = () => (
  <section id="inventaire" className="scroll-mt-16 px-5 py-20 sm:py-24">
    <style>{`
      .inventaire > summary::-webkit-details-marker { display: none; }
      .inventaire > summary:hover { background: color-mix(in srgb, var(--papier) 70%, transparent); }
      .inventaire .inv-fermer { display: none; }
      .inventaire[open] .inv-fermer { display: inline; }
      .inventaire[open] .inv-ouvrir { display: none; }
      .inventaire[open] .inv-chevron { transform: rotate(180deg); }
    `}</style>

    <div className="mx-auto max-w-5xl">
      <h2 className="titrage text-[clamp(1.6rem,4.6vw,2.3rem)]">
        L&apos;application, écran par écran
      </h2>
      <p
        className="mt-4 max-w-[52ch] text-[0.95rem] leading-relaxed"
        style={{ color: "var(--carbone-doux)" }}
      >
        Les noms ci-dessous sont ceux que vous retrouverez dans le menu une fois entré. Chaque écran
        existe ; rien n&apos;est annoncé pour plus tard.
      </p>

      <details className="inventaire mt-8">
        <summary
          className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border px-5 py-3 text-sm font-semibold transition-colors"
          style={{ borderColor: "var(--reglure)", color: "var(--carbone)" }}
        >
          <span className="inv-ouvrir">Voir les {NOMBRE_ECRANS} écrans</span>
          <span className="inv-fermer">Masquer la liste</span>
          <svg
            aria-hidden
            viewBox="0 0 12 12"
            className="inv-chevron h-3 w-3 transition-transform"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M2 4.5 L6 8.5 L10 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>

        <div className="mt-10 grid gap-x-14 gap-y-10 sm:grid-cols-2">
          {GROUPES_ECRANS.map(({ titre, ecrans }) => (
            <div key={titre}>
              <h3 className="titrage text-[1.05rem]">{titre}</h3>
              <dl className="mt-3">
                {ecrans.map(({ nom, quoi, apercu }) => (
                  <div key={nom} className="reglure flex items-center gap-4 py-4">
                    <MiniEcran titre={nom} rangees={apercu} />
                    <div className="min-w-0">
                      <dt className="text-[0.9375rem] font-medium">{nom}</dt>
                      <dd
                        className="mt-0.5 text-[0.875rem] leading-relaxed"
                        style={{ color: "var(--carbone-doux)" }}
                      >
                        {quoi}
                      </dd>
                    </div>
                  </div>
                ))}
                <div className="reglure" />
              </dl>
            </div>
          ))}
        </div>

        <p
          className="mt-12 max-w-[54ch] text-[0.875rem] leading-relaxed"
          style={{ color: "var(--carbone-doux)" }}
        >
          L&apos;application s&apos;installe aussi sur le téléphone depuis le navigateur, se
          verrouille par code PIN entre deux usages, et chaque vendeur ne voit que les écrans que
          vous lui avez ouverts.
        </p>
      </details>
    </div>
  </section>
);
