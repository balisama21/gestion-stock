import React from "react";
import { ArrowRight, Leaf } from "lucide-react";
import tableau from "./visite/tableau.jpg";
import tableauPetit from "./visite/tableau-800.jpg";

interface HeroAccueilProps {
  /** Amène au formulaire de connexion, plus bas dans la page. */
  onRejoindreConnexion: () => void;
}

/**
 * Ouverture de la page : le logiciel, posé dans la nature.
 *
 * En fond, une vallée verte ; au premier plan, le vrai tableau de bord de
 * la boutique de démonstration ; autour, des médaillons de la faune et de
 * la flore. Ce ne sont pas des photos décoratives choisies pour l'occasion :
 * ce sont celles que le tableau de bord affiche chaque matin
 * (`HERO_PAYSAGES_JOUR`), si bien que la page d'accueil montre déjà
 * l'application telle qu'on l'ouvrira.
 *
 * Photos Unsplash (licence libre), servies par leur CDN à la largeur
 * demandée, comme dans le tableau de bord.
 */

const photo = (id: string, largeur: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${largeur}&q=70`;

const FOND = "1541637593725-923467404d17";

interface Medaillon {
  id: string;
  legende: string;
  /** Position autour de la capture, en classes Tailwind. */
  place: string;
  taille: string;
  /** Décalage de l'animation, pour que les médaillons ne flottent pas ensemble. */
  delai: string;
  /** Masqué sur téléphone, où la place manque. */
  grandEcran?: boolean;
}

const MEDAILLONS: Medaillon[] = [
  {
    id: "1750615745167-09d610d30d54",
    legende: "Lémurien",
    place: "-left-6 -top-10 sm:-left-12 sm:-top-14",
    taille: "h-20 w-20 sm:h-28 sm:w-28",
    delai: "0s",
  },
  {
    id: "1781520513038-8fe543ed270b",
    legende: "Caméléon",
    place: "-right-4 top-[38%] sm:-right-12",
    taille: "h-16 w-16 sm:h-24 sm:w-24",
    delai: "-2.2s",
  },
  {
    id: "1554569258-670a25302596",
    legende: "Hibiscus",
    place: "-bottom-8 left-[12%] sm:-bottom-10",
    taille: "h-16 w-16 sm:h-[5.5rem] sm:w-[5.5rem]",
    delai: "-4.1s",
  },
  {
    id: "1621089667522-272aa4b5b71b",
    legende: "Martin-pêcheur",
    place: "-right-6 -top-8",
    taille: "h-20 w-20",
    delai: "-1.3s",
    grandEcran: true,
  },
];

/** Le bandeau du bas : la nature que le tableau de bord fait défiler. */
const BANDEAU = [
  "1683321937185-ae683df69a6f", // tisserin
  "1759827767985-b14b62b04d43", // anthurium
  "1617540021016-72023b487e99", // caméléon
  "1464419014442-769c523d575b", // cascade
  "1682888433896-c17bf057d0af", // héliconia
  "1598563352765-85f7971070a7", // lémurien brun
];

export const HeroAccueil: React.FC<HeroAccueilProps> = ({ onRejoindreConnexion }) => (
  <section className="relative isolate overflow-hidden">
    <style>{`
      @keyframes ha-flotte {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      @keyframes ha-entree {
        from { opacity: 0; transform: translateY(18px); }
        to { opacity: 1; transform: none; }
      }
      .ha-flotte { animation: ha-flotte 6s ease-in-out infinite; }
      .ha-entree { animation: ha-entree .9s cubic-bezier(.2,.7,.2,1) both; }
      @media (prefers-reduced-motion: reduce) {
        .ha-flotte, .ha-entree { animation: none; }
      }
    `}</style>

    {/* Le paysage, puis un voile vert sombre qui porte le texte. */}
    <img
      src={photo(FOND, 1600)}
      srcSet={`${photo(FOND, 800)} 800w, ${photo(FOND, 1600)} 1600w, ${photo(FOND, 2400)} 2400w`}
      sizes="100vw"
      alt=""
      fetchPriority="high"
      className="absolute inset-0 -z-20 h-full w-full object-cover"
      style={{ objectPosition: "50% 72%", background: "#123d27" }}
    />
    <div
      aria-hidden
      className="absolute inset-0 -z-10"
      style={{
        background:
          "linear-gradient(100deg, rgba(6,38,24,.68) 0%, rgba(8,48,30,.46) 34%, rgba(10,60,36,.1) 62%, transparent 100%), linear-gradient(to top, rgba(6,30,19,.42), transparent 30%)",
      }}
    />
    {/* Sur écran étroit, le texte passe au-dessus du ciel : voile vertical. */}
    <div
      aria-hidden
      className="absolute inset-0 -z-10 lg:hidden"
      style={{
        background:
          "linear-gradient(to bottom, rgba(6,38,24,.62) 0%, rgba(6,38,24,.4) 45%, rgba(6,38,24,.15) 100%)",
      }}
    />

    <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-16 sm:px-8 sm:pt-20 lg:min-h-[calc(100svh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12 lg:pb-32">
      <div className="ha-entree text-white" style={{ textShadow: "0 2px 18px rgba(0,25,14,.55)" }}>
        <span
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold"
          style={{ background: "rgba(255,255,255,.14)", backdropFilter: "blur(6px)" }}
        >
          <Leaf className="h-3.5 w-3.5" style={{ color: "#8fe0b4" }} aria-hidden />
          Stock · Caisse · Clients · Bilan
        </span>
        <h1 className="mt-6 max-w-[16ch] text-[clamp(2.2rem,5.6vw,4rem)] font-bold leading-[1.05] tracking-tight">
          Le cahier de votre boutique, <span style={{ color: "#8fe0b4" }}>tenu tout seul.</span>
        </h1>
        <p className="mt-5 max-w-[42ch] text-[1.0625rem] leading-relaxed text-white/80">
          Vous notez une vente. Le stock, la caisse et le bilan suivent, sans recopier une ligne.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRejoindreConnexion}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
          >
            Accéder à mon espace
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <a
            href="#visite"
            className="rounded-lg border border-white/40 px-7 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Faire la visite
          </a>
        </div>
      </div>

      {/* Le vrai tableau de bord, entouré de la faune et de la flore. */}
      <div
        className="ha-entree relative mx-auto w-full max-w-[40rem]"
        style={{ animationDelay: ".15s" }}
      >
        <div
          className="overflow-hidden rounded-2xl border border-white/30 bg-white"
          style={{ boxShadow: "0 40px 90px -30px rgba(0,0,0,.6), 0 0 0 6px rgba(255,255,255,.08)" }}
        >
          <div
            className="flex items-center gap-1.5 border-b px-3.5 py-2"
            style={{ background: "#f6f5f1", borderColor: "#e6e2d8" }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e46a5c" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e9b64b" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#5fb36f" }} />
            <span className="ml-3 truncate text-[0.72rem] font-medium" style={{ color: "#6b675e" }}>
              Tableau de bord
            </span>
          </div>
          <img
            src={tableau}
            srcSet={`${tableauPetit} 800w, ${tableau} 1413w`}
            sizes="(min-width: 1024px) 40rem, 100vw"
            width={1413}
            height={1170}
            alt="Le tableau de bord : ventes du jour, entrées et sorties d'argent, stock"
            className="block aspect-[1413/900] w-full object-cover object-top"
          />
        </div>

        {MEDAILLONS.map((m) => (
          <figure
            key={m.id}
            className={`absolute m-0 ${m.place} ${m.grandEcran ? "hidden lg:block" : ""}`}
          >
            <div className="ha-flotte" style={{ animationDelay: m.delai }}>
              <img
                src={photo(m.id, 240)}
                alt={m.legende}
                loading="lazy"
                className={`${m.taille} rounded-full border-4 border-white object-cover shadow-xl`}
              />
            </div>
          </figure>
        ))}
      </div>
    </div>

    {/* Bandeau de bas de page : la nature que l'on retrouve dans l'application. */}
    <div className="absolute inset-x-0 bottom-0 hidden border-t border-white/15 bg-black/25 backdrop-blur-sm md:block">
      <div className="mx-auto flex max-w-7xl items-center gap-5 px-8 py-3">
        <p className="shrink-0 text-[0.8125rem] leading-snug text-white/85">
          Chaque matin, votre tableau de bord
          <br />
          s'ouvre sur une photo de la nature.
        </p>
        <div className="flex min-w-0 flex-1 justify-end gap-2.5 overflow-hidden">
          {BANDEAU.map((id) => (
            <img
              key={id}
              src={photo(id, 200)}
              alt=""
              loading="lazy"
              className="h-12 w-20 shrink-0 rounded-lg border border-white/30 object-cover"
            />
          ))}
        </div>
      </div>
    </div>
  </section>
);
