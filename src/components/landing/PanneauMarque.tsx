import React from "react";
import { APP_NAME } from "../../lib/appConfig";

/**
 * Le bloc de marque, à gauche du formulaire.
 *
 * La marque, un filet vert, puis la citation. Centré sur téléphone,
 * aligné à gauche dès qu'il y a deux colonnes — comme les maquettes.
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
      <img src="/logo.svg" alt="" width={44} height={44} className="h-11 w-11 rounded-xl" />
      <p className="text-[1.65rem] font-bold tracking-tight" style={{ color: "var(--carbone)" }}>
        {APP_NAME}
      </p>
    </div>

    {/* Le filet, qui tient lieu de signature graphique. */}
    <span
      aria-hidden
      className="mx-auto mt-4 block h-[3px] w-14 rounded-full lg:mx-0"
      style={{ background: "var(--primary)" }}
    />

    <blockquote className="mt-8">
      <p
        className="text-[clamp(1.35rem,3.4vw,1.9rem)] font-medium leading-[1.35]"
        style={{ color: "var(--carbone)" }}
      >
        <span
          aria-hidden
          className="mr-1 align-top text-[2.4em] leading-[0.62] font-serif"
          style={{ color: "var(--primary)" }}
        >
          &ldquo;
        </span>
        Le cahier ne se perd plus, ne se mouille plus, et fait les comptes tout seul.
      </p>
      <footer className="mt-4 text-[0.95rem]" style={{ color: "var(--carbone-doux)" }}>
        Ce que {APP_NAME} remplace
      </footer>
    </blockquote>
  </div>
);
