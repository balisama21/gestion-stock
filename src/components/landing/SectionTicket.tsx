import React from "react";
import { ArrowRight, FileText, ImageIcon, Printer, Zap } from "lucide-react";
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

const FORMATS = [
  { icone: Printer, titre: "58 / 80 mm", detail: "Ticket thermique" },
  { icone: FileText, titre: "PDF", detail: "Facture A4" },
  { icone: ImageIcon, titre: "Image", detail: "Par message" },
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
              background: "color-mix(in srgb, var(--primary) 10%, transparent)",
              color: "var(--primary)",
            }}
          >
            <Zap className="h-3.5 w-3.5" />
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

          <ul className="mt-9 flex flex-wrap gap-3">
            {FORMATS.map(({ icone: Icone, titre, detail }) => (
              <li
                key={titre}
                className="flex items-center gap-3 rounded-xl px-4 py-3 transition-transform duration-300 hover:-translate-y-0.5"
                style={{
                  background: "var(--papier)",
                  border: "1px solid var(--reglure)",
                  boxShadow: "0 10px 22px -18px rgba(28,27,24,.35)",
                }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  <Icone className="h-4 w-4" />
                </span>
                <span className="leading-tight">
                  <span
                    className="block text-[0.9375rem] font-semibold"
                    style={{ color: "var(--carbone)" }}
                  >
                    {titre}
                  </span>
                  <span className="block text-[0.8125rem]" style={{ color: "var(--carbone-doux)" }}>
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
