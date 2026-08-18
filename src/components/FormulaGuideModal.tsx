import React from "react";
import { LocaleSetting } from "../types";
import { Table2, X, Globe2, Check, Copy } from "lucide-react";
import { convertFormulaLocale } from "../utils/formulas";

interface FormulaGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: LocaleSetting;
  setLocale: (locale: LocaleSetting) => void;
}

export const FormulaGuideModal: React.FC<FormulaGuideModalProps> = ({
  isOpen,
  onClose,
  locale,
  setLocale,
}) => {
  if (!isOpen) return null;

  const formulasList = [
    {
      tab: "Capital",
      cell: "B8 (Trésorerie Globale)",
      description: "Calcul unifié de la Trésorerie Globale avec Dépenses Vendeurs (Demande 4)",
      formulaUS:
        "=B2 + B3 + SUM(Apports!C:C) + SUM(Ventes!P:P) - SUM(Achats!G:G) - SUM(Dépenses!D:D)",
    },
    {
      tab: "Vendeurs",
      cell: "C2 (Total Ventes Vendeur)",
      description: "Total des ventes réalisées par ce vendeur spécifique (Demande 3)",
      formulaUS: "=SUMIFS(Ventes!F:F, Ventes!N:N, B2)",
    },
    {
      tab: "Vendeurs",
      cell: "D2 (Nb Ventes Vendeur)",
      description: "Nombre de ventes conclues par le vendeur (Demande 3)",
      formulaUS: "=COUNTIFS(Ventes!N:N, B2)",
    },
    {
      tab: "Vendeurs",
      cell: "E2 (Total Dépenses Vendeur)",
      description: "Total des retraits et dépenses effectués par ce vendeur (Demande 4)",
      formulaUS: "=SUMIFS(Dépenses!D:D, Dépenses!B:B, B2)",
    },
    {
      tab: "Vendeurs",
      cell: 'F2 (Solde Net "Dans la poche")',
      description: "Argent net actuellement en possession du vendeur",
      formulaUS: "=C2 - E2",
    },
    {
      tab: "Ventes",
      cell: "E2 (Prix Vente Unit. Saisi)",
      description: "Cellule de SAISIE LIBRE (Demande 2) préremplie depuis Produits!E",
      formulaUS: "[Cellule Numérique Libre / Pas de Formule Figée]",
    },
    {
      tab: "Ventes",
      cell: "F2 (Total Vente)",
      description: "Total Vente calculé à partir du Prix Saisi Manuellement en E2",
      formulaUS: '=IF(D2<>""; D2*E2; "")',
    },
    {
      tab: "Ventes",
      cell: "I2 (Marge Totale)",
      description: "Marge réalisée d’après le prix négocié saisi",
      formulaUS: '=IF(F2<>""; F2 - H2; "")',
    },
    {
      tab: "Ventes",
      cell: "Q2 (Solde Dû Crédit)",
      description: "Reste à payer par le client si vente à crédit",
      formulaUS: '=IF(F2<>""; F2 - P2; "")',
    },
    {
      tab: "Ventes",
      cell: "R2 (Statut Crédit)",
      description: "Statut du paiement : Payé, Partiel ou Impayé",
      formulaUS: '=IF(Q2=0, "Payé", IF(Q2=F2, "Impayé", "Partiel"))',
    },
    {
      tab: "Dépenses",
      cell: "Impact Trésorerie",
      description: "Répercuté dynamiquement sur Capital!B8 et Vendeurs!F2",
      formulaUS: "[Montant saisi en colonne D impactant les 2 onglets]",
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-4xl p-6 shadow-2xl text-foreground my-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Table2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Guide des Formules Réparées & Converties
              </h3>
              <p className="text-xs text-muted-foreground">
                Formules compatibles avec les paramètres régionaux France (Sépardeur point-virgule
                ;) ou États-Unis (virgule ,).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Locale Toggle inside modal */}
        <div className="flex items-center justify-between bg-muted/80 p-3 rounded-xl border border-muted-foreground/20">
          <span className="text-xs font-semibold text-muted-foreground">
            Format d'affichage des formules :
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocale("FR")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                locale === "FR" ? "bg-emerald-600 text-white" : "bg-accent text-muted-foreground"
              }`}
            >
              🇫🇷 France (Points-virgules ;)
            </button>
            <button
              onClick={() => setLocale("US")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                locale === "US" ? "bg-blue-600 text-white" : "bg-accent text-muted-foreground"
              }`}
            >
              🇺🇸 USA (Virgules ,)
            </button>
          </div>
        </div>

        {/* Formulas Table */}
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-muted/80 border-b border-muted-foreground/20 text-muted-foreground font-semibold">
                  <th className="p-3">Onglet</th>
                  <th className="p-3">Cellule / Rôle</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Formule Générée ({locale})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {formulasList.map((f, i) => (
                  <tr key={i} className="hover:bg-muted/40">
                    <td className="p-3 font-bold text-emerald-400">{f.tab}</td>
                    <td className="p-3 font-mono font-semibold text-sky-300">{f.cell}</td>
                    <td className="p-3 text-muted-foreground text-[11px]">{f.description}</td>
                    <td className="p-3 font-mono font-bold text-amber-300 bg-card/60">
                      {convertFormulaLocale(f.formulaUS, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
