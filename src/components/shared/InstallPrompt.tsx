import React, { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import {
  estIOS,
  cheminApkAndroid,
  apkTantanaInstalle,
  estInstallee,
  evenementInstallationCapte,
  surEvenementInstallation,
  type EvenementInstallation,
} from "../../lib/pwa";
import { useMarque } from "../../hooks/useMarque";
import { SANS_ICONE } from "../../lib/marque";

const CLE_REFUS = "balsama-installation-refusee";
const cleConfirmation = (ios: boolean) =>
  ios ? "installation-ios-confirmee" : "installation-apk-confirmee";
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

export const InstallPrompt: React.FC = () => {
  const marque = useMarque();
  const icone = marque.parDefaut
    ? "/icon-192.png"
    : marque.faviconUrl !== SANS_ICONE
      ? marque.faviconUrl
      : null;
  const [evenement, setEvenement] = useState<EvenementInstallation | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [apk, setApk] = useState<string | null>(null);

  useEffect(() => {
    setVisible(false);
    if (estInstallee() || refusRecent()) return;

    const chemin = cheminApkAndroid(marque.parDefaut);
    setApk(chemin);
    if (estIOS() || chemin) {
      const iphone = estIOS();
      setIos(iphone);
      let revision = 0;
      const verifier = async () => {
        const demande = ++revision;
        if (document.hidden || estInstallee() || refusRecent()) {
          setVisible(false);
          return;
        }
        try {
          if (localStorage.getItem(cleConfirmation(iphone))) {
            setVisible(false);
            return;
          }
        } catch {
          /* Stockage indisponible. */
        }
        const installee = chemin ? await apkTantanaInstalle() : false;
        if (revision === demande && !refusRecent()) setVisible(!installee);
      };
      const t = setTimeout(verifier, DELAI_AVANT_AFFICHAGE_MS);
      document.addEventListener("visibilitychange", verifier);
      window.addEventListener("pageshow", verifier);
      return () => {
        revision++;
        clearTimeout(t);
        document.removeEventListener("visibilitychange", verifier);
        window.removeEventListener("pageshow", verifier);
      };
    }
    if (marque.parDefaut && /Android/i.test(navigator.userAgent)) return;

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
  }, [marque.parDefaut]);

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
        {icone && (
          <img
            src={icone}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-xl"
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Installer {apk ? "Tantana" : marque.nom}
          </p>

          {apk ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Ouvrez le fichier tantana.apk sur votre téléphone Android pour installer Tantana.
              </p>
              <a href={apk} download className="app-btn-primary mt-3 w-full text-xs">
                Télécharger l’APK Android
              </a>
            </>
          ) : ios ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-relaxed text-muted-foreground">
              <span>Dans Safari, appuyez sur Partager</span>
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
                Installer la version web
              </button>
            </>
          )}
          <button onClick={fermer} className="mt-2 text-xs underline">
            Continuer sur le web
          </button>
          {(ios || apk) && (
            <button
              className="mt-2 block text-xs underline"
              onClick={() => {
                try {
                  localStorage.setItem(cleConfirmation(ios), "1");
                } catch {
                  /* Stockage indisponible. */
                }
                fermer();
              }}
            >
              J’ai déjà installé l’application
            </button>
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
