import React from "react";
import { ArrowRight, FileText, ImageIcon, Printer } from "lucide-react";
import { TicketImprime } from "./TicketImprime";
import { CourbesSiVisible } from "../ui/floating-paths";

/**
 * Ce que le logiciel fabrique : le ticket.
 *
 * Deux colonnes de poids visuel comparable, centrées l'une sur l'autre.
 * La version précédente laissait le ticket flotter plus haut que le
 * texte : les deux blocs semblaient appartenir à deux compositions
 * différentes. Ici la grille les aligne sur leur milieu, et la flèche
 * verte entre les deux dit ce qui relie l'un à l'autre — une vente
 * enregistrée, un ticket qui sort.
 *
 * Les courbes de fond sont celles de la section de connexion : c'est le
 * même motif d'un bout à l'autre du site, pas une décoration inventée
 * pour cette section.
 *
 * Les données du ticket ne sont pas touchées : ce composant se contente
 * de l'agrandir et de mieux l'asseoir.
 */

/**
 * Les trois formats de sortie.
 *
 * Chaque icône porte la couleur que le format a d'ordinaire : le rouge du
 * PDF, le bleu d'un fichier image, le noir d'une impression thermique. On
 * les reconnaît alors sans lire le libellé, ce qu'un jeu d'icônes toutes
 * vertes ne permettait pas.
 *
 * Ce sont les seules couleurs de la page en dehors de la palette : elles
 * ne désignent pas des actions mais des types de fichiers, dont la
 * convention est plus forte que notre charte.
 */
const FORMATS = [
  { icone: Printer, titre: "58 / 80 mm", detail: "Ticket thermique", teinte: "var(--carbone)" },
  { icone: FileText, titre: "PDF", detail: "Facture A4", teinte: "#d6382b" },
  { icone: ImageIcon, titre: "Image", detail: "Par message", teinte: "var(--encre)" },
] as const;

export const SectionTicket: React.FC = () => (
  <section className="reglure relative overflow-hidden px-5 py-20 sm:py-28">
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ color: "var(--primary)" }}
    >
      <CourbesSiVisible />
    </div>

    <div className="relative mx-auto max-w-6xl">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto_minmax(0,22rem)] lg:gap-10">
        <div>
          <span
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold"
            style={{
              background: "color-mix(in srgb, var(--terre) 12%, transparent)",
              color: "var(--terre)",
            }}
          >
            Vente enregistrée <ArrowRight className="h-3 w-3" /> Ticket généré
          </span>

          <h2
            className="mt-6 text-[clamp(1.9rem,5.2vw,3.1rem)] font-bold leading-[1.08] tracking-tight"
            style={{ color: "var(--carbone)" }}
          >
            Et le ticket sort
            <br />
            dans la foulée
            <span style={{ color: "var(--primary)" }}>.</span>
          </h2>

          <p
            className="mt-6 max-w-[46ch] text-[1.0625rem] leading-relaxed"
            style={{ color: "var(--carbone-doux)" }}
          >
            Ticket 58 ou 80 mm pour l&apos;imprimante thermique du comptoir, facture A4 pour un
            client qui la demande, PDF ou image pour l&apos;envoyer par message — au format exact du
            papier.
          </p>

          {/* Trois colonnes dès le téléphone : empilées, ces trois
              mentions occupaient un écran entier pour dire trois mots.
              Ni cadre ni fond — l'icône colorée suffit à les séparer. */}
          <ul className="mt-9 grid grid-cols-3 gap-4 sm:flex sm:gap-9">
            {FORMATS.map(({ icone: Icone, titre, detail, teinte }) => (
              <li
                key={titre}
                className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-center sm:gap-3 sm:text-left"
              >
                <Icone
                  className="h-7 w-7 shrink-0 transition-transform duration-300 sm:h-6 sm:w-6"
                  style={{ color: teinte }}
                  strokeWidth={1.6}
                />
                <span className="leading-tight">
                  <span
                    className="block text-[0.875rem] font-semibold sm:text-[0.9375rem]"
                    style={{ color: "var(--carbone)" }}
                  >
                    {titre}
                  </span>
                  <span
                    className="block text-[0.75rem] sm:text-[0.8125rem]"
                    style={{ color: "var(--carbone-doux)" }}
                  >
                    {detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* La flèche du lien, seulement là où il y a deux colonnes. */}
        <div className="hidden lg:flex lg:items-center lg:justify-center">
          <ArrowRight className="h-6 w-6" style={{ color: "var(--primary)", opacity: 0.55 }} />
        </div>

        {/* Le ticket flotte à peine : de quoi suggérer qu'il vient de
            sortir, sans que rien ne bouge vraiment sous l'oeil. */}
        <div className="ticket-flottant">
          <style>{`
            @keyframes st-flotter {
              0%, 100% { transform: translateY(0) rotate(0.4deg); }
              50%      { transform: translateY(-8px) rotate(0.4deg); }
            }
            .ticket-flottant { animation: st-flotter 7s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) {
              .ticket-flottant { animation: none; transform: none; }
            }
          `}</style>
          <TicketImprime largeurMax={340} />
        </div>
      </div>
    </div>
  </section>
);
