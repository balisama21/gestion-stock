import React from "react";

/**
 * Ce qu'il faut savoir avant de saisir son mot de passe.
 *
 * Trois réponses aux questions qu'on se pose la main sur le clavier :
 * combien de temps, sur quel appareil, et ce que verront ses vendeurs.
 * Elles sont posées en marge, comme les annotations d'un cahier, plutôt
 * qu'enfermées dans trois cartes de plus.
 *
 * Sur téléphone, elles passent SOUS le formulaire : celui qui revient
 * chaque matin n'a pas à les relire pour se connecter.
 */
const NOTES = [
  ["Cinq minutes", "Créez la boutique, entrez vos produits, encaissez la première vente."],
  ["Sur le téléphone", "Installez depuis le navigateur ; aucune boutique d'applications."],
  ["Chacun sa vue", "Vos vendeurs accèdent à leur travail, pas à votre trésorerie."],
] as const;

export const ArgumentaireConnexion: React.FC = () => (
  <div className="order-2 lg:order-1">
    <h2 className="titrage text-[clamp(1.5rem,4.2vw,2rem)]">Votre boutique vous attend</h2>

    <dl className="mt-8">
      {NOTES.map(([titre, texte]) => (
        <div key={titre} className="reglure grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
          <dt className="text-[0.95rem] font-medium" style={{ color: "var(--encre)" }}>
            {titre}
          </dt>
          <dd className="text-[0.95rem] leading-relaxed" style={{ color: "var(--carbone-doux)" }}>
            {texte}
          </dd>
        </div>
      ))}
      <div className="reglure" />
    </dl>
  </div>
);
