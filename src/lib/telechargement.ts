type Commande = { id: string; action: string; nom?: string; taille?: number; donnees?: string };
declare global {
  interface Window {
    tantanaExport?: (commande: Commande) => void;
  }
}

const estApk = () => / TantanaAndroid(?:Essai)?\//.test(navigator.userAgent);
const tailleBloc = 48 * 1024;
let file = Promise.resolve();

async function enregistrerAndroid(blob: Blob, nom: string) {
  if (!window.tantanaExport) {
    if (!navigator.userAgent.includes("TantanaExport/1"))
      throw new Error("Mettez à jour l’application Android pour enregistrer ce fichier.");
    await new Promise<void>((resolve, reject) => {
      const pret = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        window.removeEventListener("tantana-rappels-pret", pret);
        reject(new Error("Android est indisponible. Rouvrez l’application et réessayez."));
      }, 10000);
      window.addEventListener("tantana-rappels-pret", pret, { once: true });
    });
  }
  const envoyer = window.tantanaExport!;
  const id = crypto.getRandomValues(new Uint32Array(4)).join("-");
  const commande = (action: string, champs: Partial<Commande> = {}) =>
    new Promise<void>((resolve, reject) => {
      const finir = (erreur?: string) => {
        clearTimeout(timer);
        window.removeEventListener("tantana-export-reponse", recevoir);
        if (erreur) reject(new Error(erreur));
        else resolve();
      };
      const recevoir = (e: Event) => {
        const reponse = (e as CustomEvent<{ id: string; erreur?: string }>).detail;
        if (reponse.id === id) finir(reponse.erreur);
      };
      // L’utilisateur peut prendre son temps dans le sélecteur Android.
      const timer =
        action === "terminer"
          ? undefined
          : setTimeout(() => finir("Le transfert vers Android a été interrompu."), 30000);
      window.addEventListener("tantana-export-reponse", recevoir);
      try {
        envoyer({ id, action, ...champs });
      } catch {
        finir("Le transfert vers Android a été interrompu.");
      }
    });
  try {
    await commande("debut", { nom, taille: blob.size });
    for (let i = 0; i < blob.size; i += tailleBloc) {
      const octets = new Uint8Array(await blob.slice(i, i + tailleBloc).arrayBuffer());
      await commande("bloc", { donnees: btoa(String.fromCharCode(...octets)) });
    }
    await commande("terminer");
  } catch (error) {
    envoyer({ id, action: "abandon" });
    throw error;
  }
}

export function telechargerBlob(blob: Blob, nom: string): Promise<void> {
  if (estApk()) {
    const transfert = file.then(() => enregistrerAndroid(blob, nom));
    file = transfert.catch(() => {});
    return transfert;
  }
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return Promise.resolve();
}

export async function sauverPdf(doc: import("jspdf").jsPDF, nom: string) {
  if (estApk()) await telechargerBlob(doc.output("blob"), nom);
  else doc.save(nom);
}

export async function sauverClasseur(
  XLSX: typeof import("xlsx"),
  classeur: import("xlsx").WorkBook,
  nom: string,
) {
  if (!estApk()) {
    XLSX.writeFile(classeur, nom);
    return;
  }
  const contenu = XLSX.write(classeur, { bookType: "xlsx", type: "array" });
  await telechargerBlob(
    new Blob([contenu], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    nom,
  );
}
