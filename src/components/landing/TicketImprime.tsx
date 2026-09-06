import React from "react";
import { APP_NAME } from "../../lib/appConfig";

/** Une ligne du ticket, imprimée à son tour. */
const LIGNES: Array<{
  gauche: string;
  droite?: string;
  genre?: "titre" | "total" | "filet" | "pied";
}> = [
  { gauche: "BOUTIQUE DE KANTO", genre: "titre" },
  { gauche: "Lot IVG 124, Antananarivo" },
  { gauche: "", genre: "filet" },
  { gauche: "Reçu", droite: "V001" },
  { gauche: "Date", droite: "06/09/2026" },
  { gauche: "Vendeur", droite: "Kanto" },
  { gauche: "", genre: "filet" },
  { gauche: "Menaka", droite: "50 000 Ar" },
  { gauche: "2 × 25 000 Ar" },
  { gauche: "Savon Kely", droite: "12 000 Ar" },
  { gauche: "3 × 4 000 Ar" },
  { gauche: "", genre: "filet" },
  { gauche: "TOTAL", droite: "62 000 Ar", genre: "total" },
  { gauche: "Payé", droite: "62 000 Ar" },
  { gauche: "", genre: "filet" },
  { gauche: "Merci pour votre confiance", genre: "pied" },
];

/**
 * Le ticket, qui s'imprime ligne à ligne au chargement.
 *
 * C'est l'objet le plus caractéristique du produit : ce qu'il fabrique
 * et ce que le commerçant tend à son client. Il tient donc lieu de héros,
 * à la place d'un nom posé sur un dégradé.
 *
 * L'impression est le seul mouvement non sollicité de la page. Une
 * séquence unique retient mieux l'attention qu'une apparition sur chaque
 * bloc — et celle-ci dit quelque chose du produit, au lieu de meubler.
 * Chaque ligne est dévoilée par un rideau qui descend, comme le papier
 * sort d'une thermique ; le rythme est légèrement irrégulier, une
 * imprimante ne cadence pas au métronome.
 *
 * Sans animation demandée, le ticket est simplement là, entier.
 */
export const TicketImprime: React.FC = () => (
  <div className="ticket-impression relative mx-auto w-full max-w-[300px]">
    <style>{`
      @keyframes ti-sortir {
        from { clip-path: inset(0 0 100% 0); opacity: .4; }
        to   { clip-path: inset(0 0 0 0);    opacity: 1; }
      }
      @keyframes ti-poser {
        from { transform: translateY(-6px); }
        to   { transform: translateY(0); }
      }
      .ticket-impression .ti-ligne {
        animation: ti-sortir .22s ease-out backwards;
        animation-delay: calc(var(--rang) * 105ms + 250ms);
      }
      .ticket-impression .ti-feuille { animation: ti-poser .5s ease-out both; }

      @media (prefers-reduced-motion: reduce) {
        .ticket-impression .ti-ligne,
        .ticket-impression .ti-feuille { animation: none; }
      }
    `}</style>

    <div
      className="ti-feuille relative px-5 pb-7 pt-6 font-mono text-[11px] leading-[1.55]"
      style={{ background: "var(--papier)", boxShadow: "0 18px 40px -24px rgba(28,27,24,.45)" }}
    >
      {LIGNES.map((l, i) => (
        <div key={i} className="ti-ligne" style={{ ["--rang" as string]: i }}>
          {l.genre === "filet" ? (
            <div
              className="my-2 border-t border-dashed"
              style={{ borderColor: "var(--reglure)" }}
            />
          ) : l.genre === "titre" ? (
            <p className="text-center text-[12px] font-bold tracking-wide">{l.gauche}</p>
          ) : l.genre === "pied" ? (
            <p className="text-center text-[10px] italic" style={{ color: "var(--carbone-doux)" }}>
              {l.gauche}
            </p>
          ) : (
            <div
              className={`flex items-baseline justify-between gap-3 ${
                l.genre === "total" ? "text-[13px] font-bold" : ""
              }`}
              style={l.droite ? undefined : { color: "var(--carbone-doux)" }}
            >
              <span className="min-w-0">{l.gauche}</span>
              {l.droite && <span className="whitespace-nowrap">{l.droite}</span>}
            </div>
          )}
        </div>
      ))}

      <p
        className="ti-ligne mt-4 text-center text-[9px]"
        style={{ ["--rang" as string]: LIGNES.length, color: "var(--carbone-doux)" }}
      >
        Émis par {APP_NAME}
      </p>
    </div>

    {/* Le bord déchiré, à l'endroit où l'on coupe le rouleau. */}
    <svg
      aria-hidden
      viewBox="0 0 300 10"
      preserveAspectRatio="none"
      className="block h-[10px] w-full"
      style={{ filter: "drop-shadow(0 6px 10px rgba(28,27,24,.18))" }}
    >
      <path
        d="M0 0 L10 10 L20 0 L30 10 L40 0 L50 10 L60 0 L70 10 L80 0 L90 10 L100 0 L110 10 L120 0 L130 10 L140 0 L150 10 L160 0 L170 10 L180 0 L190 10 L200 0 L210 10 L220 0 L230 10 L240 0 L250 10 L260 0 L270 10 L280 0 L290 10 L300 0 L300 0 L0 0 Z"
        fill="var(--papier)"
      />
    </svg>
  </div>
);
