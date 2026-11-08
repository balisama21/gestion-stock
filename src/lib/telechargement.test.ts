// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";
import { sauverPdf, telechargerBlob } from "./telechargement";

function appareil(refuser = false) {
  const fenetre = new EventTarget() as EventTarget & Pick<Window, "tantanaExport">;
  vi.stubGlobal("window", fenetre);
  vi.stubGlobal("navigator", { userAgent: "wv TantanaAndroid/2 TantanaExport/1" });
  const fichiers: { nom: string; blocs: Uint8Array[]; taille: number }[] = [];
  const abandons: string[] = [];
  fenetre.tantanaExport = (c) => {
    if (c.action === "abandon") {
      abandons.push(c.id);
      return;
    }
    if (c.action === "debut") fichiers.push({ nom: c.nom!, blocs: [], taille: c.taille! });
    if (c.action === "bloc") fichiers.at(-1)!.blocs.push(Buffer.from(c.donnees!, "base64"));
    const erreur = refuser && c.action === "terminer" ? "Enregistrement annulé." : undefined;
    queueMicrotask(() =>
      fenetre.dispatchEvent(
        new CustomEvent("tantana-export-reponse", {
          detail: { id: c.id, erreur },
        }),
      ),
    );
  };
  return { fichiers, abandons };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it("transmet le PDF généré et les octets d’une image sur le canal Android, dans l’ordre", async () => {
  const { fichiers } = appareil();
  const doc = new jsPDF();
  doc.text("Facture de test", 10, 20);
  const pdf = Buffer.from(doc.output("arraybuffer"));
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKZkAAAAASUVORK5CYII=",
    "base64",
  );
  await Promise.all([
    sauverPdf(doc, "facture.pdf"),
    telechargerBlob(new Blob([image]), "facture.png"),
  ]);
  expect(fichiers.map((f) => f.nom)).toEqual(["facture.pdf", "facture.png"]);
  expect(Buffer.concat(fichiers[0].blocs)).toEqual(pdf);
  expect(Buffer.concat(fichiers[1].blocs)).toEqual(image);
});

it("conserve tous les octets d’un export sur plusieurs blocs", async () => {
  const { fichiers } = appareil();
  const octets = Uint8Array.from({ length: 129456 }, (_, i) => i % 251);
  await telechargerBlob(new Blob([octets]), "documents.zip");
  expect(fichiers[0].taille).toBe(octets.length);
  expect(fichiers[0].blocs.length).toBeGreaterThan(1);
  expect(Buffer.concat(fichiers[0].blocs).equals(Buffer.from(octets))).toBe(true);
});

it("signale l’annulation du sélecteur et libère le transfert suivant", async () => {
  const { abandons } = appareil(true);
  await expect(telechargerBlob(new Blob(["a"]), "a.csv")).rejects.toThrow("annulé");
  await expect(telechargerBlob(new Blob(["b"]), "b.csv")).rejects.toThrow("annulé");
  expect(abandons).toHaveLength(2);
});

it("conserve le téléchargement PDF du navigateur", async () => {
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 Chrome" });
  const doc = new jsPDF();
  const save = vi.spyOn(doc, "save").mockReturnValue(doc);
  await sauverPdf(doc, "facture.pdf");
  expect(save).toHaveBeenCalledWith("facture.pdf");
});
