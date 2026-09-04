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
import { PageHeader } from "./shared/PageHeader";
import { MobileCardList } from "./shared/MobileCardList";

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
      <PageHeader
        icon={<Wallet className="w-5 h-5 t-success" />}
        title="Capital & trésorerie"
        subtitle="La santé financière de votre boutique, calculée à partir de vos ventes, achats, apports et dépenses."
        actions={
          <>
            {onDownloadExcel && (
              <button onClick={onDownloadExcel} className="app-btn-secondary w-full sm:w-auto">
                <FileSpreadsheet className="w-4 h-4" />
                Exporter
              </button>
            )}
            <button
              onClick={() => setIsApportModalOpen(true)}
              className="app-btn-primary w-full sm:w-auto"
            >
              <PlusCircle className="w-4 h-4" />
              Ajouter un apport
            </button>
          </>
        }
      />

      {/* Solde principal — les fonds sont pris dans la palette sémantique
          plutôt que dans des nuances -950 pensées pour le mode sombre,
          qui donnaient un bloc presque noir en mode clair. */}
      <div
        className={`app-card relative overflow-hidden p-4 sm:p-6 ${
          isNegative
            ? "border-danger-border bg-danger-soft"
            : isLow
              ? "border-warning-border bg-warning-soft"
              : "border-success-border bg-success-soft"
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Trésorerie disponible
            </span>
            <div
              className={`mt-1 font-mono text-3xl font-black tabular-nums sm:text-4xl ${
                isNegative ? "t-danger" : isLow ? "t-warning" : "t-success"
              }`}
            >
              {formatCurrency(capital.tresorerieGlobaleActuelle)}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {isNegative
                ? "Trésorerie négative : les dépenses et achats dépassent les encaissements."
                : isLow
                  ? "Trésorerie sous votre seuil d'alerte."
                  : "Trésorerie saine."}
            </p>
          </div>

          <div className="flex w-full flex-col gap-1.5 sm:w-56">
            <label className="text-xs font-medium text-muted-foreground">
              Seuil d'alerte (Ar)
            </label>
            <input
              type="number"
              value={seuilInput}
              onChange={(e) => setSeuilInput(e.target.value)}
              onBlur={commitSeuil}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="app-field bg-card font-mono"
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
            <Wallet className="w-4 h-4 t-success" />
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
            <PlusCircle className="w-4 h-4 t-info" />
          </div>
          <div className="text-2xl font-extrabold font-mono t-info">
            + {formatCurrency(capital.apportsTotal)}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-[11px] text-muted-foreground">
              {apports.length} apport(s) enregistré(s)
            </span>
            <button
              onClick={() => setIsApportModalOpen(true)}
              className="text-xs font-bold t-info hover:t-info flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg border border-blue-500/30 transition-colors"
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
            <DollarSign className="w-4 h-4 t-success" />
          </div>
          <div className="text-2xl font-extrabold font-mono t-success">
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
            <ShoppingCart className="w-4 h-4 t-info" />
          </div>
          <div className="text-2xl font-extrabold font-mono t-info">
            - {formatCurrency(capital.achatsTotal)}
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
            Dépenses engagées pour le réassort de marchandises
          </p>
        </div>

        {/* CARD 5: DÉPENSES VENDEURS */}
        <div className="bg-card border border-border p-5 rounded-2xl space-y-3 bg-danger-soft border-danger-border">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider t-danger">
              5. Dépenses Vendeurs
            </span>
            <ArrowRightLeft className="w-4 h-4 t-danger" />
          </div>
          <div className="text-2xl font-extrabold font-mono t-danger">
            - {formatCurrency(capital.depensesVendeursTotal)}
          </div>
          <p className="text-[11px] t-danger/70 pt-2 border-t border-rose-500/20">
            Achats urgents, retraits et frais de terrain enregistrés
          </p>
        </div>

        {/* CARD 6: REPLACED CLEAN RATIOS & FINANCIAL STATUS */}
        <div className="bg-card border border-border p-5 rounded-2xl space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider t-warning flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 t-warning" />
                Couverture & Santé
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Trésorerie / Seuil Alerte :</span>
                <span className="font-mono font-bold t-warning">
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
          <div className="p-2.5 rounded-xl bg-muted/80 border border-border text-[11px] text-muted-foreground">
            💡 <strong className="text-foreground">Calcul Automatisé :</strong> Trésorerie =
            (Capital Initial + Apports + Ventes) - (Achats + Dépenses).
          </div>
        </div>
      </div>

      {/* Historique des apports */}
      <div className="app-card space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Building2 className="w-5 h-5 t-info shrink-0" />
            <h3 className="truncate text-base font-bold text-foreground">Apports en capital</h3>
          </div>
          <button
            onClick={() => setIsApportModalOpen(true)}
            className="app-btn-secondary w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Nouvel apport
          </button>
        </div>

        {/* Liste mobile — remplace le tableau sous 1024px */}
        <div className="lg:hidden">
          <MobileCardList
            emptyLabel="Aucun apport enregistré pour le moment."
            items={apports.map((app) => ({
              id: app.id,
              title: app.source,
              subtitle: app.date,
              amount: `+${formatCurrency(app.montant)}`,
              amountTone: "success" as const,
              fields: [
                { label: "Date", value: app.date },
                { label: "Source", value: app.source },
                { label: "Note", value: app.note || "-", hideIfEmpty: true },
              ],
              actions: (
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
                  className="app-btn-danger flex-1 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer
                </button>
              ),
            }))}
          />
        </div>

        {apports.length === 0 ? (
          <div className="hidden py-8 text-center text-xs text-muted-foreground lg:block">
            Aucun apport enregistré pour le moment.
          </div>
        ) : (
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/80 text-[11px] font-semibold uppercase text-muted-foreground">
                  <th className="p-3">Date</th>
                  <th className="p-3">Source</th>
                  <th className="p-3 text-right">Montant</th>
                  <th className="p-3">Note</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {apports.map((app) => (
                  <tr key={app.id} className="transition-colors hover:bg-muted/40">
                    <td className="p-3 text-muted-foreground">{app.date}</td>
                    <td className="p-3 font-semibold t-info">{app.source}</td>
                    <td className="p-3 text-right font-mono text-sm font-bold t-success">
                      +{formatCurrency(app.montant)}
                    </td>
                    <td className="p-3 italic text-muted-foreground">{app.note || "-"}</td>
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
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
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
                <PlusCircle className="w-5 h-5 t-success" />
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
