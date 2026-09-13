import React from "react";
import { MiniEcran } from "./MiniEcran";
import { GROUPES_ECRANS } from "./ecrans";
import { Revele } from "./Revele";

/**
 * L'inventaire des écrans livrés.
 *
 * Les huit bandes illustrées plus haut montrent le travail quotidien ;
 * celle-ci dit l'étendue. Chaque écran est nommé par le libellé exact de
 * la navigation — un visiteur retrouvera ces mots dans le menu une fois
 * entré — et montré par un aperçu de ce qu'il contient.
 *
 * ── Pourquoi la liste n'est plus repliée ──
 *
 * Elle l'était, derrière un bouton « Voir les 29 écrans ». Le repli
 * économisait de la hauteur sur téléphone, mais il rangeait hors de vue
 * la réponse à la seule question que se pose un visiteur : est-ce que ce
 * logiciel fait ce dont j'ai besoin ? Un catalogue fermé ne vend rien.
 * Les vingt-neuf écrans sont donc tous visibles, sans geste à faire.
 *
 * La hauteur est reprise autrement : deux colonnes dès le téléphone
 * plutôt qu'une seule, et l'aperçu à sa taille naturelle là où l'écran
 * est étroit, agrandi seulement quand la place le permet.
 *
 * ── Pourquoi un gabarit commun ──
 *
 * Les huit objets du registre ont chacun leur forme, parce qu'ils
 * racontent huit gestes différents. Ici c'est un catalogue : vingt-neuf
 * entrées d'une même liste, qui doivent se lire comme une liste. La
 * variété tient à ce que chaque aperçu montre, pas à sa découpe — et
 * c'est précisément ce qui permet de balayer la page en cherchant un
 * écran plutôt que de la lire ligne à ligne.
 *
 * Rien n'est annoncé qui n'existe pas : chaque fiche correspond à un
 * écran ou à un réglage réellement livré.
 */
/** Déduit des données : le chiffre annoncé ne peut pas mentir. */
const NOMBRE_ECRANS = GROUPES_ECRANS.reduce((n, g) => n + g.ecrans.length, 0);

export const InventaireApplication: React.FC = () => (
  <section id="inventaire" className="scroll-mt-16 px-5 py-20 sm:py-24">
    <style>{`
      /* L'aperçu est dessiné à sa taille naturelle puis mis à l'échelle
         par transformation : le texte reste net, au lieu d'être recalculé
         à une taille où il deviendrait illisible. Sur téléphone il garde
         sa taille d'origine — l'agrandir déborderait de la colonne. */
      .inv-cadre { height: 104px; }
      .inv-vignette { transform-origin: center; }
      @media (min-width: 640px) {
        .inv-cadre { height: 132px; }
        .inv-vignette { transform: scale(1.32); }
      }
      .inv-fiche .inv-vignette { transition: transform .4s ease; }
      @media (hover: hover) {
        .inv-fiche:hover .inv-vignette { transform: translateY(-3px); }
      }
      /* L'échelle doit être répétée : une transformation remplace la
         valeur précédente au lieu de s'y ajouter, et l'oublier ferait
         retomber l'aperçu à sa taille d'origine au survol. */
      @media (hover: hover) and (min-width: 640px) {
        .inv-fiche:hover .inv-vignette { transform: scale(1.32) translateY(-3px); }
      }
      @media (prefers-reduced-motion: reduce) {
        .inv-fiche .inv-vignette { transition: none; }
      }
    `}</style>

    <div className="mx-auto max-w-5xl">
      <Revele>
        <h2 className="titrage titre-section text-[clamp(1.6rem,4.6vw,2.3rem)]">
          L&apos;application, écran par écran
        </h2>
        <p
          className="mt-4 max-w-[52ch] text-[0.95rem] leading-relaxed"
          style={{ color: "var(--carbone-doux)" }}
        >
          Voici les {NOMBRE_ECRANS} écrans, tous. Les noms sont ceux que vous retrouverez dans le
          menu une fois entré, et chaque aperçu montre ce que l&apos;écran contient réellement.
          Rien n&apos;est annoncé pour plus tard.
        </p>
      </Revele>

      <div className="mt-14 space-y-14">
        {GROUPES_ECRANS.map(({ titre, ecrans }, iGroupe) => (
          <Revele key={titre} delai={iGroupe === 0 ? 0 : 60}>
            <div>
              {/* Le titre de groupe et son compte, séparés par un filet
                  qui court jusqu'au bord : il pose le groupe sans avoir
                  besoin d'un fond coloré ni d'un encadré. */}
              <div className="flex items-baseline gap-4">
                <h3 className="titrage shrink-0 text-[1.05rem]">{titre}</h3>
                <span
                  aria-hidden
                  className="h-px flex-1"
                  style={{ background: "var(--reglure)" }}
                />
                <span
                  className="shrink-0 font-mono text-[0.75rem]"
                  style={{ color: "var(--carbone-doux)" }}
                >
                  {ecrans.length}
                </span>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-9 sm:gap-x-8 lg:grid-cols-3">
                {ecrans.map(({ nom, quoi, apercu }) => (
                  <article key={nom} className="inv-fiche">
                    <div
                      className="inv-cadre flex items-center justify-center overflow-hidden rounded-md"
                      style={{
                        background: "color-mix(in srgb, var(--carbone) 4%, transparent)",
                      }}
                    >
                      <div className="inv-vignette">
                        <MiniEcran titre={nom} rangees={apercu} />
                      </div>
                    </div>
                    <h4 className="mt-3.5 text-[0.9375rem] font-medium leading-snug">{nom}</h4>
                    <p
                      className="mt-1 text-[0.8125rem] leading-relaxed sm:text-[0.875rem]"
                      style={{ color: "var(--carbone-doux)" }}
                    >
                      {quoi}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </Revele>
        ))}
      </div>

      <Revele>
        <p
          className="mt-16 max-w-[54ch] text-[0.875rem] leading-relaxed"
          style={{ color: "var(--carbone-doux)" }}
        >
          L&apos;application s&apos;installe aussi sur le téléphone depuis le navigateur, se
          verrouille par code PIN entre deux usages, et chaque vendeur ne voit que les écrans que
          vous lui avez ouverts.
        </p>
      </Revele>
    </div>
  </section>
);
