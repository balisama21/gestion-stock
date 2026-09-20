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
 *   absent  → la valeur par défaut de l'appelant
 *   "1"     → replié, et la personne l'a voulu
 *   "0"     → DÉPLIÉ, et la personne l'a voulu
 *
 * Sans le « 0 », un dépliage ne se retiendrait pas quand le défaut est
 * replié : effacer la clé ramènerait simplement ce défaut.
 *
 * LE DÉFAUT N'EST PAS TOUJOURS « REPLIÉ ». Le détail du solde de
 * trésorerie arrive ouvert : c'est la réponse à la question que pose sa
 * carte, pas un contenu qu'on déplie à l'occasion. Le calendrier et le
 * journal, eux, restent repliés — on vient sur cet écran pour les
 * chiffres du jour.
 *
 * LU APRÈS LE PREMIER RENDU, comme les autres réglages de cet écran :
 * le serveur n'a pas de `localStorage`, et le lire pendant le rendu
 * ferait diverger les deux arbres. On part donc du défaut, et le choix
 * retenu arrive à la première image.
 */
export function useRepli(
  cle: string,
  replieParDefaut = true,
): { replie: boolean; basculer: () => void } {
  const [replie, setReplie] = useState(replieParDefaut);

  useEffect(() => {
    try {
      const retenu = window.localStorage.getItem(cle);
      setReplie(retenu === null ? replieParDefaut : retenu === "1");
    } catch {
      /* Navigation privée : on s'en tient au défaut. */
    }
  }, [cle, replieParDefaut]);

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
