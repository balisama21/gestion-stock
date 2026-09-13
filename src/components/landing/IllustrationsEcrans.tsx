import React from "react";

/**
 * Un objet dessiné pour chacun des vingt-neuf écrans.
 *
 * ── Pourquoi vingt-neuf formes et non un gabarit répété ──
 *
 * L'inventaire montrait ses écrans dans une même petite fenêtre, ce qui
 * se lit vite mais ne dit rien : vingt-neuf rectangles identiques
 * ressemblent à vingt-neuf fois la même chose. Ici chaque écran a son
 * objet, comme les huit bandes du registre plus haut — un cahier pour
 * l'agenda, un colis pour les livraisons, un cadenas pour la sécurité.
 * On reconnaît l'écran avant d'avoir lu son nom.
 *
 * ── La discipline de dessin ──
 *
 * À cette taille, le détail se perd : ce qui porte, c'est la SILHOUETTE
 * et une ou deux marques fortes. Chaque objet a donc un contour qui lui
 * est propre — coin plié, bord déchiré, spirale, disque, enveloppe — et
 * renonce au reste. Un objet qui demanderait qu'on s'approche pour le
 * reconnaître aurait manqué son but.
 *
 * Tout est en traits et en aplats, sans une image à télécharger : ces
 * dessins restent nets à toutes les tailles, suivent la palette du
 * papier, et ne vieillissent pas à la première refonte d'un écran. Une
 * capture d'écran aurait aussi montré les données réelles d'une
 * boutique, ce qu'on ne met pas sur une page publique.
 *
 * ── La palette ──
 *
 * Papier, encre noire, gris doux, réglure. Le brun `--terre` ne sert
 * qu'au bois d'un crayon et au carton d'un colis ; le vert de marque
 * ne marque que ce qui est fait, atteint ou actif. Aucun objet n'est
 * colorié pour décorer.
 */

/* ─────────── Les mesures communes ───────────
   Chaque objet se dessine dans la même boîte : les fiches de
   l'inventaire s'alignent, mais ce qui est posé dedans diffère. */
const BOITE = "relative flex h-[88px] w-[132px] items-center justify-center";

const papier: React.CSSProperties = {
  background: "var(--papier)",
  border: "1px solid var(--reglure)",
};

/** L'ombre portée des objets du registre, reprise à l'identique. */
const ombre = "0 8px 18px -14px rgba(28,27,24,.55)";

/** Une ligne de texte simulée : un trait, pas un faux mot. */
const Ligne: React.FC<{ l: number; fort?: boolean; vert?: boolean }> = ({ l, fort, vert }) => (
  <span
    className="block rounded-full"
    style={{
      width: `${l}%`,
      height: fort ? 3 : 2,
      background: vert ? "var(--primary)" : fort ? "var(--carbone)" : "var(--reglure)",
    }}
  />
);

// ═══════════════════════ PILOTAGE ═══════════════════════

/** Tableau de bord : l'ardoise du jour, où l'on écrit le chiffre à la craie. */
export const IllTableauBord: React.FC = () => (
  <div className={BOITE}>
    <div
      className="flex h-[74px] w-[112px] flex-col justify-between rounded-[4px] px-3 py-2.5"
      style={{ background: "var(--carbone)", boxShadow: ombre }}
    >
      <span className="font-mono text-[8px]" style={{ color: "var(--papier)", opacity: 0.6 }}>
        AUJOURD’HUI
      </span>
      <span className="font-mono text-[15px] font-bold" style={{ color: "var(--papier)" }}>
        412 000
      </span>
      <span className="flex h-[14px] items-end gap-[3px]">
        {[40, 62, 48, 75, 92].map((h, i) => (
          <span
            key={i}
            className="w-[6px] rounded-[1px]"
            style={{
              height: `${h}%`,
              background: i === 4 ? "var(--primary)" : "var(--papier)",
              opacity: i === 4 ? 1 : 0.35,
            }}
          />
        ))}
      </span>
    </div>
  </div>
);

/** Bilan : le grand livre ouvert, ses deux pages et sa reliure au milieu. */
export const IllBilan: React.FC = () => (
  <div className={BOITE}>
    <div className="flex h-[76px] w-[124px]" style={{ boxShadow: ombre }}>
      {[0, 1].map((page) => (
        <div
          key={page}
          className="flex flex-1 flex-col gap-[5px] px-2.5 py-3"
          style={{
            ...papier,
            borderRight: page === 0 ? "none" : undefined,
            borderLeft: page === 1 ? "1px solid var(--carbone)" : undefined,
          }}
        >
          {[82, 60, 70, 45].map((l, i) => (
            <Ligne key={i} l={l} vert={page === 1 && i === 3} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/** Historique : la bande de journal, déchirée en haut, datée en descendant. */
export const IllHistorique: React.FC = () => (
  <div className={BOITE}>
    <div
      className="w-[88px] px-2.5 pb-3 pt-2"
      style={{
        ...papier,
        borderTop: "none",
        boxShadow: ombre,
        // Le bord déchiré : une bande dentelée plutôt qu'un trait net.
        clipPath:
          "polygon(0 6px, 8% 0, 18% 6px, 30% 1px, 42% 6px, 55% 0, 67% 6px, 80% 1px, 92% 6px, 100% 0, 100% 100%, 0 100%)",
      }}
    >
      {["06/09", "06/09", "05/09"].map((d, i) => (
        <div key={d + i} className="mt-2 flex items-center gap-2">
          <span className="font-mono text-[7px]" style={{ color: "var(--carbone-doux)" }}>
            {d}
          </span>
          <Ligne l={i === 0 ? 70 : 48} fort={i === 0} />
        </div>
      ))}
    </div>
  </div>
);

/** Statistiques : le disque et la part qu'on en détache. */
export const IllStatistiques: React.FC = () => (
  <div className={BOITE}>
    <div className="relative h-[70px] w-[70px]">
      <div
        className="absolute inset-0 rounded-full"
        style={{ border: "2px solid var(--reglure)", background: "var(--papier)", boxShadow: ombre }}
      />
      {/* La part détachée, légèrement écartée du disque. */}
      <div
        className="absolute h-[34px] w-[34px]"
        style={{
          top: 1,
          left: 36,
          background: "var(--primary)",
          borderTopRightRadius: "34px",
          transform: "translate(3px,-3px)",
        }}
      />
      <span
        className="absolute font-mono text-[9px] font-bold"
        style={{ bottom: 14, left: 12, color: "var(--carbone)" }}
      >
        38 %
      </span>
    </div>
  </div>
);

// ═══════════════════════ ORGANISATION ═══════════════════════

/** Vue d'ensemble : le panneau de liège et ses papiers épinglés. */
export const IllVueEnsemble: React.FC = () => (
  <div className={BOITE}>
    <div
      className="relative h-[78px] w-[118px] rounded-[3px]"
      style={{ background: "color-mix(in srgb, var(--terre) 14%, var(--papier))", boxShadow: ombre }}
    >
      {[
        { t: 6, l: 8, r: -4, w: 40, h: 30 },
        { t: 12, l: 52, r: 5, w: 44, h: 26 },
        { t: 42, l: 22, r: -2, w: 46, h: 28 },
      ].map((p, i) => (
        <div
          key={i}
          className="absolute flex flex-col justify-center gap-[3px] px-1.5"
          style={{
            top: p.t,
            left: p.l,
            width: p.w,
            height: p.h,
            ...papier,
            transform: `rotate(${p.r}deg)`,
          }}
        >
          <Ligne l={80} fort={i === 0} vert={i === 1} />
          <Ligne l={55} />
          {/* La punaise. */}
          <span
            className="absolute left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full"
            style={{ top: -2, background: "var(--carbone)" }}
          />
        </div>
      ))}
    </div>
  </div>
);

/** Tâches : le pense-bête collé, avec son coin qui se relève. */
export const IllTaches: React.FC = () => (
  <div className={BOITE}>
    <div
      className="relative flex h-[76px] w-[76px] flex-col justify-center gap-2 px-3"
      style={{
        background: "color-mix(in srgb, var(--primary) 10%, var(--papier))",
        boxShadow: ombre,
        // Le coin inférieur droit relevé, comme un papier qui se décolle.
        clipPath: "polygon(0 0, 100% 0, 100% 76%, 76% 100%, 0 100%)",
      }}
    >
      {[true, true, false].map((fait, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span
            className="flex h-[9px] w-[9px] shrink-0 items-center justify-center rounded-[2px]"
            style={{
              border: `1px solid ${fait ? "var(--primary)" : "var(--carbone-doux)"}`,
              background: fait ? "var(--primary)" : "transparent",
            }}
          >
            {fait && (
              <svg viewBox="0 0 10 10" className="h-[6px] w-[6px]" fill="none" stroke="var(--papier)" strokeWidth="2.4">
                <path d="M1.5 5 L4 7.5 L8.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span
            className="h-[2px] flex-1 rounded-full"
            style={{ background: fait ? "var(--reglure)" : "var(--carbone)" }}
          />
        </span>
      ))}
    </div>
  </div>
);

/**
 * Agenda : le cahier à spirale, et le crayon posé à côté.
 *
 * C'est l'objet qu'on garde ouvert sur le comptoir pour noter un
 * rendez-vous — le crayon à côté dit qu'on y écrit encore.
 */
export const IllAgenda: React.FC = () => (
  <div className={BOITE}>
    <div className="relative flex items-center gap-2">
      <div className="relative pl-3">
        {/* La spirale : six anneaux qui mordent sur le bord gauche. */}
        <span className="absolute left-0 top-2 flex flex-col gap-[7px]">
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              className="block h-[6px] w-[10px] rounded-full"
              style={{ border: "1.5px solid var(--carbone-doux)", borderTopColor: "transparent" }}
            />
          ))}
        </span>
        <div
          className="flex h-[78px] w-[82px] flex-col gap-[7px] px-2.5 py-3"
          style={{ ...papier, boxShadow: ombre }}
        >
          <span className="font-mono text-[7px]" style={{ color: "var(--carbone-doux)" }}>
            JEU 12
          </span>
          {[72, 88, 60].map((l, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span
                className="h-[4px] w-[4px] shrink-0 rounded-full"
                style={{ background: i === 0 ? "var(--primary)" : "var(--reglure)" }}
              />
              <Ligne l={l} fort={i === 0} />
            </span>
          ))}
        </div>
      </div>

      {/* Le crayon, incliné, taillé vers le bas. */}
      <span className="relative block h-[62px] w-[9px]" style={{ transform: "rotate(9deg)" }}>
        <span
          className="absolute inset-x-0 top-0 rounded-t-[2px]"
          style={{ height: 46, background: "var(--terre)" }}
        />
        <span
          className="absolute inset-x-0"
          style={{
            top: 46,
            height: 10,
            background: "color-mix(in srgb, var(--terre) 45%, var(--papier))",
            clipPath: "polygon(0 0, 100% 0, 50% 100%)",
          }}
        />
        <span
          className="absolute left-1/2 h-[4px] w-[4px] -translate-x-1/2"
          style={{ top: 54, background: "var(--carbone)", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
        />
      </span>
    </div>
  </div>
);

/** Rappels : le réveil, ses deux cloches et l'heure qui approche. */
export const IllRappels: React.FC = () => (
  <div className={BOITE}>
    <div className="relative">
      {/* Les deux cloches, posées derrière le cadran. */}
      {[-1, 1].map((cote) => (
        <span
          key={cote}
          className="absolute h-[16px] w-[16px] rounded-full"
          style={{
            top: -2,
            left: cote === -1 ? 2 : 50,
            border: "2px solid var(--carbone-doux)",
            background: "var(--papier)",
          }}
        />
      ))}
      <div
        className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full"
        style={{ ...papier, borderWidth: 2, borderColor: "var(--carbone)", boxShadow: ombre }}
      >
        {/* Les aiguilles : une longue vers le haut, une courte vers la droite. */}
        <span
          className="absolute"
          style={{ width: 2, height: 20, background: "var(--carbone)", transform: "translateY(-10px)" }}
        />
        <span
          className="absolute"
          style={{ width: 15, height: 2, background: "var(--primary)", transform: "translateX(7px)" }}
        />
        <span
          className="absolute h-[5px] w-[5px] rounded-full"
          style={{ background: "var(--carbone)" }}
        />
      </div>
      {/* Les deux pieds. */}
      {[-1, 1].map((cote) => (
        <span
          key={cote}
          className="absolute h-[7px] w-[3px] rounded-b"
          style={{ bottom: -5, left: cote === -1 ? 14 : 51, background: "var(--carbone-doux)" }}
        />
      ))}
    </div>
  </div>
);

// ═══════════════════════ VENTES ═══════════════════════

/** Ventes : les billets, en éventail, comme on les compte le soir. */
export const IllVentes: React.FC = () => (
  <div className={BOITE}>
    <div className="relative h-[72px] w-[110px]">
      {[-9, -3, 4].map((r, i) => (
        <div
          key={i}
          className="absolute flex h-[44px] w-[90px] items-center justify-center rounded-[3px]"
          style={{
            top: 12 + i * 4,
            left: 6 + i * 3,
            ...papier,
            transform: `rotate(${r}deg)`,
            boxShadow: ombre,
          }}
        >
          <span
            className="h-[18px] w-[18px] rounded-full"
            style={{ border: "1.5px solid var(--reglure)" }}
          />
          {i === 2 && (
            <span className="absolute right-2.5 font-mono text-[9px] font-bold">10 000</span>
          )}
        </div>
      ))}
    </div>
  </div>
);

/** Commandes : le bon, son numéro, et l'agrafe qui tient le double. */
export const IllCommandes: React.FC = () => (
  <div className={BOITE}>
    <div className="relative">
      {/* Le double, qui dépasse derrière. */}
      <div
        className="absolute h-[74px] w-[86px] rounded-[2px]"
        style={{ ...papier, top: 4, left: 5, transform: "rotate(3deg)" }}
      />
      <div
        className="relative flex h-[74px] w-[86px] flex-col gap-[6px] px-2.5 py-3"
        style={{ ...papier, boxShadow: ombre }}
      >
        <span className="font-mono text-[8px] font-bold">CMD-014</span>
        <span className="h-px w-full" style={{ background: "var(--reglure)" }} />
        {[70, 55].map((l, i) => (
          <Ligne key={i} l={l} />
        ))}
        <span className="mt-auto h-[3px] w-full rounded-full" style={{ background: "var(--reglure)" }}>
          <span
            className="block h-full rounded-full"
            style={{ width: "66%", background: "var(--primary)" }}
          />
        </span>
      </div>
      {/* L'agrafe, en haut à gauche. */}
      <span
        className="absolute h-[10px] w-[10px]"
        style={{
          top: -2,
          left: -2,
          borderTop: "2px solid var(--carbone-doux)",
          borderLeft: "2px solid var(--carbone-doux)",
          transform: "rotate(-45deg)",
        }}
      />
    </div>
  </div>
);

/** Clients : le carnet d'adresses et ses onglets alphabétiques. */
export const IllClients: React.FC = () => (
  <div className={BOITE}>
    <div className="relative">
      <div
        className="flex h-[76px] w-[94px] flex-col gap-[9px] px-3 py-3.5"
        style={{ ...papier, boxShadow: ombre }}
      >
        {[82, 64, 74].map((n, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span
              className="h-[10px] w-[10px] shrink-0 rounded-full"
              style={{ border: "1.5px solid var(--reglure)" }}
            />
            <span className="flex-1">
              <Ligne l={n} fort={i === 0} />
            </span>
            <span
              className="h-[2px] w-[12px] shrink-0 rounded-full"
              style={{ background: i === 0 ? "var(--primary)" : "var(--reglure)" }}
            />
          </span>
        ))}
      </div>
      {/* Les onglets, sur la tranche droite. */}
      <span className="absolute right-[-7px] top-3 flex flex-col gap-[5px]">
        {["A", "M", "T"].map((l, i) => (
          <span
            key={l}
            className="flex h-[14px] w-[13px] items-center justify-center rounded-r-[3px] font-mono text-[6px]"
            style={{
              background: i === 1 ? "var(--primary)" : "var(--reglure)",
              color: i === 1 ? "var(--papier)" : "var(--carbone-doux)",
            }}
          >
            {l}
          </span>
        ))}
      </span>
    </div>
  </div>
);

/** Paiements à recevoir : le montant entouré au crayon, et la date qui court. */
export const IllPaiements: React.FC = () => (
  <div className={BOITE}>
    <div
      className="relative flex h-[68px] w-[102px] flex-col justify-center gap-2 px-3.5"
      style={{ ...papier, boxShadow: ombre, transform: "rotate(-2deg)" }}
    >
      <Ligne l={58} />
      <span className="relative inline-flex w-fit">
        <span className="font-mono text-[13px] font-bold">10 000</span>
        {/* Le trait de crayon autour du montant, tracé à main levée. */}
        <span
          aria-hidden
          className="absolute"
          style={{
            inset: "-5px -8px",
            border: "1.5px solid var(--carbone)",
            borderRadius: "50%",
            transform: "rotate(-4deg)",
            opacity: 0.75,
          }}
        />
      </span>
      <span className="font-mono text-[7px]" style={{ color: "var(--carbone-doux)" }}>
        depuis 12 jours
      </span>
    </div>
  </div>
);

/** Devis : la feuille, et le tampon qu'on y pose une fois accepté. */
export const IllDevis: React.FC = () => (
  <div className={BOITE}>
    <div className="relative">
      <div
        className="flex h-[80px] w-[74px] flex-col gap-[6px] px-2.5 py-3"
        style={{
          ...papier,
          boxShadow: ombre,
          // Le coin supérieur droit plié.
          clipPath: "polygon(0 0, 78% 0, 100% 20%, 100% 100%, 0 100%)",
        }}
      >
        <span className="font-mono text-[7px]" style={{ color: "var(--carbone-doux)" }}>
          DEV-007
        </span>
        {[76, 60, 68, 44].map((l, i) => (
          <Ligne key={i} l={l} />
        ))}
      </div>
      {/* Le tampon, posé de travers et à cheval sur le bord. */}
      <span
        className="absolute flex h-[36px] w-[36px] items-center justify-center rounded-full font-mono text-[6px] font-bold uppercase"
        style={{
          bottom: 2,
          right: -13,
          border: "2px solid var(--primary)",
          color: "var(--primary)",
          background: "color-mix(in srgb, var(--primary) 8%, var(--papier))",
          transform: "rotate(-14deg)",
        }}
      >
        Accepté
      </span>
    </div>
  </div>
);

/** Livraisons : le colis, sa bande adhésive et son étiquette. */
export const IllLivraisons: React.FC = () => (
  <div className={BOITE}>
    <div
      className="relative h-[68px] w-[84px] rounded-[3px]"
      style={{
        background: "color-mix(in srgb, var(--terre) 20%, var(--papier))",
        border: "1px solid color-mix(in srgb, var(--terre) 45%, var(--papier))",
        boxShadow: ombre,
      }}
    >
      {/* La bande adhésive verticale. */}
      <span
        className="absolute inset-y-0 left-1/2 w-[16px] -translate-x-1/2"
        style={{ background: "color-mix(in srgb, var(--terre) 36%, var(--papier))" }}
      />
      {/* L'étiquette d'expédition. */}
      <span
        className="absolute flex flex-col justify-center gap-[4px] px-1.5"
        style={{ top: 9, left: 7, width: 34, height: 26, ...papier }}
      >
        <Ligne l={80} fort />
        <Ligne l={55} />
      </span>
    </div>
  </div>
);

// ═══════════════════════ STOCK ═══════════════════════

/** Produits : le cageot, et ce qu'on y range. */
export const IllProduits: React.FC = () => (
  <div className={BOITE}>
    <div className="relative flex h-[72px] w-[94px] flex-col justify-end">
      {/* Les articles, qui dépassent du cageot. */}
      <span className="absolute inset-x-3 bottom-[30px] flex items-end justify-center gap-1.5">
        {[22, 30, 18].map((h, i) => (
          <span
            key={i}
            className="w-[16px] rounded-t-[2px]"
            style={{ height: h, ...papier, borderBottom: "none" }}
          />
        ))}
      </span>
      {/* Le cageot : sa planche du milieu et son contour. */}
      <div
        className="relative h-[34px] w-full"
        style={{
          background: "color-mix(in srgb, var(--terre) 16%, var(--papier))",
          border: "1.5px solid color-mix(in srgb, var(--terre) 48%, var(--papier))",
          boxShadow: ombre,
        }}
      >
        <span
          className="absolute inset-x-0 top-1/2 h-[1.5px]"
          style={{ background: "color-mix(in srgb, var(--terre) 48%, var(--papier))" }}
        />
      </div>
    </div>
  </div>
);

/** Achats : les bons de réception, empilés et agrafés ensemble. */
export const IllAchats: React.FC = () => (
  <div className={BOITE}>
    <div className="relative h-[74px] w-[96px]">
      {[8, 4, 0].map((d, i) => (
        <div
          key={i}
          className="absolute flex h-[62px] w-[78px] flex-col gap-[6px] px-2.5 py-2.5"
          style={{ top: d, left: d + 4, ...papier, boxShadow: i === 2 ? ombre : "none" }}
        >
          {i === 2 && (
            <>
              <span className="flex items-baseline justify-between">
                <span className="font-mono text-[7px]" style={{ color: "var(--carbone-doux)" }}>
                  A012
                </span>
                <span className="font-mono text-[9px] font-bold">300 000</span>
              </span>
              {[70, 52].map((l, j) => (
                <Ligne key={j} l={l} />
              ))}
            </>
          )}
        </div>
      ))}
      {/* L'agrafe qui traverse la pile. */}
      <span
        className="absolute h-[3px] w-[13px] rounded-[1px]"
        style={{ top: 6, left: 10, background: "var(--carbone-doux)", transform: "rotate(-38deg)" }}
      />
    </div>
  </div>
);

/** Alertes de rupture : le rayon qui s'est vidé, et la place restée libre. */
export const IllRupture: React.FC = () => (
  <div className={BOITE}>
    <div className="flex h-[74px] w-[96px] flex-col justify-end gap-[7px]">
      {[3, 1].map((restants, rangee) => (
        <div key={rangee}>
          <span className="flex h-[24px] items-end gap-[5px] px-1">
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className="h-full flex-1 rounded-t-[2px]"
                style={
                  i < restants
                    ? { ...papier, borderBottom: "none" }
                    : { border: "1px dashed var(--reglure)", borderBottom: "none" }
                }
              />
            ))}
          </span>
          {/* La planche de l'étagère. */}
          <span
            className="block h-[3px] w-full rounded-[1px]"
            style={{ background: rangee === 1 ? "var(--primary)" : "var(--carbone)" }}
          />
        </div>
      ))}
    </div>
  </div>
);

/** Fournisseurs : la carte de visite, coin corné, restée dans le tiroir. */
export const IllFournisseurs: React.FC = () => (
  <div className={BOITE}>
    <div
      className="relative flex h-[60px] w-[102px] flex-col justify-center gap-[7px] px-3.5"
      style={{
        ...papier,
        boxShadow: ombre,
        transform: "rotate(-3deg)",
        clipPath: "polygon(0 0, 100% 0, 100% 74%, 82% 100%, 0 100%)",
      }}
    >
      <span className="font-mono text-[9px] font-bold">Rasoa Grossiste</span>
      <Ligne l={64} />
      <span className="flex items-baseline justify-between pr-3">
        <span className="text-[7px]" style={{ color: "var(--carbone-doux)" }}>
          reste à payer
        </span>
        <span className="font-mono text-[9px] font-bold">340 000</span>
      </span>
    </div>
  </div>
);

/** Prestataires : l'outil posé en travers de la note du service rendu. */
export const IllPrestataires: React.FC = () => (
  <div className={BOITE}>
    <div className="relative">
      <div
        className="flex h-[68px] w-[84px] flex-col gap-[6px] px-2.5 py-3"
        style={{ ...papier, boxShadow: ombre }}
      >
        <span className="font-mono text-[7px]" style={{ color: "var(--carbone-doux)" }}>
          TRANSPORT
        </span>
        {[72, 54].map((l, i) => (
          <Ligne key={i} l={l} />
        ))}
        <span className="mt-auto font-mono text-[9px] font-bold">60 000</span>
      </div>
      {/* La clé plate, posée en travers de la note. */}
      <span className="absolute" style={{ bottom: 4, right: -13, transform: "rotate(-32deg)" }}>
        <span
          className="block h-[7px] w-[44px] rounded-[2px]"
          style={{ background: "var(--carbone-doux)" }}
        />
        {[0, 37].map((l) => (
          <span
            key={l}
            className="absolute h-[15px] w-[15px] rounded-full"
            style={{
              top: -4,
              left: l,
              border: "3.5px solid var(--carbone-doux)",
              background: "var(--papier-fond)",
            }}
          />
        ))}
      </span>
    </div>
  </div>
);

// ═══════════════════════ FINANCE ═══════════════════════

/** Capital : la cassette fermée, son cadran et sa fente. */
export const IllCapital: React.FC = () => (
  <div className={BOITE}>
    <div
      className="relative h-[68px] w-[92px] rounded-[4px]"
      style={{ ...papier, borderWidth: 2, borderColor: "var(--carbone)", boxShadow: ombre }}
    >
      {/* La ligne du couvercle. */}
      <span
        className="absolute inset-x-0 h-[2px]"
        style={{ top: 18, background: "var(--carbone)" }}
      />
      {/* Le cadran. */}
      <span
        className="absolute left-1/2 flex h-[24px] w-[24px] -translate-x-1/2 items-center justify-center rounded-full"
        style={{ top: 30, border: "2px solid var(--carbone)" }}
      >
        <span
          className="block h-[10px] w-[2px]"
          style={{ background: "var(--primary)", transform: "rotate(38deg)" }}
        />
      </span>
      {/* La poignée du couvercle. */}
      <span
        className="absolute left-1/2 h-[6px] w-[22px] -translate-x-1/2 rounded-t-full"
        style={{ top: -6, border: "2px solid var(--carbone)", borderBottom: "none" }}
      />
    </div>
  </div>
);

/** Dépenses : l'enveloppe d'où dépassent les tickets gardés. */
export const IllDepenses: React.FC = () => (
  <div className={BOITE}>
    <div className="relative h-[72px] w-[96px]">
      {/* Les tickets, qui dépassent par le haut. */}
      {[-7, 0, 6].map((r, i) => (
        <span
          key={i}
          className="absolute flex flex-col justify-center gap-[3px] px-1.5"
          style={{
            top: 2,
            left: 18 + i * 16,
            width: 26,
            height: 34,
            ...papier,
            transform: `rotate(${r}deg)`,
          }}
        >
          <Ligne l={78} />
          <Ligne l={52} />
        </span>
      ))}
      {/* L'enveloppe, par-dessus, avec son rabat en pointe. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[44px] rounded-[3px]"
        style={{ ...papier, boxShadow: ombre }}
      >
        <span
          className="absolute inset-x-0 top-0 h-[22px]"
          style={{
            background: "color-mix(in srgb, var(--carbone) 6%, var(--papier))",
            borderBottom: "1px solid var(--reglure)",
            clipPath: "polygon(0 0, 50% 100%, 100% 0)",
          }}
        />
      </div>
    </div>
  </div>
);

/** Reçus et factures : la facture, portrait, avec son en-tête et son total. */
export const IllFactures: React.FC = () => (
  <div className={BOITE}>
    <div
      className="flex h-[84px] w-[64px] flex-col gap-[5px] px-2.5 py-2.5"
      style={{ ...papier, boxShadow: ombre }}
    >
      {/* L'en-tête : un bloc plein, comme un logo imprimé. */}
      <span className="flex items-center gap-1.5">
        <span className="h-[10px] w-[10px] rounded-[2px]" style={{ background: "var(--carbone)" }} />
        <span className="flex-1">
          <Ligne l={80} fort />
        </span>
      </span>
      <span className="h-px w-full" style={{ background: "var(--reglure)" }} />
      {[86, 70, 78, 58].map((l, i) => (
        <Ligne key={i} l={l} />
      ))}
      <span className="mt-auto flex items-baseline justify-between border-t pt-1" style={{ borderColor: "var(--carbone)" }}>
        <span className="text-[6px] uppercase" style={{ color: "var(--carbone-doux)" }}>
          Total
        </span>
        <span className="font-mono text-[8px] font-bold">62 000</span>
      </span>
    </div>
  </div>
);

// ═══════════════════════ ÉQUIPE ═══════════════════════

/** Vendeurs : les badges accrochés à leur cordon. */
export const IllVendeurs: React.FC = () => (
  <div className={BOITE}>
    <div className="relative flex items-start gap-3">
      {[0, 1].map((b) => (
        <span key={b} className="flex flex-col items-center" style={{ marginTop: b * 10 }}>
          {/* Le cordon. */}
          <span className="block h-[12px] w-[2px]" style={{ background: "var(--carbone-doux)" }} />
          <span
            className="flex h-[52px] w-[40px] flex-col items-center justify-center gap-1.5 rounded-[3px]"
            style={{ ...papier, boxShadow: ombre }}
          >
            <span
              className="h-[16px] w-[16px] rounded-full"
              style={{
                border: "1.5px solid var(--reglure)",
                background: b === 0 ? "color-mix(in srgb, var(--primary) 18%, var(--papier))" : "transparent",
              }}
            />
            <span className="w-[24px]">
              <Ligne l={100} />
            </span>
            <span className="w-[16px]">
              <Ligne l={100} />
            </span>
          </span>
        </span>
      ))}
    </div>
  </div>
);

/** Invitations et accès : l'enveloppe cachetée, et la clé qu'elle porte. */
export const IllInvitations: React.FC = () => (
  <div className={BOITE}>
    <div className="relative">
      <div
        className="relative h-[62px] w-[92px] rounded-[3px]"
        style={{ ...papier, boxShadow: ombre }}
      >
        {/* Les deux plis du dos de l'enveloppe. */}
        <span
          className="absolute inset-0"
          style={{
            borderTop: "1px solid var(--reglure)",
            clipPath: "polygon(0 0, 50% 62%, 100% 0)",
            background: "color-mix(in srgb, var(--carbone) 4%, var(--papier))",
          }}
        />
        {/* Le cachet de cire. */}
        <span
          className="absolute left-1/2 top-1/2 h-[20px] w-[20px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "var(--terre)" }}
        />
      </div>
      {/* La clé, glissée sous l'enveloppe. */}
      <span className="absolute" style={{ bottom: -6, right: -10, transform: "rotate(28deg)" }}>
        <span
          className="block h-[14px] w-[14px] rounded-full"
          style={{ border: "3px solid var(--carbone-doux)" }}
        />
        <span
          className="absolute h-[3px] w-[22px]"
          style={{ top: 5.5, left: 12, background: "var(--carbone-doux)" }}
        />
        <span
          className="absolute h-[7px] w-[3px]"
          style={{ top: 5.5, left: 28, background: "var(--carbone-doux)" }}
        />
      </span>
    </div>
  </div>
);

/** Mon activité : la carte de pointage, perforée à chaque passage. */
export const IllMonActivite: React.FC = () => (
  <div className={BOITE}>
    <div
      className="flex h-[80px] w-[70px] flex-col gap-[6px] px-2.5 py-3"
      style={{ ...papier, boxShadow: ombre }}
    >
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="flex items-center gap-1.5">
          {/* La perforation : un trou franc, pas une pastille. */}
          <span
            className="h-[7px] w-[7px] shrink-0 rounded-full"
            style={{
              background: i < 3 ? "var(--papier-fond)" : "transparent",
              border: `1px solid ${i < 3 ? "var(--carbone)" : "var(--reglure)"}`,
            }}
          />
          <span className="flex-1">
            <Ligne l={i === 0 ? 88 : 62} fort={i === 0} />
          </span>
        </span>
      ))}
      <span className="mt-auto font-mono text-[6px]" style={{ color: "var(--carbone-doux)" }}>
        06/09 · 14:02
      </span>
    </div>
  </div>
);

// ═══════════════════════ RÉGLAGES ═══════════════════════

/** Ma boutique : la devanture, son auvent et son enseigne. */
export const IllMaBoutique: React.FC = () => (
  <div className={BOITE}>
    <div className="relative h-[74px] w-[96px]">
      {/* L'enseigne. */}
      <span
        className="absolute inset-x-3 flex h-[16px] items-center justify-center rounded-[2px] font-mono text-[7px]"
        style={{ top: 0, background: "var(--carbone)", color: "var(--papier)" }}
      >
        BOUTIQUE
      </span>
      {/* L'auvent rayé. */}
      <span
        className="absolute inset-x-0 h-[14px]"
        style={{
          top: 18,
          background:
            "repeating-linear-gradient(90deg, var(--primary) 0 10px, var(--papier) 10px 20px)",
          clipPath: "polygon(6% 0, 94% 0, 100% 100%, 0 100%)",
        }}
      />
      {/* La façade et sa porte. */}
      <div
        className="absolute inset-x-2 rounded-b-[2px]"
        style={{ top: 32, bottom: 0, ...papier, boxShadow: ombre }}
      >
        <span
          className="absolute bottom-0 left-1/2 h-[26px] w-[22px] -translate-x-1/2 rounded-t-[3px]"
          style={{ border: "1.5px solid var(--carbone-doux)", borderBottom: "none" }}
        />
      </div>
    </div>
  </div>
);

/** Notifications : la cloche, et l'onde qui en part. */
export const IllNotifications: React.FC = () => (
  <div className={BOITE}>
    <div className="relative">
      {/* Les ondes, à droite de la cloche. */}
      {[0, 1].map((o) => (
        <span
          key={o}
          className="absolute rounded-full"
          style={{
            top: 16 - o * 5,
            right: -14 - o * 7,
            width: 14 + o * 10,
            height: 22 + o * 14,
            border: "2px solid var(--primary)",
            borderLeftColor: "transparent",
            borderTopColor: "transparent",
            borderBottomColor: "transparent",
            opacity: 1 - o * 0.45,
          }}
        />
      ))}
      {/* Le corps de la cloche. */}
      <span
        className="block h-[46px] w-[46px] rounded-t-full"
        style={{ ...papier, borderBottom: "none", boxShadow: ombre }}
      />
      <span
        className="block h-[3px] w-[58px] rounded-full"
        style={{ background: "var(--carbone)", marginLeft: -6 }}
      />
      {/* Le battant. */}
      <span
        className="mx-auto mt-[3px] block h-[7px] w-[7px] rounded-full"
        style={{ background: "var(--carbone)" }}
      />
    </div>
  </div>
);

/** Sécurité : le pavé où l'on compose son code. */
export const IllSecurite: React.FC = () => (
  <div className={BOITE}>
    <div
      className="flex h-[80px] w-[66px] flex-col items-center gap-2 rounded-[4px] px-2.5 py-2.5"
      style={{ ...papier, boxShadow: ombre }}
    >
      {/* Les quatre chiffres saisis, masqués. */}
      <span className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-[6px] w-[6px] rounded-full"
            style={{ background: i < 3 ? "var(--carbone)" : "var(--reglure)" }}
          />
        ))}
      </span>
      <span className="grid grid-cols-3 gap-[5px]">
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            className="h-[12px] w-[12px] rounded-full"
            style={{
              border: "1px solid var(--reglure)",
              background: i === 4 ? "color-mix(in srgb, var(--primary) 22%, var(--papier))" : "transparent",
            }}
          />
        ))}
      </span>
    </div>
  </div>
);

/** Préférences : les molettes qu'on règle une fois pour toutes. */
export const IllPreferences: React.FC = () => (
  <div className={BOITE}>
    <div
      className="flex h-[76px] w-[94px] flex-col justify-center gap-[13px] px-3.5"
      style={{ ...papier, boxShadow: ombre }}
    >
      {[70, 34, 52].map((pct, i) => (
        <span key={i} className="relative flex items-center">
          <span className="h-[2px] w-full rounded-full" style={{ background: "var(--reglure)" }}>
            <span
              className="block h-full rounded-full"
              style={{ width: `${pct}%`, background: "var(--carbone)" }}
            />
          </span>
          {/* La molette, posée sur la glissière. */}
          <span
            className="absolute h-[11px] w-[11px] rounded-full"
            style={{
              left: `${pct}%`,
              transform: "translateX(-50%)",
              background: i === 0 ? "var(--primary)" : "var(--papier)",
              border: `2px solid ${i === 0 ? "var(--primary)" : "var(--carbone)"}`,
            }}
          />
        </span>
      ))}
    </div>
  </div>
);

/**
 * Quel objet pour quel écran.
 *
 * La table est indexée par le nom EXACT de l'écran, celui de
 * `ecrans.ts`. Une entrée manquante ne casse rien : l'inventaire retombe
 * sur son aperçu en fenêtre. Un écran ajouté sans son dessin s'affichera
 * donc correctement, simplement sans objet — c'est préférable à une page
 * blanche, et la route de vérification signale les manquants.
 */
export const ILLUSTRATIONS: Record<string, React.FC> = {
  "Tableau de bord": IllTableauBord,
  Bilan: IllBilan,
  Historique: IllHistorique,
  Statistiques: IllStatistiques,
  "Vue d’ensemble": IllVueEnsemble,
  Tâches: IllTaches,
  Agenda: IllAgenda,
  Rappels: IllRappels,
  Ventes: IllVentes,
  Commandes: IllCommandes,
  Clients: IllClients,
  "Paiements à recevoir": IllPaiements,
  Devis: IllDevis,
  Livraisons: IllLivraisons,
  Produits: IllProduits,
  Achats: IllAchats,
  "Alertes de rupture": IllRupture,
  Fournisseurs: IllFournisseurs,
  Prestataires: IllPrestataires,
  Capital: IllCapital,
  Dépenses: IllDepenses,
  "Reçus et factures": IllFactures,
  Vendeurs: IllVendeurs,
  "Invitations et accès": IllInvitations,
  "Mon activité": IllMonActivite,
  "Ma boutique": IllMaBoutique,
  Notifications: IllNotifications,
  Sécurité: IllSecurite,
  Préférences: IllPreferences,
};
