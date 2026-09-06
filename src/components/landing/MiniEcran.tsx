import React from "react";

/**
 * L'aperçu miniature d'un écran de l'application.
 *
 * Les six bandes illustrées plus haut sont des objets distincts, chacun
 * avec sa forme propre. Ici, c'est un catalogue : vingt et une entrées
 * d'une même liste. Elles partagent donc un gabarit, parce qu'une liste
 * doit se lire comme une liste — la variété tient à ce que chaque
 * miniature montre, pas à sa découpe.
 *
 * Ces aperçus portent des mots et des chiffres réels plutôt que des
 * rectangles gris. Un gabarit de blocs vides ressemble à un écran en
 * cours de chargement ; on n'y lit rien, et l'oeil apprend à l'ignorer.
 */
export type Rangee =
  | { type: "paire"; g: string; d: string; fort?: boolean }
  | { type: "barres"; v: number[] }
  | { type: "puces"; p: readonly string[] }
  | { type: "jauge"; pct: number; libelle: string }
  | { type: "points"; n: number; remplis: number; libelle: string }
  | { type: "bascules"; libelles: readonly string[]; actives: number }
  | { type: "texte"; t: string; sourdine?: boolean };

const Rangee: React.FC<{ r: Rangee }> = ({ r }) => {
  switch (r.type) {
    case "paire":
      return (
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate" style={{ color: "var(--carbone-doux)" }}>
            {r.g}
          </span>
          <span className={`shrink-0 font-mono ${r.fort ? "font-bold" : ""}`}>{r.d}</span>
        </div>
      );
    case "barres":
      return (
        <div className="flex h-[22px] items-end gap-[3px]">
          {r.v.map((h, i) => (
            <span
              key={i}
              className="flex-1"
              style={{
                height: `${h}%`,
                background: i === r.v.length - 1 ? "var(--primary)" : "var(--reglure)",
              }}
            />
          ))}
        </div>
      );
    case "puces":
      return (
        <div className="flex flex-wrap gap-1">
          {r.p.map((t) => (
            <span
              key={t}
              className="rounded-full border px-1.5 py-px text-[7px]"
              style={{ borderColor: "var(--reglure)", color: "var(--carbone-doux)" }}
            >
              {t}
            </span>
          ))}
        </div>
      );
    case "jauge":
      return (
        <div>
          <div className="h-[3px] w-full" style={{ background: "var(--reglure)" }}>
            <div className="h-full" style={{ width: `${r.pct}%`, background: "var(--primary)" }} />
          </div>
          <p className="mt-1 text-[7px]" style={{ color: "var(--carbone-doux)" }}>
            {r.libelle}
          </p>
        </div>
      );
    case "points":
      return (
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            {Array.from({ length: r.n }, (_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: i < r.remplis ? "var(--carbone)" : "var(--reglure)" }}
              />
            ))}
          </span>
          <span className="text-[7px]" style={{ color: "var(--carbone-doux)" }}>
            {r.libelle}
          </span>
        </div>
      );
    case "bascules":
      return (
        <div className="space-y-1">
          {r.libelles.map((t, i) => (
            <div key={t} className="flex items-center justify-between gap-2">
              <span className="truncate" style={{ color: "var(--carbone-doux)" }}>
                {t}
              </span>
              <span
                className="flex h-2 w-4 shrink-0 items-center rounded-full px-px"
                style={{ background: i < r.actives ? "var(--primary)" : "var(--reglure)" }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-white"
                  style={{ marginLeft: i < r.actives ? "auto" : 0 }}
                />
              </span>
            </div>
          ))}
        </div>
      );
    case "texte":
      return (
        <p className="truncate" style={{ color: r.sourdine ? "var(--carbone-doux)" : undefined }}>
          {r.t}
        </p>
      );
  }
};

export const MiniEcran: React.FC<{ titre: string; rangees: readonly Rangee[] }> = ({
  titre,
  rangees,
}) => (
  <div
    className="flex h-[86px] w-[118px] shrink-0 flex-col overflow-hidden rounded-[3px] text-[8px] leading-[1.5]"
    style={{ background: "var(--papier)", border: "1px solid var(--reglure)" }}
    aria-hidden
  >
    <div
      className="shrink-0 truncate px-2 py-1 font-mono text-[7px] font-bold tracking-wide"
      style={{ borderBottom: "1px solid var(--reglure)", color: "var(--carbone-doux)" }}
    >
      {titre}
    </div>
    <div className="flex flex-1 flex-col justify-center gap-1 px-2 py-1.5">
      {rangees.map((r, i) => (
        <Rangee key={i} r={r} />
      ))}
    </div>
  </div>
);
