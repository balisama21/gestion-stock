import { useCallback, useEffect, useState } from "react";

/**
 * SE SOUVENIR QU'UNE CARTE EST REPLIÉE
 *
 * Deux cartes du tableau de bord sont longues par nature : le
 * calendrier, six rangées de quantièmes, et le journal d'activité, qui
 * ne cesse de s'allonger. Les deux se replient, et les deux arrivent
 * REPLIÉES : on vient sur cet écran pour les chiffres du jour, et l'on
 * déplie ce que l'on veut vraiment consulter.
 *
 * POURQUOI RETENIR LE CHOIX. Quelqu'un qui se sert du calendrier tous
 * les matins ne doit pas le déplier tous les matins. Le réglage vit
 * dans le navigateur, sous le même préfixe que le mode focus et la
 * table de contrôle, et rien n'en va en base.
 *
 * TROIS ÉTATS ET NON DEUX, et c'est nécessaire depuis que le repli est
 * la valeur par défaut :
 *
 *   absent  → la valeur par défaut, donc replié
 *   "1"     → replié, et la personne l'a voulu
 *   "0"     → DÉPLIÉ, et la personne l'a voulu
 *
 * Sans le « 0 », un dépliage ne se retiendrait pas : effacer la clé
 * ramènerait simplement le défaut, c'est-à-dire replié.
 *
 * LU APRÈS LE PREMIER RENDU, comme les autres réglages de cet écran :
 * le serveur n'a pas de `localStorage`, et le lire pendant le rendu
 * ferait diverger les deux arbres. On part donc du défaut, et le choix
 * retenu arrive à la première image.
 */
export function useRepli(cle: string): { replie: boolean; basculer: () => void } {
  const [replie, setReplie] = useState(true);

  useEffect(() => {
    try {
      setReplie(window.localStorage.getItem(cle) !== "0");
    } catch {
      /* Navigation privée : la carte reste repliée, comme par défaut. */
    }
  }, [cle]);

  const basculer = useCallback(() => {
    setReplie((avant) => {
      const suivant = !avant;
      try {
        window.localStorage.setItem(cle, suivant ? "1" : "0");
      } catch {
        /* Le choix ne vaut alors que pour cette page-ci. */
      }
      return suivant;
    });
  }, [cle]);

  return { replie, basculer };
}
