import React from "react";

/**
 * Les six objets dont parle le registre, dessinés.
 *
 * Ce sont des reproductions, pas des captures d'écran : elles restent
 * nettes à toutes les tailles, suivent la palette du papier, et ne
 * vieillissent pas à la première refonte d'un écran. Une capture aurait
 * aussi montré des données réelles d'une boutique, ce qu'on ne met pas
 * sur une page publique.
 *
 * Sur téléphone, chacune s'élargit à près de neuf dixièmes de la
 * colonne : à la largeur pensée pour deux colonnes, elles y paraissaient
 * des timbres perdus dans la marge.
 *
 * Chacune a sa propre forme — étiquette, page de carnet, fiche, ruban,
 * ticket, barres. Six vignettes de même gabarit auraient reconstitué la
 * grille de cartes qu'on vient justement d'abandonner ; c'est la variété
 * des objets qui dit la variété du travail couvert.
 */

// L'enveloppe suit la largeur disponible sur téléphone : dimensionnée au
// contenu, elle laissait l'étiquette de stock plus étroite que ses voisines.
const encadre = "relative w-full sm:w-auto";

/** 1. Stock : une étiquette de rayon, avec son seuil d'alerte. */
export const EtiquetteStock: React.FC = () => (
  <div className={encadre}>
    <div
      className="w-full max-w-[19rem] sm:max-w-[240px] rounded-r-md border-l-4 px-4 py-3 font-mono"
      style={{
        background: "var(--papier)",
        borderColor: "var(--carbone)",
        boxShadow: "0 10px 24px -18px rgba(28,27,24,.5)",
      }}
    >
      <p className="text-[10px]" style={{ color: "var(--carbone-doux)" }}>
        RAYON 3 · P001
      </p>
      <p className="mt-1 text-[15px] font-bold">Riz 25 kg</p>
      <div
        className="mt-3 flex items-baseline justify-between border-t border-dashed pt-2"
        style={{ borderColor: "var(--reglure)" }}
      >
        <span className="text-[11px]" style={{ color: "var(--carbone-doux)" }}>
          en stock
        </span>
        <span className="text-[22px] font-bold leading-none">3</span>
      </div>
      <p className="mt-2 text-[10px] font-semibold" style={{ color: "#9a5b12" }}>
        sous le seuil de 5 — à réapprovisionner
      </p>
    </div>
  </div>
);

/** 2. Ventes du jour : une page de carnet, à colonnes. */
export const PageCarnet: React.FC = () => (
  <div
    className="w-full max-w-[19rem] sm:max-w-[260px] px-4 py-3 font-mono text-[11px]"
    style={{
      background: "var(--papier)",
      backgroundImage:
        "repeating-linear-gradient(to bottom, transparent 0 21px, var(--reglure) 21px 22px)",
      boxShadow: "0 10px 24px -18px rgba(28,27,24,.5)",
    }}
  >
    <p className="mb-1 text-[10px]" style={{ color: "var(--carbone-doux)" }}>
      Samedi 6
    </p>
    {[
      ["Huile 5 L", "50 000"],
      ["Savon 200 g", "12 000"],
      ["Eau 1,5 L", "6 000"],
      ["Huile 5 L", "25 000"],
    ].map(([a, b], i) => (
      <div
        key={i}
        className="flex h-[22px] items-baseline justify-between"
        style={{ color: "var(--encre)" }}
      >
        <span>{a}</span>
        <span>{b}</span>
      </div>
    ))}
    <div
      className="flex h-[22px] items-baseline justify-between font-bold"
      style={{ color: "var(--carbone)" }}
    >
      <span>Total</span>
      <span>93 000 Ar</span>
    </div>
  </div>
);

/** 3. Clients : une fiche cartonnée, avec son solde. */
export const FicheClient: React.FC = () => (
  <div
    className="w-full max-w-[19rem] sm:max-w-[250px] px-4 py-4"
    style={{
      background: "var(--papier)",
      border: "1px solid var(--reglure)",
      boxShadow: "0 10px 24px -18px rgba(28,27,24,.5)",
    }}
  >
    <p className="text-[15px] font-semibold">Tiana R.</p>
    <p className="mt-0.5 text-[11px]" style={{ color: "var(--carbone-doux)" }}>
      cliente depuis mars
    </p>
    <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--reglure)" }}>
      <p className="font-mono text-[20px] font-bold leading-none">10 000 Ar</p>
      <p className="mt-1 text-[11px]" style={{ color: "var(--carbone-doux)" }}>
        reste à payer sur la vente V001
      </p>
    </div>
  </div>
);

/** 4. Commandes : un ruban d'étapes. */
export const RubanCommande: React.FC = () => {
  const etapes = ["Commandée", "Préparée", "Livrée"];
  const faites = 2;
  return (
    <div className="w-full max-w-[19rem] sm:max-w-[280px]">
      <div className="flex items-center">
        {etapes.map((e, i) => (
          <React.Fragment key={e}>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: i < faites ? "var(--primary)" : "var(--reglure)" }}
            />
            {i < etapes.length - 1 && (
              <span
                className="h-px flex-1"
                style={{ background: i < faites - 1 ? "var(--primary)" : "var(--reglure)" }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      <div
        className="mt-2 flex justify-between text-[10px]"
        style={{ color: "var(--carbone-doux)" }}
      >
        {etapes.map((e, i) => (
          <span
            key={e}
            style={i < faites ? { color: "var(--carbone)", fontWeight: 600 } : undefined}
          >
            {e}
          </span>
        ))}
      </div>
      <p className="mt-4 font-mono text-[12px]">CMD-014 · Tiana R.</p>
      <p className="text-[11px]" style={{ color: "var(--carbone-doux)" }}>
        3 articles — livraison prévue lundi
      </p>
    </div>
  );
};

/** 5. Ticket : le même objet que le héros, en petit et de travers. */
export const PetitTicket: React.FC = () => (
  <div className="w-full max-w-[19rem] sm:max-w-[190px] -rotate-2">
    <div
      className="px-3 pb-4 pt-3 font-mono text-[9px] leading-[1.6]"
      style={{ background: "var(--papier)", boxShadow: "0 12px 26px -18px rgba(28,27,24,.55)" }}
    >
      <p className="text-center text-[10px] font-bold">ÉPICERIE DU CENTRE</p>
      <div className="my-1.5 border-t border-dashed" style={{ borderColor: "var(--reglure)" }} />
      <div className="flex justify-between">
        <span>Huile 5 L</span>
        <span>50 000</span>
      </div>
      <div className="flex justify-between">
        <span>Savon 200 g</span>
        <span>12 000</span>
      </div>
      <div className="my-1.5 border-t border-dashed" style={{ borderColor: "var(--reglure)" }} />
      <div className="flex justify-between text-[11px] font-bold">
        <span>TOTAL</span>
        <span>62 000 Ar</span>
      </div>
    </div>
    <svg
      aria-hidden
      viewBox="0 0 190 7"
      preserveAspectRatio="none"
      className="block h-[7px] w-full"
    >
      <path
        d="M0 0 L9.5 7 L19 0 L28.5 7 L38 0 L47.5 7 L57 0 L66.5 7 L76 0 L85.5 7 L95 0 L104.5 7 L114 0 L123.5 7 L133 0 L142.5 7 L152 0 L161.5 7 L171 0 L180.5 7 L190 0 Z"
        fill="var(--papier)"
      />
    </svg>
  </div>
);

/** 6. Bilan : six mois en barres, sur une ligne de base. */
export const BarresBilan: React.FC = () => {
  const mois = [
    ["A", 42],
    ["M", 58],
    ["J", 51],
    ["Jt", 73],
    ["A", 66],
    ["S", 88],
  ] as const;
  return (
    <div className="w-full max-w-[19rem] sm:max-w-[240px]">
      <p className="font-mono text-[19px] font-bold leading-none">2 480 000 Ar</p>
      <p className="mt-1 text-[11px]" style={{ color: "var(--carbone-doux)" }}>
        chiffre d&apos;affaires, six derniers mois
      </p>
      {/* Les barres sont les enfants DIRECTS de la rangée à hauteur
          fixe : une hauteur en pourcentage ne se résout que contre un
          parent dont la hauteur est définie. Enfermées dans une colonne
          intermédiaire à hauteur automatique, elles valaient zéro pixel
          et le graphique ne se voyait pas. */}
      <div className="mt-4">
        <div className="flex h-[64px] items-end gap-2">
          {mois.map(([, h], i) => (
            <span
              key={i}
              className="flex-1 rounded-t-[2px]"
              style={{
                height: `${h}%`,
                background: i === mois.length - 1 ? "var(--primary)" : "var(--reglure)",
              }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex gap-2">
          {mois.map(([m], i) => (
            <span
              key={i}
              className="flex-1 text-center text-[9px]"
              style={{ color: "var(--carbone-doux)" }}
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
