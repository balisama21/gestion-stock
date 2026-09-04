import React, { useState } from "react";
import { CapitalSummary, CapitalApport, LocaleSetting } from "../types";
import {
  Wallet,
  PlusCircle,
  Trash2,
  Plus,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
} from "lucide-react";
import { formatCurrency, formatDateLocale } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import { StatCol } from "./shared/StatBar";
import { DataList } from "./shared/DataList";
import { Modal } from "./shared/Modal";

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

  /**
   * Les cinq postes qui composent la trésorerie disponible, dans l'ordre
   * du calcul. Aucune ligne n'est masquée quand elle vaut zéro : c'est un
   * état financier, et une ligne absente casserait l'addition que le
   * lecteur refait de tête jusqu'au total.
   */
  const composition: {
    key: string;
    label: string;
    hint?: string;
    sign: "+" | "−";
    value: number;
  }[] = [
    {
      key: "initial",
      label: "Capital initial",
      hint: "Fonds de départ de la boutique",
      sign: "+",
      value: capital.capitalInitial,
    },
    {
      key: "apports",
      label: "Apports en capital",
      hint: apports.length > 0 ? `${apports.length} apport${apports.length > 1 ? "s" : ""}` : undefined,
      sign: "+",
      value: capital.apportsTotal,
    },
    {
      key: "ventes",
      label: "Ventes encaissées",
      hint: "Hors crédits clients non réglés",
      sign: "+",
      value: capital.ventesTotalEncaisse,
    },
    {
      key: "achats",
      label: "Achats de stock",
      hint: "Réassort de marchandises",
      sign: "−",
      value: capital.achatsTotal,
    },
    {
      key: "depenses",
      label: "Dépenses vendeurs",
      hint: "Retraits et frais de terrain",
      sign: "−",
      value: capital.depensesVendeursTotal,
    },
  ];

  const couverture =
    capital.seuilAlerteTresorerie > 0
      ? `${Math.round((capital.tresorerieGlobaleActuelle / capital.seuilAlerteTresorerie) * 100)} %`
      : "100 %";

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={<Wallet className="h-5 w-5 text-muted-foreground" />}
        title="Capital & trésorerie"
        subtitle="Ce qu'il vous reste en caisse, et le détail de ce qui l'a fait monter ou descendre."
        actions={
          <>
            {onDownloadExcel && (
              <button onClick={onDownloadExcel} className="app-btn-secondary w-full sm:w-auto">
                <FileSpreadsheet className="h-4 w-4" />
                Exporter
              </button>
            )}
            <button
              onClick={() => setIsApportModalOpen(true)}
              className="app-btn-primary w-full sm:w-auto"
            >
              <PlusCircle className="h-4 w-4" />
              Ajouter un apport
            </button>
          </>
        }
      />

      {/* Trésorerie disponible.
          Le bloc de fond coloré a disparu : c'est un filet à gauche et un
          badge de statut qui portent l'alerte, le reste de la carte reste
          blanc comme partout ailleurs. */}
      <div
        className={`app-card border-l-2 p-4 sm:p-5 ${
          isNegative ? "border-l-danger" : isLow ? "border-l-warning" : "border-l-primary"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Trésorerie disponible
            </div>
            <div
              className={`font-mono text-2xl font-semibold tabular-nums ${
                isNegative ? "t-danger" : "text-foreground"
              }`}
            >
              {formatCurrency(capital.tresorerieGlobaleActuelle)}
            </div>
          </div>

          <span
            className={`app-badge ${
              isNegative
                ? "app-badge-danger"
                : isLow
                  ? "app-badge-warning"
                  : "app-badge-success"
            }`}
          >
            {isNegative ? "Négative" : isLow ? "Sous le seuil" : "Saine"}
          </span>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {isNegative
            ? "Les dépenses et les achats dépassent les encaissements."
            : isLow
              ? `En dessous de votre seuil d'alerte, fixé à ${formatCurrency(capital.seuilAlerteTresorerie)}.`
              : "Au-dessus de votre seuil d'alerte."}
        </p>
      </div>

      {/* Composition de la trésorerie.
          Les six cartes chiffrées de l'ancienne grille ne disaient pas
          comment elles s'enchaînaient. Posées en état financier signé, du
          premier poste jusqu'au total, le calcul se lit tout seul. */}
      <div className="app-card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h3 className="app-section-title">
            <Wallet className="h-4 w-4" />
            Composition
          </h3>
        </div>

        <div className="divide-y divide-border">
          {composition.map((l) => (
            <div key={l.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="app-list-primary block">{l.label}</span>
                {l.hint && <span className="app-list-secondary block">{l.hint}</span>}
              </span>
              <span className="app-list-amount">
                {l.sign} {formatCurrency(l.value)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-3">
          <span className="text-sm font-medium text-foreground">Trésorerie disponible</span>
          <span
            className={`font-mono text-base font-semibold tabular-nums ${
              isNegative ? "t-danger" : "text-foreground"
            }`}
          >
            {formatCurrency(capital.tresorerieGlobaleActuelle)}
          </span>
        </div>
      </div>

      {/* Deux lectures de solidité, sorties de la carte « Couverture &
          santé » qui mélangeait indicateurs et rappel de formule. */}
      <div className="app-statbar grid-cols-1 sm:grid-cols-2">
        <StatCol
          label="Fonds propres"
          value={formatCurrency(capital.capitalInitial + capital.apportsTotal)}
          hint="Capital initial + apports"
          icon={<Building2 className="h-3.5 w-3.5" />}
        />
        <StatCol
          label="Couverture du seuil"
          value={couverture}
          hint={`Seuil fixé à ${formatCurrency(capital.seuilAlerteTresorerie)}`}
          alert={isLow}
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Réglages.
          Le fond initial et le seuil d'alerte étaient dispersés, l'un au
          fond d'une carte d'indicateur, l'autre dans le bandeau. Ce sont
          deux paramètres et non deux chiffres : ils sont réunis. */}
      <div className="app-card p-4 sm:p-5">
        <h3 className="app-section-title mb-3">Réglages</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Capital initial (Ar)
            </label>
            <input
              type="number"
              value={capitalInitialInput}
              onChange={(e) => setCapitalInitialInput(e.target.value)}
              onBlur={commitCapitalInitial}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="app-field font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Le fond que vous aviez avant la première vente.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
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
              className="app-field font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              En dessous, la trésorerie est signalée comme basse.
            </p>
          </div>
        </div>
      </div>

      {/* Historique des apports — un registre : qui a remis de l'argent,
          quand, et pourquoi. Le motif complet s'ouvre au clic. */}
      <div className="app-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="app-section-title">
            <Building2 className="h-4 w-4" />
            Apports en capital
          </h3>
          <button
            onClick={() => setIsApportModalOpen(true)}
            className="app-btn-secondary w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Nouvel apport
          </button>
        </div>

        <DataList
          emptyLabel="Aucun apport enregistré pour le moment."
          items={apports.map((app) => ({
            id: app.id,
            primary: app.source,
            meta: [formatDateLocale(app.date, locale), app.note || null],
            amount: `+ ${formatCurrency(app.montant)}`,
            detailTitle: app.source,
            detailSubtitle: `Apport du ${formatDateLocale(app.date, locale)}`,
            details: [
              { label: "Date", value: formatDateLocale(app.date, locale) },
              { label: "Source", value: app.source },
              { label: "Montant", value: formatCurrency(app.montant) },
              { label: "Note", value: app.note || "", hideIfEmpty: true },
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
                className="app-btn-danger sm:flex-none"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            ),
          }))}
        />
      </div>

      {/* ── Nouvel apport ── */}
      <Modal
        open={isApportModalOpen}
        onClose={() => setIsApportModalOpen(false)}
        size="md"
        icon={<PlusCircle className="h-4 w-4" />}
        title="Enregistrer un apport"
        description="De l'argent injecté dans la boutique en dehors des ventes."
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsApportModalOpen(false)}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button type="submit" form="apport-form" className="app-btn-primary">
              Valider l'apport
            </button>
          </>
        }
      >
        <form id="apport-form" onSubmit={handleSubmitApport} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Montant de l'apport (Ar) *
            </label>
            <input
              type="number"
              required
              min="1"
              placeholder="Ex : 100000"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className="app-field font-mono"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Source *
            </label>
            <input
              type="text"
              required
              placeholder="Ex : injection associé, prêt, réserve"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="app-field"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="app-field font-mono"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Note (optionnel)
            </label>
            <textarea
              rows={2}
              placeholder="Motif, détails supplémentaires..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="app-field"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
