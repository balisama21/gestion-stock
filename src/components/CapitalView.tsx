import React, { useState } from "react";
import { CapitalSummary, CapitalApport, LocaleSetting } from "../types";
import {
  Wallet,
  PlusCircle,
  ShoppingCart,
  DollarSign,
  ArrowRightLeft,
  Trash2,
  Plus,
  ShieldCheck,
  Building2,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { formatCurrency } from "../utils/formulas";

interface CapitalViewProps {
  capital: CapitalSummary;
  apports: CapitalApport[];
  locale: LocaleSetting;
  onUpdateCapitalInitial: (amount: number) => void;
  onUpdateSeuil: (seuil: number) => void;
  onAddApport: (apport: Omit<CapitalApport, "id">) => void;
  onDeleteApport: (id: string) => void;
  onDownloadExcel?: () => void;
}

export const CapitalView: React.FC<CapitalViewProps> = ({
  capital,
  apports,
  locale,
  onUpdateCapitalInitial,
  onUpdateSeuil,
  onAddApport,
  onDeleteApport,
  onDownloadExcel,
}) => {
  const isNegative = capital.tresorerieGlobaleActuelle < 0;
  const isLow = capital.tresorerieGlobaleActuelle < capital.seuilAlerteTresorerie;

  const [isApportModalOpen, setIsApportModalOpen] = useState(false);
  const [montant, setMontant] = useState<string>("");
  const [source, setSource] = useState<string>("Injection Associé");
  const [note, setNote] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Champs éditables localement, synchronisés avec la valeur serveur,
  // et validés uniquement à la sortie du champ (onBlur) pour éviter
  // une écriture réseau à chaque frappe.
  const [seuilInput, setSeuilInput] = useState<string>(String(capital.seuilAlerteTresorerie));
  const [capitalInitialInput, setCapitalInitialInput] = useState<string>(
    String(capital.capitalInitial),
  );

  React.useEffect(() => {
    setSeuilInput(String(capital.seuilAlerteTresorerie));
  }, [capital.seuilAlerteTresorerie]);

  React.useEffect(() => {
    setCapitalInitialInput(String(capital.capitalInitial));
  }, [capital.capitalInitial]);

  const commitSeuil = () => {
    const num = Number(seuilInput);
    if (!isNaN(num) && num !== capital.seuilAlerteTresorerie) {
      onUpdateSeuil(num);
    } else {
      setSeuilInput(String(capital.seuilAlerteTresorerie));
    }
  };

  const commitCapitalInitial = () => {
    const num = Number(capitalInitialInput);
    if (!isNaN(num) && num !== capital.capitalInitial) {
      onUpdateCapitalInitial(num);
    } else {
      setCapitalInitialInput(String(capital.capitalInitial));
    }
  };

  const handleSubmitApport = (e: React.FormEvent) => {
    e.preventDefault();
    const numMontant = parseFloat(montant);
    if (isNaN(numMontant) || numMontant <= 0) {
      alert("Veuillez saisir un montant d’apport valide.");
      return;
    }

    onAddApport({
      date,
      montant: numMontant,
      source: source.trim() || "Injection Associé",
      note: note.trim(),
    });

    // Reset & close
    setMontant("");
    setNote("");
    setIsApportModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-400" />
            Onglet Capital & Trésorerie Globale
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Calcul unifié de la santé financière de l’entreprise, connecté aux Ventes, Achats,
            Apports et Dépenses Vendeurs.
          </p>
        </div>

        {/* Quick Actions Header Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsApportModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />+ Ajouter un Apport
          </button>

          {onDownloadExcel && (
            <button
              onClick={onDownloadExcel}
              className="flex items-center gap-2 bg-muted hover:bg-accent text-foreground font-semibold px-3.5 py-2.5 rounded-xl text-xs border border-muted-foreground/20 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Exporter Bilan
            </button>
          )}
        </div>
      </div>

      {/* Main Treasury Display Card */}
      <div
        className={`p-6 rounded-2xl border shadow-md relative overflow-hidden transition-all ${
          isNegative
            ? "bg-red-950/40 border-red-500/50"
            : isLow
              ? "bg-amber-950/30 border-amber-500/40"
              : "bg-emerald-950/30 border-emerald-500/30"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Solde de Trésorerie Globale Actuel
            </span>
            <div
              className={`text-3xl md:text-4xl font-black font-mono mt-1 ${
                isNegative ? "text-red-400" : isLow ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {formatCurrency(capital.tresorerieGlobaleActuelle)}
            </div>
            <p className="text-xs text-muted-foreground/80 mt-2">
              {isNegative
                ? "🚨 Attention : La trésorerie est négative ! Les dépenses et achats dépassent les encaissements."
                : isLow
                  ? "⚠️ Attention : Trésorerie sous le seuil minimal d’alerte."
                  : "✅ Trésorerie saine et équilibrée."}
            </p>
          </div>

          <div className="flex flex-col gap-2 min-w-[220px]">
            <label className="text-xs text-muted-foreground font-medium">
              Seuil d'Alerte Trésorerie (Ar) :
            </label>
            <input
              type="number"
              value={seuilInput}
              onChange={(e) => setSeuilInput(e.target.value)}
              onBlur={commitSeuil}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="bg-card border border-muted-foreground/20 rounded-xl px-3.5 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Breakdown Grid (6 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* CARD 1: CAPITAL INITIAL */}
        <div className="bg-card border border-border p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              1. Capital Initial
            </span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-foreground">
            {formatCurrency(capital.capitalInitial)}
          </div>
          <div className="pt-2 border-t border-border">
            <label className="text-[10px] uppercase font-medium text-muted-foreground block mb-1">
              Ajuster le Fond Initial (Ar) :
            </label>
            <input
              type="number"
              value={capitalInitialInput}
              onChange={(e) => setCapitalInitialInput(e.target.value)}
              onBlur={commitCapitalInitial}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-full bg-muted border border-muted-foreground/20 rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* CARD 2: APPORTS EN CAPITAL */}
        <div className="bg-card border border-border p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              2. Apports en Capital
            </span>
            <PlusCircle className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-blue-400">
            + {formatCurrency(capital.apportsTotal)}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-[11px] text-muted-foreground">
              {apports.length} apport(s) enregistré(s)
            </span>
            <button
              onClick={() => setIsApportModalOpen(true)}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg border border-blue-500/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nouveau
            </button>
          </div>
        </div>

        {/* CARD 3: VENTES ENCAISSÉES */}
        <div className="bg-card border border-border p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              3. Ventes Encaissées
            </span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-400">
            + {formatCurrency(capital.ventesTotalEncaisse)}
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
            Montants effectivement payés (exclus les crédits clients non réglés)
          </p>
        </div>

        {/* CARD 4: ACHATS DE STOCK */}
        <div className="bg-card border border-border p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              4. Achats de Stock
            </span>
            <ShoppingCart className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-sky-400">
            - {formatCurrency(capital.achatsTotal)}
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
            Dépenses engagées pour le réassort de marchandises
          </p>
        </div>

        {/* CARD 5: DÉPENSES VENDEURS */}
        <div className="bg-card border border-border p-5 rounded-2xl space-y-3 bg-rose-950/10 border-rose-500/20">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-300">
              5. Dépenses Vendeurs
            </span>
            <ArrowRightLeft className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-rose-400">
            - {formatCurrency(capital.depensesVendeursTotal)}
          </div>
          <p className="text-[11px] text-rose-300/70 pt-2 border-t border-rose-500/20">
            Achats urgents, retraits et frais de terrain enregistrés
          </p>
        </div>

        {/* CARD 6: REPLACED CLEAN RATIOS & FINANCIAL STATUS */}
        <div className="bg-card border border-border p-5 rounded-2xl space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Couverture & Santé
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Trésorerie / Seuil Alerte :</span>
                <span className="font-mono font-bold text-amber-400">
                  {capital.seuilAlerteTresorerie > 0
                    ? `${Math.round(
                        (capital.tresorerieGlobaleActuelle / capital.seuilAlerteTresorerie) * 100,
                      )}%`
                    : "100%"}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Fond propre total (Init + Apports) :</span>
                <span className="font-mono font-bold text-foreground">
                  {formatCurrency(capital.capitalInitial + capital.apportsTotal)}
                </span>
              </div>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-muted/80 border border-muted-foreground/20/60 text-[11px] text-muted-foreground">
            💡 <strong className="text-foreground">Calcul Automatisé :</strong> Trésorerie =
            (Capital Initial + Apports + Ventes) - (Achats + Dépenses).
          </div>
        </div>
      </div>

      {/* APPORTS EN CAPITAL HISTORY TABLE */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-base text-foreground">
              Historique des Apports en Capital
            </h3>
          </div>
          <button
            onClick={() => setIsApportModalOpen(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nouveau Apport
          </button>
        </div>

        {apports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">
            Aucun apport en capital n'a été enregistré pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/80 text-muted-foreground uppercase font-semibold text-[11px] border-b border-muted-foreground/20">
                  <th className="p-3 rounded-tl-xl">Réf / ID</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Source / Investisseur</th>
                  <th className="p-3 text-right">Montant (Ar)</th>
                  <th className="p-3">Note / Motif</th>
                  <th className="p-3 text-center rounded-tr-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {apports.map((app) => (
                  <tr key={app.id} className="hover:bg-muted/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-muted-foreground">{app.id}</td>
                    <td className="p-3 text-muted-foreground">{app.date}</td>
                    <td className="p-3 font-semibold text-blue-400">{app.source}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-400 text-sm">
                      +{formatCurrency(app.montant)}
                    </td>
                    <td className="p-3 text-muted-foreground italic">{app.note || "-"}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Supprimer l'apport de ${formatCurrency(app.montant)} (${app.source}) ?`,
                            )
                          ) {
                            onDeleteApport(app.id);
                          }
                        }}
                        className="p-1.5 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Supprimer cet apport"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL ADD APPORT */}
      {isApportModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                Enregistrer un Apport en Capital
              </h3>
              <button
                onClick={() => setIsApportModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitApport} className="space-y-4 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Montant de l'Apport (Ar) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Ex: 100000"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  className="w-full bg-muted border border-muted-foreground/20 text-foreground rounded-xl px-3.5 py-2 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Source / Investisseur / Associé *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Injection Associé Principal, Prêt, Reserve"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full bg-muted border border-muted-foreground/20 text-foreground rounded-xl px-3.5 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-muted border border-muted-foreground/20 text-foreground rounded-xl px-3.5 py-2 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Note / Motif (Optionnel)
                </label>
                <textarea
                  rows={2}
                  placeholder="Détails supplémentaires..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-muted border border-muted-foreground/20 text-foreground rounded-xl px-3.5 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsApportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-muted text-muted-foreground hover:bg-accent font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-slate-950 font-bold hover:bg-emerald-500 transition-colors shadow-md"
                >
                  Valider Apport
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
