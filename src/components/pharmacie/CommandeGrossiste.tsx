import React, { useMemo, useState } from "react";
import { ClipboardCopy, ClipboardList, PackagePlus, Printer, Trash2 } from "lucide-react";
import type { Product } from "../../types";
import { Modal } from "../shared/Modal";
import { imprimerFeuille } from "../../features/documents/lib/imprimer";

export interface LigneCommande {
  produit: Product;
  quantite: number;
}

/** Ce qu'il faut commander : de quoi remonter à deux fois le seuil, au moins le seuil. */
export const quantiteSuggeree = (p: Product, disponible = p.stockActuel) =>
  Math.max(p.seuilAlerte, p.seuilAlerte * 2 - Math.max(0, disponible), 1);

/**
 * LA COMMANDE AU GROSSISTE
 *
 * Ce qui manque ou va manquer, avec une quantité proposée qu'on ajuste.
 * Elle s'imprime, ou se copie pour l'envoyer par message ; à la
 * livraison, elle devient une réception d'un geste — il ne reste qu'à
 * écrire les lots et les dates.
 */
export const CommandeGrossiste: React.FC<{
  storeName: string;
  products: Product[];
  fournisseurs: string[];
  disponibles?: Map<string, number>;
  onFermer: () => void;
  onRecevoir: (lignes: LigneCommande[], fournisseur: string) => void;
}> = ({ storeName, products, fournisseurs, disponibles, onFermer, onRecevoir }) => {
  const stockDe = (p: Product) => disponibles?.get(p.id) ?? p.stockActuel;
  const proposes = useMemo(
    () =>
      products
        .filter(
          (p) =>
            p.statut !== "archive" &&
            p.typeProduit !== "service" &&
            (disponibles?.get(p.id) ?? p.stockActuel) <= p.seuilAlerte,
        )
        .sort(
          (a, b) =>
            (disponibles?.get(a.id) ?? a.stockActuel) - (disponibles?.get(b.id) ?? b.stockActuel),
        ),
    [products, disponibles],
  );
  const [lignes, setLignes] = useState<{ produit: Product; quantite: string }[]>(() =>
    proposes.map((p) => ({ produit: p, quantite: String(quantiteSuggeree(p, stockDe(p))) })),
  );
  const [fournisseur, setFournisseur] = useState(fournisseurs[0] ?? "");
  const [copie, setCopie] = useState(false);

  const valides = lignes
    .map((l) => ({ produit: l.produit, quantite: parseInt(l.quantite, 10) }))
    .filter((l) => Number.isFinite(l.quantite) && l.quantite > 0);
  const date = new Date().toLocaleDateString("fr-FR");

  const texte = [
    `Commande ${storeName} · ${date}`,
    fournisseur ? `À : ${fournisseur}` : null,
    "",
    ...valides.map((l) => `- ${l.produit.displayName} × ${l.quantite}`),
  ]
    .filter((x) => x !== null)
    .join("\n");

  return (
    <Modal
      open
      onClose={onFermer}
      size="2xl"
      icon={<ClipboardList className="h-4 w-4" />}
      title="Commande au grossiste"
      description="Les ruptures et stocks faibles, hors unités périmées, avec une quantité proposée. Ajustez, puis imprimez ou envoyez."
      footer={
        <>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(texte);
                setCopie(true);
              } catch {
                setCopie(false);
              }
            }}
            disabled={valides.length === 0}
            className="app-btn-secondary"
          >
            <ClipboardCopy className="h-4 w-4" />
            {copie ? "Copiée" : "Copier le texte"}
          </button>
          <button
            type="button"
            onClick={() => imprimerFeuille()}
            disabled={valides.length === 0}
            className="app-btn-secondary"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          <button
            type="button"
            onClick={() => onRecevoir(valides, fournisseur)}
            disabled={valides.length === 0}
            className="app-btn-primary"
          >
            <PackagePlus className="h-4 w-4" />
            Recevoir la livraison
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {/* Ce qui sort sur le papier. */}
        <div className="hidden print:block">
          <div className="printable-receipt p-[12mm] text-[11pt] text-black">
            <p className="text-[15pt] font-bold">Bon de commande · {storeName}</p>
            <p>
              {date}
              {fournisseur ? ` · ${fournisseur}` : ""}
            </p>
            <table className="mt-4 w-full border-collapse">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="py-1">Médicament</th>
                  <th className="py-1 text-right">Quantité</th>
                </tr>
              </thead>
              <tbody>
                {valides.map((l) => (
                  <tr key={l.produit.id} className="border-b border-gray-300">
                    <td className="py-1">{l.produit.displayName}</td>
                    <td className="py-1 text-right">{l.quantite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Grossiste</span>
          <input
            list="grossistes-commande"
            value={fournisseur}
            onChange={(e) => setFournisseur(e.target.value)}
            className="app-field"
            placeholder="Nom du grossiste"
          />
          <datalist id="grossistes-commande">
            {fournisseurs.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </label>
        {lignes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Rien n&apos;est sous son seuil d&apos;alerte.
          </p>
        ) : (
          <ul className="ph-liste rounded-xl border border-border">
            {lignes.map((l, i) => (
              <li
                key={l.produit.id}
                className="ph-ligne"
                data-ton={stockDe(l.produit) <= 0 ? "danger" : "warning"}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{l.produit.displayName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {stockDe(l.produit) <= 0 ? "Rupture" : `${stockDe(l.produit)} hors périmés`} ·
                    seuil {l.produit.seuilAlerte}
                  </span>
                </span>
                <input
                  inputMode="numeric"
                  value={l.quantite}
                  onChange={(e) =>
                    setLignes((ls) =>
                      ls.map((x, j) => (j === i ? { ...x, quantite: e.target.value } : x)),
                    )
                  }
                  className="app-field w-20 text-right"
                  aria-label={`Quantité de ${l.produit.displayName}`}
                />
                <button
                  type="button"
                  onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}
                  className="rounded-lg p-2 text-muted-foreground hover:t-danger"
                  aria-label={`Retirer ${l.produit.displayName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
};
