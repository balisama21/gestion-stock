import { toast } from "sonner";

/**
 * Dire à l'utilisateur ce qui s'est passé, sans bloquer l'écran.
 *
 * Les erreurs passaient par `alert()` : une boîte grise du navigateur,
 * qui fige la page jusqu'au clic, titrée du nom de domaine, et qu'un
 * téléphone affiche parfois en plein milieu d'une saisie. Le message
 * reste maintenant dans l'application, en haut de l'écran, le temps de
 * le lire — plus longtemps pour une erreur, qu'il faut pouvoir relire.
 */
export function signalerErreur(message: string): void {
  toast.error(message, { duration: 9000 });
}

export function signalerAvertissement(message: string): void {
  toast.warning(message, { duration: 7000 });
}
