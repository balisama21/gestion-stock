import React from "react";
import { TracesFlottants } from "../ui/floating-paths";
import { APP_NAME } from "../../lib/appConfig";

/**
 * Panneau de marque, à gauche du formulaire.
 *
 * Repris du modèle proposé : la marque en haut, une citation en bas, des
 * tracés qui dérivent derrière, un dégradé qui les éteint vers le bas
 * pour que le texte porte. La palette, elle, reste celle de la page — du
 * papier, de l'encre, et le vert de la marque en seule couleur d'action.
 *
 * La citation n'est pas attribuée à un client. Le modèle en propose une,
 * signée d'un nom ; en inventer une reviendrait à publier un faux
 * témoignage sur une page publique, et un visiteur qui s'en aperçoit
 * n'accorde plus rien au reste. Ce qui est écrit ici est la promesse du
 * produit, énoncée comme telle. Le jour où un commerçant en dit quelque
 * chose de vrai, sa phrase et son nom prendront cette place.
 *
 * Masqué sous 1 024 pixels : sur un téléphone, celui qui vient se
 * connecter veut son formulaire, pas un panneau de présentation.
 */
export const PanneauMarque: React.FC = () => (
  <div
    className="relative hidden overflow-hidden rounded-2xl p-9 lg:flex lg:min-h-[34rem] lg:flex-col"
    style={{ background: "var(--papier)", border: "1px solid var(--reglure)" }}
  >
    {/* Les tracés, dans l'encre du cahier. */}
    <div className="absolute inset-0" style={{ color: "var(--encre)" }}>
      <TracesFlottants />
    </div>

    {/* Le dégradé qui éteint le motif là où le texte se pose. */}
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background: "linear-gradient(to top, var(--papier) 12%, transparent 62%)",
      }}
    />

    <div className="relative z-10 flex items-center gap-2.5">
      <img src="/logo.svg" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
      <p className="text-lg font-semibold" style={{ color: "var(--carbone)" }}>
        {APP_NAME}
      </p>
    </div>

    <div className="relative z-10 mt-auto">
      <blockquote className="space-y-3">
        <p className="text-[1.35rem] leading-snug" style={{ color: "var(--carbone)" }}>
          « Le cahier ne se perd plus, ne se mouille plus, et fait les comptes tout seul. »
        </p>
        <footer className="font-mono text-sm" style={{ color: "var(--carbone-doux)" }}>
          Ce que {APP_NAME} remplace
        </footer>
      </blockquote>
    </div>
  </div>
);
