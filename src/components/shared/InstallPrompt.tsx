import React, { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import {
  estIOS,
  estInstallee,
  evenementInstallationCapte,
  surEvenementInstallation,
  type EvenementInstallation,
} from "../../lib/pwa";
import { APP_NAME } from "../../lib/appConfig";

const CLE_REFUS = "balsama-installation-refusee";
const JOURS_AVANT_NOUVELLE_PROPOSITION = 7;
/** Laisse à l'utilisateur le temps d'arriver avant de lui proposer quoi que ce soit. */
const DELAI_AVANT_AFFICHAGE_MS = 3000;

const refusRecent = (): boolean => {
  try {
    const brut = localStorage.getItem(CLE_REFUS);
    if (!brut) return false;
    const jours = (Date.now() - Number(brut)) / 86_400_000;
    return jours < JOURS_AVANT_NOUVELLE_PROPOSITION;
  } catch {
    // Stockage refusé : on préfère proposer une fois de trop que jamais.
    return false;
  }
};

const memoriserRefus = () => {
  try {
    localStorage.setItem(CLE_REFUS, String(Date.now()));
  } catch {
    /* navigation privée : le refus ne vaudra que pour cette session */
  }
};

/**
 * Invitation à installer l'application sur le téléphone.
 *
 * Deux systèmes, deux comportements irréconciliables.
 *
 * Sur Android, Chrome émet `beforeinstallprompt`. On l'intercepte pour
 * empêcher la fenêtre native — impossible à styler, et qui surgit au
 * plus mauvais moment — et on garde l'événement sous le coude : le
 * bouton de notre bannière le rejoue au moment choisi par
 * l'utilisateur.
 *
 * Sur iOS, cet événement n'existe pas et Safari n'offre aucun moyen de
 * déclencher une installation depuis une page. La seule voie est le menu
 * Partager, qu'il faut donc expliquer. C'est une limite du système, pas
 * un manque de l'application.
 */
export const InstallPrompt: React.FC = () => {
  const [evenement, setEvenement] = useState<EvenementInstallation | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (estInstallee() || refusRecent()) return;

    if (estIOS()) {
      setIos(true);
      const t = setTimeout(() => setVisible(true), DELAI_AVANT_AFFICHAGE_MS);
      return () => clearTimeout(t);
    }

    let minuterie: number | undefined;

    const retenir = (e: EvenementInstallation) => {
      setEvenement(e);
      minuterie = window.setTimeout(() => setVisible(true), DELAI_AVANT_AFFICHAGE_MS);
    };

    // L'événement a pu arriver avant ce montage : le module l'a gardé.
    const dejaCapte = evenementInstallationCapte();
    if (dejaCapte) retenir(dejaCapte);
    const desabonner = surEvenementInstallation(retenir);

    // L'installation peut aussi se faire par le menu du navigateur :
    // la bannière doit alors disparaître d'elle-même.
    const surInstallation = () => setVisible(false);
    window.addEventListener("appinstalled", surInstallation);

    return () => {
      desabonner();
      window.removeEventListener("appinstalled", surInstallation);
      if (minuterie) clearTimeout(minuterie);
    };
  }, []);

  const installer = async () => {
    if (!evenement) return;
    setVisible(false);
    await evenement.prompt();
    const { outcome } = await evenement.userChoice;
    // Un refus dans la fenêtre native compte comme un refus : Chrome ne
    // réémettra pas l'événement de sitôt, inutile d'insister.
    if (outcome === "dismissed") memoriserRefus();
    setEvenement(null);
  };

  const fermer = () => {
    setVisible(false);
    memoriserRefus();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:left-auto sm:right-4 sm:max-w-sm sm:p-4"
      role="dialog"
      aria-label="Installer l'application"
    >
      <div
        className="app-card flex items-start gap-3 p-3.5 sm:p-4"
        style={{ boxShadow: "var(--elev-3)" }}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
          GS
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Installer {APP_NAME}
          </p>

          {ios ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-relaxed text-muted-foreground">
              <span>Appuyez sur</span>
              <Share className="inline h-3.5 w-3.5 shrink-0" aria-label="Partager" />
              <span>puis sur</span>
              <Plus className="inline h-3.5 w-3.5 shrink-0" aria-label="Ajouter" />
              <span>« Sur l'écran d'accueil ».</span>
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Accès direct depuis l'écran d'accueil, sans barre d'adresse.
              </p>
              <button onClick={installer} className="app-btn-primary mt-3 w-full text-xs">
                <Download className="h-4 w-4" />
                Installer l'application
              </button>
            </>
          )}
        </div>

        <button
          onClick={fermer}
          className="app-btn-icon h-8 w-8 shrink-0"
          aria-label="Ne plus proposer pour l'instant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
