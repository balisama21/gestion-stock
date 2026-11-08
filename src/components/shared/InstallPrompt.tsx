import React, { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import {
  estIOS,
  cheminApkAndroid,
  applicationTantanaInstallee,
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
const surOrdinateur = () => !estIOS() && !/Android/i.test(navigator.userAgent);
const CLE_SESSION_PC = "tantana-installation-pc-fermee";

const refusRecent = (): boolean => {
  try {
    if (surOrdinateur()) return sessionStorage.getItem(CLE_SESSION_PC) === "1";
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
    if (surOrdinateur()) {
      sessionStorage.setItem(CLE_SESSION_PC, "1");
      return;
    }
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
  const [aide, setAide] = useState(false);

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
        const installee = chemin ? await applicationTantanaInstallee("play") : false;
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

    let actif = true;
    const afficher = async () => {
      const installee = surOrdinateur() && (await applicationTantanaInstallee("webapp"));
      if (actif && !installee && !estInstallee() && !refusRecent()) setVisible(true);
    };
    let minuterie = surOrdinateur()
      ? window.setTimeout(afficher, DELAI_AVANT_AFFICHAGE_MS)
      : undefined;
    const retenir = (e: EvenementInstallation) => {
      setEvenement(e);
      if (!surOrdinateur()) {
        window.clearTimeout(minuterie);
        minuterie = window.setTimeout(afficher, DELAI_AVANT_AFFICHAGE_MS);
      }
    };

    // L'événement a pu arriver avant ce montage : le module l'a gardé.
    const dejaCapte = evenementInstallationCapte();
    if (dejaCapte) retenir(dejaCapte);
    const desabonner = surEvenementInstallation(retenir);

    // L'installation peut aussi se faire par le menu du navigateur :
    // la bannière doit alors disparaître d'elle-même.
    const surInstallation = () => {
      actif = false;
      window.clearTimeout(minuterie);
      memoriserRefus();
      setVisible(false);
    };
    window.addEventListener("appinstalled", surInstallation);

    return () => {
      actif = false;
      desabonner();
      window.removeEventListener("appinstalled", surInstallation);
      if (minuterie) clearTimeout(minuterie);
    };
  }, [marque.parDefaut]);

  const installer = async () => {
    if (!evenement) {
      setAide(true);
      return;
    }
    try {
      await evenement.prompt();
      await evenement.userChoice;
      memoriserRefus();
      setVisible(false);
    } catch {
      setAide(true);
    } finally {
      setEvenement(null);
    }
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
            Installer {marque.parDefaut ? "Tantana" : marque.nom}
          </p>

          {apk ? (
            <a href={apk} download className="app-btn-primary mt-3 w-full text-xs">
              Télécharger l’APK Android
            </a>
          ) : ios ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-relaxed text-muted-foreground">
              <span>Dans Safari, appuyez sur Partager</span>
              <Share className="inline h-3.5 w-3.5 shrink-0" aria-label="Partager" />
              <span>puis sur</span>
              <Plus className="inline h-3.5 w-3.5 shrink-0" aria-label="Ajouter" />
              <span>« Sur l'écran d'accueil ».</span>
            </p>
          ) : (
            <button onClick={installer} className="app-btn-primary mt-3 w-full text-xs">
              <Download className="h-4 w-4" />
              Télécharger l’application
            </button>
          )}
          {aide && !evenement && (
            <p role="status" className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {/Macintosh/.test(navigator.userAgent) &&
              /Safari\//.test(navigator.userAgent) &&
              !/Chrom(e|ium)\//.test(navigator.userAgent)
                ? "Dans Safari, ouvrez le menu Fichier et choisissez « Ajouter au Dock » si cette option est disponible."
                : "Dans Chrome ou Edge, ouvrez le menu ⋮ ou ⋯ et cherchez l’option pour installer cette page comme application."}
            </p>
          )}
          {surOrdinateur() && (
            <button onClick={fermer} className="mt-2 text-xs underline">
              Continuer sur le web
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
