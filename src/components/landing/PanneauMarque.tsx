import React from "react";
import { APP_NAME } from "../../lib/appConfig";

/**
 * Le bloc de marque, à gauche du formulaire.
 *
 * La marque, un filet vert, puis la citation. Centré sur téléphone,
 * aligné à gauche dès qu'il y a deux colonnes — comme les maquettes.
 *
 * Le guillemet ouvrant est décroché à gauche de la citation, à toutes
 * les largeurs. Posé sur sa propre ligne centrée, comme il l'était sur
 * téléphone, il ne ressemblait plus à une ponctuation : juste un signe
 * vert flottant au-dessus du texte. Décroché, il retrouve son rôle —
 * il ouvre la phrase, et l'œil sait où commencer à lire.
 *
 * La citation n'est attribuée à personne. En signer une d'un nom inventé
 * reviendrait à publier un faux témoignage sur une page publique, et un
 * visiteur qui s'en aperçoit n'accorde plus rien au reste. Ce qui est
 * écrit ici est la promesse du produit, énoncée comme telle. Le jour où
 * un commerçant en dira quelque chose de vrai, sa phrase et son nom
 * prendront cette place.
 */
export const PanneauMarque: React.FC = () => (
  <div className="relative text-center lg:text-left">
    <div className="flex items-center justify-center gap-3 lg:justify-start">
      <img src="/logo.svg" alt="" width={52} height={52} className="h-13 w-13 rounded-2xl" />
      <p className="text-[1.85rem] font-bold tracking-tight" style={{ color: "var(--carbone)" }}>
        {APP_NAME}
      </p>
    </div>

    <blockquote className="relative mt-9 pt-8 lg:mt-9 lg:pt-0 lg:ps-14">
      <span
        aria-hidden
        className="absolute left-0 top-1 text-[2.6rem] font-bold leading-[0.5]"
        style={{ color: "var(--primary)" }}
      >
        &ldquo;
      </span>
      <p
        className="text-[clamp(1.35rem,3.2vw,2rem)] leading-[1.32]"
        style={{ color: "var(--carbone)" }}
      >
        Le cahier ne se perd plus, ne se mouille plus, et fait les comptes tout seul.
      </p>
      <footer className="mt-5 text-[1rem]" style={{ color: "var(--carbone-doux)" }}>
        Ce que {APP_NAME} remplace
      </footer>
    </blockquote>
  </div>
);
