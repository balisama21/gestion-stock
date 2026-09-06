import React from "react";
import { ScrollMorphHero } from "../ui/scroll-morph-hero";
import { MiniEcran } from "./MiniEcran";
import { GROUPES_ECRANS } from "./ecrans";

interface HeroAccueilProps {
  /** Amène au formulaire de connexion, plus bas dans la page. */
  onRejoindreConnexion: () => void;
}

/**
 * Ouverture de la page : les écrans de l'application se rassemblent, puis
 * se déploient en voûte à mesure qu'on descend.
 *
 * Les cartes portent les écrans réels du produit, pas des photographies
 * de banque d'images. Le composant d'origine en chargeait vingt depuis un
 * hébergeur tiers ; elles ne montraient rien du logiciel et pesaient
 * plusieurs mégaoctets sur une connexion mobile. Ici, chaque carte est du
 * texte et des traits, sans un octet à télécharger — et l'on y reconnaît
 * son tableau de bord, son bilan, sa fiche client.
 *
 * Le titre est en monospace, la police que le produit imprime sur ses
 * tickets, et le ticket lui-même reste présent une fois la voûte formée :
 * c'est l'objet que le commerçant tend à son client.
 */
const ECRANS = GROUPES_ECRANS.flatMap((g) => g.ecrans);

export const HeroAccueil: React.FC<HeroAccueilProps> = ({ onRejoindreConnexion }) => {
  const cartes = ECRANS.map((e) => (
    <div
      key={e.nom}
      className="flex h-full w-full items-center justify-center overflow-hidden"
      style={{ background: "var(--papier)" }}
    >
      {/* La miniature est dessinée à sa taille naturelle puis réduite :
          mise à l'échelle par transformation, le texte reste net au lieu
          d'être recalculé à une taille où il deviendrait illisible. */}
      <div style={{ transform: "scale(.63)", transformOrigin: "center" }}>
        <MiniEcran titre={e.nom} rangees={e.apercu} />
      </div>
    </div>
  ));

  return (
    <ScrollMorphHero
      cartes={cartes}
      etiquettes={ECRANS.map((e) => e.nom)}
      introduction={
        <>
          <h1 className="titrage text-[clamp(1.7rem,6.2vw,3.4rem)]">
            Le cahier de votre boutique,
            <br />
            tenu tout seul.
          </h1>
          {/* Court volontairement : ce texte se lit à travers un anneau de
              cartes, et chaque ligne de plus le rend plus difficile à
              détacher du fond. La phrase entière est reprise plus bas,
              là où rien ne passe derrière. */}
          <p
            className="mx-auto mt-4 max-w-[30ch] text-[0.9375rem] leading-relaxed sm:text-base"
            style={{ color: "var(--carbone-doux)" }}
          >
            Vous notez une vente. Le stock, la caisse et le bilan suivent.
          </p>
          <p className="mt-6 text-[0.8125rem]" style={{ color: "var(--carbone-doux)" }}>
            Descendez pour voir les écrans
          </p>
        </>
      }
      contenu={
        <div className="mx-auto max-w-md">
          <h2 className="titrage text-[clamp(1.4rem,5vw,2rem)]">
            Vingt et un écrans, une seule saisie
          </h2>
          <p
            className="mx-auto mt-3 max-w-[38ch] text-[0.9375rem] leading-relaxed"
            style={{ color: "var(--carbone-doux)" }}
          >
            Une vente notée une fois se retrouve dans le stock, dans la caisse et dans le bilan.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onRejoindreConnexion}
              className="rounded-lg bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Accéder à mon espace
            </button>
            <a
              href="#registre"
              className="rounded-lg border px-7 py-3.5 text-center text-sm font-semibold transition-colors"
              style={{ borderColor: "var(--reglure)", color: "var(--carbone)" }}
            >
              Voir ce que ça remplace
            </a>
          </div>
        </div>
      }
    />
  );
};
