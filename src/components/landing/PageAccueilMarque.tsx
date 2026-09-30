import React from "react";
import type { Marque } from "../../lib/marque";
import { lienWhatsapp, type BlocLanding, type LandingMarque } from "../../lib/landingMarque";
import { LogoMarque } from "./LogoMarque";

/**
 * Page d'accueil d'une marque cliente, tirée de `branding.landing`.
 * Même principe que la vitrine Tantana, identité propre : l'étiquette de
 * colis tient le rôle du ticket. Aucune animation, aucun prix.
 */

const POLICE =
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&display=swap";

/** Code-barres tiré du nom : décoratif, mais toujours le même. */
function CodeBarres({ graine }: { graine: string }) {
  const codes = Array.from(`${graine.toUpperCase()}*`).map((c) => c.charCodeAt(0));
  const barres: React.ReactNode[] = [];
  let x = 0;
  for (let i = 0; i < 44; i++) {
    const c = codes[i % codes.length] + i * 7;
    const largeur = 1 + (c % 3);
    if (i % 2 === 0) barres.push(<rect key={i} x={x} y={0} width={largeur} height={40} />);
    x += largeur + ((c >> 2) % 2) + 1;
  }
  return (
    <svg
      viewBox={`0 0 ${x} 40`}
      preserveAspectRatio="none"
      className="h-10 w-full"
      fill="currentColor"
      aria-hidden="true"
    >
      {barres}
    </svg>
  );
}

function Etiquette({ marque, landing }: { marque: Marque; landing: LandingMarque }) {
  const champs = [
    { nom: "De", valeur: marque.nom },
    { nom: "Pour", valeur: landing.pour },
    { nom: "Contenu", valeur: landing.contenu },
  ].filter((c) => c.valeur);
  return (
    <div className="vm-etiquette mx-auto w-full max-w-sm px-5 pb-5 pt-7">
      {champs.map((c) => (
        <div key={c.nom} className="vm-champ py-3">
          <p className="text-xs" style={{ color: "var(--carbone-doux)" }}>
            {c.nom}
          </p>
          <p className="vm-condense mt-0.5 text-2xl font-semibold leading-tight">{c.valeur}</p>
        </div>
      ))}
      <div className="mt-4">
        <CodeBarres graine={marque.nom} />
      </div>
    </div>
  );
}

function TitreSection({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="vm-condense vm-titre-section text-[clamp(1.9rem,4.5vw,2.8rem)]">{children}</h2>
  );
}

function Offres({ bloc }: { bloc: BlocLanding }) {
  return (
    <section id="offres" className="reglure px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <TitreSection>{bloc.titre || "Ce que nous proposons"}</TitreSection>
        <ul className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {bloc.elements.map((e) => (
            <li key={e.titre} className="flex gap-4">
              <span className="vm-repere" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-lg font-semibold" style={{ color: "var(--carbone)" }}>
                  {e.titre}
                </p>
                {e.texte && (
                  <p
                    className="mt-1 max-w-[46ch] text-[0.9375rem] leading-relaxed"
                    style={{ color: "var(--carbone-doux)" }}
                  >
                    {e.texte}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Arguments({ bloc }: { bloc: BlocLanding }) {
  return (
    <section className="reglure px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <TitreSection>{bloc.titre || "Pourquoi nous"}</TitreSection>
        <div className="mt-10 grid gap-10 md:grid-cols-3">
          {bloc.elements.map((e) => (
            <div key={e.titre} className="vm-argument pt-4">
              <p className="vm-condense text-2xl font-semibold leading-tight">{e.titre}</p>
              {e.texte && (
                <p
                  className="mt-2 text-[0.9375rem] leading-relaxed"
                  style={{ color: "var(--carbone-doux)" }}
                >
                  {e.texte}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Etapes({ bloc }: { bloc: BlocLanding }) {
  return (
    <section className="reglure px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <TitreSection>{bloc.titre || "Comment commander"}</TitreSection>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {bloc.elements.map((e, i) => (
            <li key={e.titre} className="flex gap-4">
              <span
                className="vm-condense text-5xl font-bold leading-none"
                style={{ color: "var(--vm-kraft)" }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="min-w-0 pt-1">
                <p className="text-lg font-semibold" style={{ color: "var(--carbone)" }}>
                  {e.titre}
                </p>
                {e.texte && (
                  <p
                    className="mt-1 text-[0.9375rem] leading-relaxed"
                    style={{ color: "var(--carbone-doux)" }}
                  >
                    {e.texte}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Contact({ landing }: { landing: LandingMarque }) {
  const c = landing.contact;
  if (!c) return null;
  const whatsapp = c.whatsapp ? lienWhatsapp(c.whatsapp) : null;
  const lignes = [
    c.telephone && {
      nom: "Téléphone",
      valeur: c.telephone,
      lien: `tel:${c.telephone.replace(/\s/g, "")}`,
    },
    c.whatsapp && { nom: "WhatsApp", valeur: c.whatsapp, lien: whatsapp },
    c.email && { nom: "E-mail", valeur: c.email, lien: `mailto:${c.email}` },
    c.adresse && { nom: "Adresse", valeur: c.adresse, lien: null },
  ].filter(Boolean) as { nom: string; valeur: string; lien: string | null }[];
  return (
    <section id="contact" className="reglure scroll-mt-14 px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <TitreSection>Nous contacter</TitreSection>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2">
          {lignes.map((l) => (
            <div key={l.nom}>
              <dt className="text-xs" style={{ color: "var(--carbone-doux)" }}>
                {l.nom}
              </dt>
              <dd className="mt-1 break-words text-lg font-semibold">
                {l.lien ? (
                  <a
                    href={l.lien}
                    className="hover:underline"
                    style={{ color: "var(--carbone)" }}
                    {...(l.lien.startsWith("https:")
                      ? { target: "_blank", rel: "noreferrer" }
                      : null)}
                  >
                    {l.valeur}
                  </a>
                ) : (
                  l.valeur
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

interface PageAccueilMarqueProps {
  marque: Marque;
  landing: LandingMarque;
  /** Amène au formulaire de connexion, plus bas dans la page. */
  onEspaceEquipe: () => void;
}

export const PageAccueilMarque: React.FC<PageAccueilMarqueProps> = ({
  marque,
  landing,
  onEspaceEquipe,
}) => (
  <>
    <link rel="stylesheet" href={POLICE} precedence="default" />

    <div
      className="sticky top-0 z-40 border-b"
      style={{ borderColor: "var(--reglure)", background: "var(--papier-fond)" }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-2.5">
          <LogoMarque marque={marque} taille={30} />
          <span className="vm-condense truncate text-xl font-semibold">{marque.nom}</span>
        </span>
        <button
          type="button"
          onClick={onEspaceEquipe}
          className="shrink-0 rounded-lg border px-3.5 py-1.5 text-xs font-semibold"
          style={{ borderColor: "var(--carbone)", color: "var(--carbone)" }}
        >
          Espace équipe
        </button>
      </div>
    </div>

    <section className="px-4 pb-20 pt-14 sm:px-8 sm:pt-20">
      <div className="mx-auto grid max-w-5xl items-center gap-14 md:grid-cols-[1.25fr_1fr]">
        <div className="min-w-0">
          <h1 className="vm-condense vm-titre break-words text-[clamp(2.6rem,7.5vw,4.9rem)]">
            {landing.titre}
          </h1>
          {landing.sousTitre && (
            <p
              className="mt-5 max-w-[46ch] text-base leading-relaxed sm:text-lg"
              style={{ color: "var(--carbone-doux)" }}
            >
              {landing.sousTitre}
            </p>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {landing.contact && (
              <a
                href="#contact"
                className="rounded-lg bg-primary px-7 py-3.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Nous contacter
              </a>
            )}
            <button
              type="button"
              onClick={onEspaceEquipe}
              className={
                landing.contact
                  ? "rounded-lg border px-7 py-3.5 text-sm font-semibold"
                  : "rounded-lg bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              }
              style={landing.contact ? { borderColor: "var(--carbone)" } : undefined}
            >
              Espace équipe
            </button>
          </div>
        </div>
        <Etiquette marque={marque} landing={landing} />
      </div>
    </section>

    {landing.offres && <Offres bloc={landing.offres} />}
    {landing.arguments && <Arguments bloc={landing.arguments} />}
    {landing.etapes && <Etapes bloc={landing.etapes} />}
    <Contact landing={landing} />
  </>
);

// Projection oblique des cartons : profondeur vers la droite et le haut.
const DX = 30;
const DY = -20;
const pts = (...p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(" ");

interface CartonProps {
  x: number;
  y: number;
  l: number;
  h: number;
  titre: string;
  detail: string;
  children?: React.ReactNode;
}

/** Un carton kraft, scotché, avec son étiquette de contenu. */
function Carton({ x, y, l, h, titre, detail, children }: CartonProps) {
  const milieu = x + l / 2;
  return (
    <g stroke="var(--carbone)" strokeWidth={1.5} strokeLinejoin="round">
      <polygon
        points={pts([x + l, y], [x + l + DX, y + DY], [x + l + DX, y + h + DY], [x + l, y + h])}
        fill="#a98053"
      />
      <polygon
        points={pts([x, y], [x + l, y], [x + l + DX, y + DY], [x + DX, y + DY])}
        fill="#dcb88c"
      />
      <rect x={x} y={y} width={l} height={h} fill="#c89f6e" />
      {/* Ruban : sur le dessus, puis rabattu sur la face. */}
      <polygon
        points={pts(
          [milieu - 11, y],
          [milieu + 11, y],
          [milieu + 11 + DX, y + DY],
          [milieu - 11 + DX, y + DY],
        )}
        fill="#9c7446"
        stroke="none"
        opacity={0.85}
      />
      <rect
        x={milieu - 11}
        y={y}
        width={22}
        height={14}
        fill="#9c7446"
        stroke="none"
        opacity={0.85}
      />
      <rect x={x + 16} y={y + 22} width={l - 32} height={56} rx={2} fill="#ffffff" />
      <text
        x={x + 28}
        y={y + 52}
        className="vm-condense"
        fontSize={24}
        fontWeight={700}
        fill="var(--carbone)"
        stroke="none"
      >
        {titre}
      </text>
      <text x={x + 28} y={y + 69} fontSize={11} fill="var(--carbone-doux)" stroke="none">
        {detail}
      </text>
      {children}
    </g>
  );
}

/** Flèches « haut » des consignes de manutention. */
function FlechesHaut({ x, y }: { x: number; y: number }) {
  return (
    <g fill="none" stroke="var(--carbone)" strokeWidth={2} strokeLinecap="round">
      {[0, 14].map((d) => (
        <path
          key={d}
          d={`M${x + d} ${y + 20} V${y} M${x + d - 5} ${y + 6} L${x + d} ${y} L${x + d + 5} ${y + 6}`}
        />
      ))}
    </g>
  );
}

/**
 * La palette de l'entrepôt : ventes, stock et clients rangés au même
 * endroit. Dessin fixe, sans animation.
 */
function PaletteCartons({ marque }: { marque: Marque }) {
  return (
    <svg viewBox="10 20 450 330" className="h-auto w-full max-w-lg" aria-hidden="true">
      <ellipse cx={235} cy={343} rx={215} ry={9} fill="var(--carbone)" opacity={0.08} />
      {/* Palette */}
      <g stroke="var(--carbone)" strokeWidth={1.5} strokeLinejoin="round">
        <polygon
          points={pts([30, 300], [410, 300], [410 + DX, 300 + DY], [30 + DX, 300 + DY])}
          fill="#b39064"
        />
        <rect x={30} y={300} width={380} height={12} fill="#9a7a52" />
        {[40, 205, 370].map((bx) => (
          <rect key={bx} x={bx} y={312} width={32} height={22} fill="#8a6a45" />
        ))}
        <rect x={30} y={334} width={380} height={8} fill="#9a7a52" />
      </g>
      <Carton x={40} y={180} l={180} h={120} titre="STOCK" detail="Au carton près">
        <text
          x={56}
          y={284}
          className="vm-condense"
          fontSize={15}
          fontWeight={700}
          letterSpacing={3}
          fill="var(--carbone)"
          stroke="none"
          opacity={0.75}
        >
          {marque.nom.toUpperCase()}
        </text>
      </Carton>
      <Carton x={220} y={180} l={180} h={120} titre="CLIENTS" detail="Fiches et créances">
        <FlechesHaut x={362} y={268} />
      </Carton>
      <Carton x={110} y={60} l={200} h={120} titre="VENTES" detail="Du devis à la facture" />
    </svg>
  );
}

/** À côté du formulaire : ce que l'équipe trouve derrière. */
export const PanneauEspaceEquipe: React.FC<{ marque: Marque }> = ({ marque }) => (
  <div className="text-center lg:text-left">
    <h2 className="vm-condense vm-titre-section text-[clamp(2rem,4.5vw,2.8rem)]">Espace équipe</h2>
    <p
      className="mx-auto mt-3 max-w-[40ch] text-base leading-relaxed lg:mx-0"
      style={{ color: "var(--carbone-doux)" }}
    >
      Connectez-vous pour suivre les ventes, le stock et les clients de {marque.nom}.
    </p>
    {/* Sur mobile, le formulaire passe avant le dessin. */}
    <div className="mt-10 hidden lg:block">
      <PaletteCartons marque={marque} />
    </div>
  </div>
);

export const PiedMarque: React.FC<{ marque: Marque }> = ({ marque }) => (
  <footer className="reglure px-5 py-10">
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 text-center">
      <LogoMarque marque={marque} taille={36} />
      <p className="vm-condense mt-1 text-2xl font-semibold">{marque.nom}</p>
      {marque.slogan && (
        <p className="text-xs" style={{ color: "var(--carbone-doux)" }}>
          {marque.slogan}
        </p>
      )}
    </div>
  </footer>
);
