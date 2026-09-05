import React, { useEffect, useState } from "react";
import { Check, Download, Plus, Share, Smartphone } from "lucide-react";
import { SettingsSection, SettingsRow, SettingsBlock } from "./primitives";
import {
  estIOS,
  estInstallee,
  evenementInstallationCapte,
  surEvenementInstallation,
  type EvenementInstallation,
} from "../../lib/pwa";
import { APP_NAME } from "../../lib/appConfig";

/**
 * Installer l'application depuis les réglages.
 *
 * La bannière d'invitation se souvient d'un refus pendant sept jours.
 * Fermée par mégarde, elle laissait l'utilisateur sans aucun moyen
 * d'installer depuis l'application — le seul chemin restant passait par
 * un menu du navigateur que personne ne pense à ouvrir. Cette section
 * est l'entrée permanente qui manquait : elle ne se refuse pas, ne
 * s'oublie pas, et se trouve là où l'on cherche naturellement.
 *
 * Trois situations, trois réponses. Chrome sur Android nous confie un
 * événement qu'on peut rejouer : un bouton suffit. iOS n'expose rien du
 * tout et impose son menu Partager : il faut l'expliquer. Enfin Chrome
 * ne réémet pas son événement après un refus dans sa propre fenêtre ;
 * dans ce cas seul le menu du navigateur reste, et le dire vaut mieux
 * que de montrer un bouton sans effet.
 */
export const InstallationSection: React.FC = () => {
  const [evenement, setEvenement] = useState<EvenementInstallation | null>(null);
  const [installee, setInstallee] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstallee(estInstallee());
    setIos(estIOS());

    setEvenement(evenementInstallationCapte());
    const desabonner = surEvenementInstallation(setEvenement);

    const surInstallation = () => {
      setInstallee(true);
      setEvenement(null);
    };
    window.addEventListener("appinstalled", surInstallation);

    return () => {
      desabonner();
      window.removeEventListener("appinstalled", surInstallation);
    };
  }, []);

  const installer = async () => {
    if (!evenement) return;
    await evenement.prompt();
    const { outcome } = await evenement.userChoice;
    if (outcome === "accepted") setInstallee(true);
    // L'événement ne se rejoue pas : Chrome n'en fournit qu'un.
    setEvenement(null);
  };

  return (
    <SettingsSection
      title="Application"
      description={`Installer ${APP_NAME} sur cet appareil, pour l'ouvrir depuis l'écran d'accueil.`}
      icon={<Smartphone className="h-4 w-4" />}
    >
      {installee ? (
        <SettingsBlock>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 shrink-0 t-success" />
            L'application est installée sur cet appareil.
          </p>
        </SettingsBlock>
      ) : ios ? (
        <SettingsBlock>
          <p className="text-sm font-semibold text-foreground">Depuis Safari</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-relaxed text-muted-foreground">
            <span>Appuyez sur</span>
            <Share className="inline h-3.5 w-3.5 shrink-0" aria-label="Partager" />
            <span>en bas de l'écran, puis sur</span>
            <Plus className="inline h-3.5 w-3.5 shrink-0" aria-label="Ajouter" />
            <span>« Sur l'écran d'accueil ».</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            iOS ne permet pas de lancer l'installation depuis une page : ce
            passage par le menu de partage est imposé par le système.
          </p>
        </SettingsBlock>
      ) : evenement ? (
        <SettingsRow
          label="Installer sur cet appareil"
          hint="Accès direct depuis l'écran d'accueil, sans barre d'adresse."
        >
          <button onClick={installer} className="app-btn-primary w-full text-sm">
            <Download className="h-4 w-4" />
            Installer
          </button>
        </SettingsRow>
      ) : (
        <SettingsBlock>
          <p className="text-sm font-semibold text-foreground">Depuis le menu du navigateur</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Ouvrez le menu <span className="font-semibold">⋮</span> en haut à
            droite, puis choisissez « Installer l'application » ou « Ajouter à
            l'écran d'accueil ».
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Ce chemin apparaît ici quand le navigateur ne nous laisse plus
            proposer l'installation nous-mêmes — après un refus dans sa propre
            fenêtre, notamment. Il reste toujours disponible.
          </p>
        </SettingsBlock>
      )}
    </SettingsSection>
  );
};
