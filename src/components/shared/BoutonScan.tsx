import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { Modal } from "./Modal";

/**
 * Le détecteur de codes-barres.
 *
 * Celui du navigateur d'abord : Chrome l'expose sur Android et sur Mac.
 * Ailleurs — Chrome et Edge sous Windows, Firefox, Safari —, la même
 * interface est fournie par `barcode-detector` (le moteur ZXing compilé en
 * WebAssembly). Elle n'est chargée qu'au premier scan, et son moteur est
 * servi par le site lui-même : ceux qui ne scannent jamais ne la
 * téléchargent pas, et rien ne part chez un tiers.
 */
interface CodeDetecte {
  rawValue: string;
}
interface DetecteurCodes {
  detect: (source: CanvasImageSource) => Promise<CodeDetecte[]>;
}
type FabriqueDetecteur = new (options?: { formats?: string[] }) => DetecteurCodes;

const fabrique = (): FabriqueDetecteur | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { BarcodeDetector?: FabriqueDetecteur };
  return w.BarcodeDetector ?? null;
};

/**
 * Les codes qu'on croise en boutique et en pharmacie : les codes-barres
 * des produits, ceux des cartons, et le petit carré (DataMatrix) des
 * boîtes de médicaments, qui porte aussi le lot et la péremption.
 */
const FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
  "data_matrix",
  "qr_code",
];

let chargement: Promise<FabriqueDetecteur | null> | null = null;
/** Le détecteur du navigateur, ou à défaut celui de la bibliothèque. */
function chargerDetecteur(): Promise<FabriqueDetecteur | null> {
  const natif = fabrique();
  if (natif) return Promise.resolve(natif);
  if (typeof window === "undefined") return Promise.resolve(null);
  chargement ??= (async () => {
    try {
      const [{ BarcodeDetector, prepareZXingModule }, { default: moteur }] = await Promise.all([
        import("barcode-detector/ponyfill"),
        import("zxing-wasm/reader/zxing_reader.wasm?url"),
      ]);
      prepareZXingModule({
        overrides: {
          locateFile: (chemin: string, prefixe: string) =>
            chemin.endsWith(".wasm") ? moteur : prefixe + chemin,
        },
      });
      return BarcodeDetector as unknown as FabriqueDetecteur;
    } catch {
      chargement = null;
      return null;
    }
  })();
  return chargement;
}

interface BoutonScanProps {
  /** Appelé une fois, avec le code lu, dès qu'un code est reconnu. */
  onCode: (code: string) => void;
  /** Ce que le bouton annonce aux lecteurs d'écran. */
  libelle?: string;
  /** Le titre de la fenêtre de scan, pour dire ce qu'on attend. */
  titre?: string;
  /** La classe du bouton, quand un écran veut le sien (la pharmacie : plein, vert). */
  classeBouton?: string;
}

/**
 * Le bouton qui ouvre la caméra pour lire un code-barres.
 *
 * Il ne s'affiche que si le navigateur sait lire un code. Ailleurs, le
 * champ texte à côté reste le seul chemin — et il suffit : une douchette
 * USB ou Bluetooth se comporte comme un clavier, elle tape le code puis
 * Entrée.
 */
export const BoutonScan: React.FC<BoutonScanProps> = ({
  onCode,
  libelle = "Scanner un code-barres",
  titre = "Scanner un code-barres",
  classeBouton = "app-btn-secondary shrink-0 px-3",
}) => {
  const [disponible, setDisponible] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fluxRef = useRef<MediaStream | null>(null);
  const minuterieRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // La détection n'existe qu'au navigateur : la page est rendue d'abord
  // sur le serveur, où `window` n'existe pas.
  useEffect(() => {
    // Une caméra suffit : le détecteur, lui, se charge au premier scan.
    setDisponible(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  const arreter = useCallback(() => {
    if (minuterieRef.current) {
      clearInterval(minuterieRef.current);
      minuterieRef.current = null;
    }
    if (fluxRef.current) {
      fluxRef.current.getTracks().forEach((piste) => piste.stop());
      fluxRef.current = null;
    }
  }, []);

  const fermer = useCallback(() => {
    arreter();
    setOuvert(false);
    setErreur(null);
  }, [arreter]);

  // La caméra ne doit jamais rester allumée derrière l'écran : on la
  // coupe aussi si le composant disparaît pendant que la vue est ouverte.
  useEffect(() => arreter, [arreter]);

  useEffect(() => {
    if (!ouvert) return;
    let annule = false;

    const demarrer = async () => {
      const Detecteur = await chargerDetecteur();
      if (annule) return;
      if (!Detecteur) {
        setErreur(
          "Le lecteur de codes-barres n'a pas pu se charger. Vérifiez la connexion, ou tapez le code à la main.",
        );
        return;
      }
      let detecteur: DetecteurCodes;
      try {
        detecteur = new Detecteur({ formats: FORMATS });
      } catch {
        detecteur = new Detecteur();
      }
      try {
        const flux = await navigator.mediaDevices.getUserMedia({
          // La caméra arrière quand il y en a une : c'est celle qu'on
          // pointe vers l'étiquette.
          video: { facingMode: { ideal: "environment" } },
        });
        if (annule) {
          flux.getTracks().forEach((piste) => piste.stop());
          return;
        }
        fluxRef.current = flux;
        const video = videoRef.current;
        if (video) {
          video.srcObject = flux;
          await video.play().catch(() => undefined);
        }

        let occupe = false;
        minuterieRef.current = setInterval(async () => {
          if (occupe || !videoRef.current) return;
          occupe = true;
          try {
            const trouves = await detecteur.detect(videoRef.current);
            const code = trouves.find((c) => c.rawValue)?.rawValue;
            if (code) {
              arreter();
              setOuvert(false);
              onCode(code.trim());
            }
          } catch {
            // Une image illisible n'est pas une erreur : on réessaie à
            // la suivante, il y en a quatre par seconde.
          } finally {
            occupe = false;
          }
        }, 250);
      } catch (e) {
        const nom = (e as { name?: string }).name;
        setErreur(
          nom === "NotAllowedError"
            ? /; wv\)/.test(navigator.userAgent)
              ? "L'accès à la caméra a été refusé. Autorisez-le dans les réglages du téléphone (Applications › Tantana › Autorisations › Caméra), ou tapez le code à la main."
              : "L'accès à la caméra a été refusé. Autorisez-le dans votre navigateur, ou tapez le code à la main."
            : nom === "NotFoundError"
              ? "Aucune caméra n'a été trouvée sur cet appareil."
              : "La caméra n'a pas pu être ouverte. Tapez le code à la main.",
        );
      }
    };

    demarrer();
    return () => {
      annule = true;
      arreter();
    };
  }, [ouvert, arreter, onCode]);

  if (!disponible) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className={classeBouton}
        aria-label={libelle}
        title={libelle}
      >
        <ScanLine className="h-4 w-4" aria-hidden="true" />
      </button>

      <Modal
        open={ouvert}
        onClose={fermer}
        title={titre}
        description="Présentez l'étiquette devant la caméra. La lecture est automatique."
        size="md"
      >
        {erreur ? (
          <p
            role="alert"
            className="rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm t-danger"
          >
            {erreur}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              className="block max-h-[60vh] w-full object-contain"
              playsInline
              muted
            />
          </div>
        )}
      </Modal>
    </>
  );
};
