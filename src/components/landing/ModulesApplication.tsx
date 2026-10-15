import React from "react";
import { BarChart3, Boxes, ListChecks, Settings, ShoppingCart, Users, Wallet } from "lucide-react";
import { GROUPES_ECRANS } from "./ecrans";
import { Revele } from "./Revele";

/**
 * Tous les écrans livrés, rangés par groupe.
 *
 * La visite guidée montre le travail quotidien ; cette grille dit
 * l'étendue. Chaque écran porte le libellé exact du menu — le visiteur
 * retrouvera ces mots une fois entré — et une phrase sur ce qu'il fait.
 */

const ICONES: Record<string, React.ElementType> = {
  Pilotage: BarChart3,
  Organisation: ListChecks,
  Ventes: ShoppingCart,
  Stock: Boxes,
  Finance: Wallet,
  Équipe: Users,
  Réglages: Settings,
};

const total = GROUPES_ECRANS.reduce((n, g) => n + g.ecrans.length, 0);

export const ModulesApplication: React.FC = () => (
  <section id="modules" className="reglure relative scroll-mt-16 px-5 py-20 sm:py-28">
    <div className="mx-auto max-w-6xl">
      <Revele>
        <span
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold"
          style={{
            background: "color-mix(in srgb, var(--terre) 12%, transparent)",
            color: "var(--terre)",
          }}
        >
          {total} écrans, un seul logiciel
        </span>
        <h2 className="titre-section mt-6 max-w-[20ch] text-[clamp(1.8rem,5vw,2.9rem)] font-bold leading-[1.1] tracking-tight">
          Tout ce qu'il y a dedans
        </h2>
        <p
          className="mt-5 max-w-[54ch] text-[1.0625rem] leading-relaxed"
          style={{ color: "var(--carbone-doux)" }}
        >
          De la caisse à la paie, chaque écran a sa place dans le menu. Vous n'activez que ce qui
          vous sert ; le reste attend sans encombrer.
        </p>
      </Revele>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {GROUPES_ECRANS.map((groupe, i) => {
          const Icone = ICONES[groupe.titre] ?? BarChart3;
          return (
            <Revele key={groupe.titre} delai={(i % 3) * 70}>
              <div
                className="h-full rounded-3xl border bg-white p-6"
                style={{
                  borderColor: "var(--reglure)",
                  boxShadow: "0 14px 34px -26px rgba(28,27,24,.5)",
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-11 w-11 place-items-center rounded-2xl"
                    style={{
                      background: "color-mix(in srgb, var(--primary) 13%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    <Icone className="h-5 w-5" />
                  </span>
                  <span>
                    <span
                      className="block text-[1.05rem] font-bold"
                      style={{ color: "var(--carbone)" }}
                    >
                      {groupe.titre}
                    </span>
                    <span className="block text-[0.78rem]" style={{ color: "var(--carbone-doux)" }}>
                      {groupe.ecrans.length} écran{groupe.ecrans.length > 1 ? "s" : ""}
                    </span>
                  </span>
                </div>
                <ul className="mt-5 space-y-3">
                  {groupe.ecrans.map((e) => (
                    <li key={e.nom} className="flex gap-2.5">
                      <span
                        className="mt-[0.45rem] h-1.5 w-1.5 flex-none rounded-full"
                        style={{ background: "var(--primary)" }}
                      />
                      <span className="text-[0.9rem] leading-snug">
                        <span className="font-semibold" style={{ color: "var(--carbone)" }}>
                          {e.nom}
                        </span>
                        <span style={{ color: "var(--carbone-doux)" }}> — {e.quoi}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Revele>
          );
        })}
      </div>
    </div>
  </section>
);
