import React from "react";
import { TicketImprime } from "./TicketImprime";

interface HeroAccueilProps {
  /** Amène au formulaire de connexion, plus bas dans la page. */
  onRejoindreConnexion: () => void;
}

/**
 * Ouverture de la page.
 *
 * À gauche ce que le logiciel promet, à droite ce qu'il fabrique. Le
 * ticket qui s'imprime est l'unique effet de la page ; tout le reste est
 * posé et immobile, pour que ce moment-là porte.
 *
 * Le titre est en monospace, la police que le produit imprime sur ses
 * tickets. Aucune étiquette au-dessus : un titre qui a besoin qu'on
 * l'annonce est un titre à réécrire.
 */
export const HeroAccueil: React.FC<HeroAccueilProps> = ({ onRejoindreConnexion }) => (
  <section className="relative overflow-hidden px-5 pb-20 pt-14 sm:pt-20">
    {/* La réglure du cahier, en fond, qui défile avec la page. */}
    <div aria-hidden className="trame-papier pointer-events-none absolute inset-0 -z-10" />

    <div className="mx-auto grid max-w-5xl items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
      <div>
        <h1 className="titrage text-[clamp(2.1rem,7.2vw,3.4rem)]">
          Le cahier de votre boutique,
          <br />
          tenu tout seul.
        </h1>

        <p
          className="mt-6 max-w-[46ch] text-[1.0625rem] leading-relaxed"
          style={{ color: "var(--carbone-doux)" }}
        >
          Vous enregistrez une vente. Le stock baisse, la caisse monte, le client qui doit encore
          quelque chose est noté, et le bilan du mois s&apos;écrit tout seul.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
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

        <p className="mt-6 text-sm" style={{ color: "var(--carbone-doux)" }}>
          Ticket 58 ou 80 mm, facture A4, PDF ou image — au format exact du papier.
        </p>
      </div>

      <TicketImprime />
    </div>
  </section>
);
