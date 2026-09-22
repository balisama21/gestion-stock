import React, { useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { useClicExterieur } from "../../hooks/useClicExterieur";

/**
 * Les trois sorties de la liste affichée.
 *
 * Un seul bouton, et un menu : trois boutons côte à côte au-dessus
 * d'une liste feraient plus de bruit que la liste elle-même, et l'on
 * n'exporte pas dix fois par jour.
 */
export const BoutonsExport: React.FC<{
  combien: number;
  onCsv: () => void;
  onTableur: () => void;
  onPdf: () => void;
}> = ({ combien, onCsv, onTableur, onPdf }) => {
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  useClicExterieur(boite, ouvert, () => setOuvert(false));

  if (combien === 0) return null;

  const choix = [
    { cle: "csv", libelle: "CSV", detail: "S'ouvre partout", action: onCsv },
    { cle: "xlsx", libelle: "Tableur (.xlsx)", detail: "Les montants restent des nombres", action: onTableur },
    {
      cle: "pdf",
      libelle: "PDF groupés (.zip)",
      detail: `Les ${combien} documents, un fichier chacun`,
      action: onPdf,
    },
  ];

  return (
    <div ref={boite} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        className="app-btn-secondary"
      >
        <Download className="h-4 w-4" />
        Exporter
        <ChevronDown className={`h-4 w-4 transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          {choix.map((c) => (
            <button
              key={c.cle}
              type="button"
              role="menuitem"
              onClick={() => {
                setOuvert(false);
                c.action();
              }}
              className="block w-full px-3 py-2 text-left transition-colors hover:bg-muted"
            >
              <span className="block text-sm text-foreground">{c.libelle}</span>
              <span className="block text-xs text-muted-foreground">{c.detail}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
