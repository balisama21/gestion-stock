import React, { useMemo, useState } from "react";
import { Check, Loader2, Plus, Receipt, Trash2, Undo2, Wallet, X } from "lucide-react";
import { PageHeader } from "./shared/PageHeader";
import { StatBar } from "./shared/StatBar";
import { Modal } from "./shared/Modal";
import { SelecteurPersonne } from "./shared/SelecteurPersonne";
import { SelecteurListe } from "./shared/SelecteurListe";
import type { Personne } from "../lib/personnes";
import type { LocaleSetting } from "../types";
import { formatDateLocale } from "../utils/formulas";
import {
  ficheDevise,
  formaterMontant,
  formaterTaux,
  type Devise,
  type DeviseBoutique,
} from "../lib/devises";
import type { NoteDeFrais, SaisieNoteDeFrais } from "../hooks/useNotesDeFrais";
import { useDevises } from "../hooks/useDevises";

type Statut = NoteDeFrais["statut"];
type Filtre = "toutes" | Statut;
type Resultat = Promise<{ error: string | null }>;

const STATUTS: Record<string, { libelle: string; badge: string }> = {
  a_valider: { libelle: "À valider", badge: "app-badge-warning" },
  validee: { libelle: "Validée", badge: "app-badge-info" },
  remboursee: { libelle: "Remboursée", badge: "app-badge-success" },
  refusee: { libelle: "Refusée", badge: "app-badge-danger" },
};

const aujourdhui = () => new Date().toISOString().slice(0, 10);

interface Props {
  notes: NoteDeFrais[];
  peutGerer: boolean;
  moiId: string | null;
  monNom: string;
  locale: LocaleSetting;
  catalogue: Devise[];
  devises: DeviseBoutique[];
  principale: string;
  postes: { id: string; nom: string }[];
  personnes: Personne[];
  onCreerPersonne?: React.ComponentProps<typeof SelecteurPersonne>["onCreer"];
  onCreerPoste?: (nom: string) => Promise<{ id: string | null; error: string | null }>;
  onCreer: (s: SaisieNoteDeFrais) => Resultat;
  onModifier: (id: string, s: Partial<SaisieNoteDeFrais>) => Resultat;
  onSupprimer: (id: string) => Resultat;
  onDecider: (id: string, d: "validee" | "refusee" | "a_valider", motif?: string) => Resultat;
  onRembourser: (id: string, date: string) => Resultat;
}

export const NotesDeFraisView: React.FC<Props> = (p) => {
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [edition, setEdition] = useState<NoteDeFrais | "nouvelle" | null>(null);
  const [detail, setDetail] = useState<NoteDeFrais | null>(null);

  const fichePrincipale = ficheDevise(p.catalogue, p.principale);
  const fmt = (n: number) => formaterMontant(n, fichePrincipale);
  const nomPoste = (id: string | null) => p.postes.find((x) => x.id === id)?.nom;

  const somme = (s: Statut) =>
    p.notes.filter((n) => n.statut === s).reduce((t, n) => t + Number(n.montant_converti), 0);
  const nb = (s: Statut) => p.notes.filter((n) => n.statut === s).length;
  const mois = aujourdhui().slice(0, 7);
  const rembourseMois = p.notes
    .filter((n) => n.statut === "remboursee" && (n.rembourse_le ?? "").startsWith(mois))
    .reduce((t, n) => t + Number(n.montant_converti), 0);

  const visibles = filtre === "toutes" ? p.notes : p.notes.filter((n) => n.statut === filtre);
  const detailFrais = detail ? (p.notes.find((n) => n.id === detail.id) ?? null) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Receipt className="w-5 h-5 t-success" />}
        module="notes_frais"
        title="Notes de frais"
        subtitle={
          p.peutGerer
            ? "Les dépenses avancées par l'équipe, à valider puis rembourser."
            : "Déclarez ce que vous avez payé de votre poche pour la boutique."
        }
        actions={
          <button type="button" onClick={() => setEdition("nouvelle")} className="app-btn-primary">
            <Plus className="h-4 w-4" />
            Nouvelle note
          </button>
        }
      />

      <StatBar
        className="sm:grid-cols-3 xl:grid-cols-3"
        items={[
          {
            key: "av",
            label: "À valider",
            value: fmt(somme("a_valider")),
            hint: `${nb("a_valider")} note(s) en attente`,
          },
          {
            key: "va",
            label: "À rembourser",
            value: fmt(somme("validee")),
            hint: `${nb("validee")} note(s) validée(s)`,
          },
          {
            key: "rm",
            label: "Remboursé ce mois",
            value: fmt(rembourseMois),
            hint: "Sorti de la caisse",
          },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {(["toutes", "a_valider", "validee", "remboursee", "refusee"] as Filtre[]).map((f) => {
          const count = f === "toutes" ? p.notes.length : nb(f as Statut);
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFiltre(f)}
              aria-pressed={filtre === f}
              className={`app-chip ${filtre === f ? "app-chip-active" : ""}`}
            >
              {f === "toutes" ? "Toutes" : STATUTS[f].libelle}
              <span className="app-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="app-card overflow-hidden">
        {visibles.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {p.notes.length === 0
                ? "Aucune note de frais pour le moment."
                : "Aucune note dans cette catégorie."}
            </p>
            {p.notes.length === 0 && (
              <button
                type="button"
                onClick={() => setEdition("nouvelle")}
                className="app-btn-secondary mt-3"
              >
                <Plus className="h-4 w-4" />
                Déclarer une dépense
              </button>
            )}
          </div>
        ) : (
          <div className="app-list">
            {visibles.map((n) => {
              const etrangere = n.devise !== p.principale;
              const fiche = ficheDevise(p.catalogue, n.devise);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setDetail(n)}
                  className="app-list-row w-full items-start gap-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="app-list-primary block truncate">{n.motif}</span>
                    <span className="app-list-secondary block truncate">
                      {[
                        n.numero,
                        n.beneficiaire,
                        formatDateLocale(n.date, p.locale),
                        nomPoste(n.category_id),
                        etrangere ? formaterMontant(Number(n.montant), fiche) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="app-list-amount">{fmt(Number(n.montant_converti))}</span>
                  <span className={`app-badge ${STATUTS[n.statut].badge} shrink-0`}>
                    {STATUTS[n.statut].libelle}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {edition && (
        <FormulaireNote
          note={edition === "nouvelle" ? null : edition}
          {...p}
          fmt={fmt}
          onFermer={() => setEdition(null)}
        />
      )}

      {detailFrais && (
        <DetailNote
          note={detailFrais}
          {...p}
          fmt={fmt}
          nomPoste={nomPoste(detailFrais.category_id)}
          onFermer={() => setDetail(null)}
          onEditer={() => {
            setEdition(detailFrais);
            setDetail(null);
          }}
        />
      )}
    </div>
  );
};

const FormulaireNote: React.FC<
  Props & { note: NoteDeFrais | null; fmt: (n: number) => string; onFermer: () => void }
> = ({ note, onFermer, fmt, ...p }) => {
  const [date, setDate] = useState(note?.date ?? aujourdhui());
  const [beneficiaire, setBeneficiaire] = useState(note?.beneficiaire ?? p.monNom);
  const [membreId, setMembreId] = useState<string | null>(note?.membre_id ?? null);
  const [personneId, setPersonneId] = useState<string | null>(note?.personne_id ?? null);
  const [motif, setMotif] = useState(note?.motif ?? "");
  const [poste, setPoste] = useState<string | null>(note?.category_id ?? null);
  const [montant, setMontant] = useState(note ? String(note.montant) : "");
  const [devise, setDevise] = useState(note?.devise ?? p.principale);
  const [justificatif, setJustificatif] = useState(note?.justificatif ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const choix = useMemo(() => {
    const codes = [
      p.principale,
      ...p.devises.filter((d) => d.actif && !d.principale).map((d) => d.code),
    ];
    return Array.from(new Set(codes));
  }, [p.devises, p.principale]);

  const montantNum = Number(montant.replace(",", "."));
  const taux =
    devise === p.principale ? 1 : Number(p.devises.find((d) => d.code === devise)?.taux ?? 0);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beneficiaire.trim() || !motif.trim() || !(montantNum > 0)) {
      setErreur("Bénéficiaire, motif et un montant supérieur à zéro sont obligatoires.");
      return;
    }
    setEnCours(true);
    const saisie: SaisieNoteDeFrais = {
      date,
      beneficiaire: beneficiaire.trim(),
      membre_id: membreId,
      personne_id: personneId,
      motif: motif.trim(),
      category_id: poste,
      montant: montantNum,
      devise,
      justificatif: justificatif.trim() || null,
    };
    const r = note ? await p.onModifier(note.id, saisie) : await p.onCreer(saisie);
    setEnCours(false);
    if (r.error) setErreur(r.error);
    else onFermer();
  };

  return (
    <Modal
      open
      onClose={onFermer}
      title={note ? `Modifier ${note.numero ?? "la note"}` : "Nouvelle note de frais"}
      description="Une dépense payée de votre poche pour la boutique. Elle sera remboursée après validation."
      icon={<Receipt className="h-5 w-5" />}
      size="md"
      footer={
        <>
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
          <button
            type="submit"
            form="form-note-frais"
            disabled={enCours}
            className="app-btn-primary"
          >
            {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
            {note ? "Enregistrer" : "Envoyer pour validation"}
          </button>
        </>
      }
    >
      <form id="form-note-frais" onSubmit={enregistrer} className="space-y-4">
        {erreur && (
          <p
            role="alert"
            className="rounded-xl border border-danger-border bg-danger-soft px-3 py-2 text-sm t-danger"
          >
            {erreur}
          </p>
        )}
        <div>
          <label htmlFor="ndf-motif" className="mb-1.5 block text-sm font-medium text-foreground">
            Motif *
          </label>
          <input
            id="ndf-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Taxi pour livraison, fournitures de bureau…"
            className="app-field"
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div>
            <label
              htmlFor="ndf-montant"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Montant payé *
            </label>
            <input
              id="ndf-montant"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className="app-field font-mono"
              required
            />
          </div>
          <div>
            <label
              htmlFor="ndf-devise"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Devise
            </label>
            <select
              id="ndf-devise"
              value={devise}
              onChange={(e) => setDevise(e.target.value)}
              className="app-field"
            >
              {choix.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        {devise !== p.principale && montantNum > 0 && taux > 0 && (
          <p className="-mt-2 text-xs text-muted-foreground">
            ≈ {fmt(montantNum * taux)} au taux du jour (1 {devise} = {formaterTaux(taux)}). Le taux
            est figé à l'enregistrement.
          </p>
        )}
        <div>
          <label htmlFor="ndf-date" className="mb-1.5 block text-sm font-medium text-foreground">
            Date de la dépense
          </label>
          <input
            id="ndf-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="app-field"
          />
        </div>
        <SelecteurPersonne
          label="Payé par (à rembourser à)"
          personnes={p.personnes}
          valeur={beneficiaire}
          requis
          onChange={(c) => {
            setBeneficiaire(c.nom);
            setMembreId(c.membreId);
            setPersonneId(c.personneId);
          }}
          onCreer={p.onCreerPersonne}
        />
        <SelecteurListe
          id="ndf-poste"
          label="Poste de dépense"
          options={p.postes}
          valeur={poste}
          onChange={setPoste}
          onCreer={p.onCreerPoste}
          libelleVide="Non classée"
          placeholder="Transport, repas, fournitures…"
        />
        <div>
          <label htmlFor="ndf-justif" className="mb-1.5 block text-sm font-medium text-foreground">
            Justificatif
          </label>
          <input
            id="ndf-justif"
            value={justificatif}
            onChange={(e) => setJustificatif(e.target.value)}
            placeholder="N° de ticket, facture ou lien"
            className="app-field"
          />
        </div>
      </form>
    </Modal>
  );
};

const DetailNote: React.FC<
  Props & {
    note: NoteDeFrais;
    fmt: (n: number) => string;
    nomPoste?: string;
    onFermer: () => void;
    onEditer: () => void;
  }
> = ({ note, fmt, nomPoste, onFermer, onEditer, ...p }) => {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [dateRemb, setDateRemb] = useState(aujourdhui());
  const mienne = note.created_by === p.moiId;
  const etrangere = note.devise !== p.principale;

  const agir = async (f: () => Resultat, fermer = false) => {
    setEnCours(true);
    setErreur(null);
    const r = await f();
    setEnCours(false);
    if (r.error) setErreur(r.error);
    else if (fermer) onFermer();
  };

  const lignes: [string, React.ReactNode][] = [
    ["Payé par", note.beneficiaire],
    ["Date", formatDateLocale(note.date, p.locale)],
    ["Poste", nomPoste],
    [
      "Montant",
      etrangere
        ? `${formaterMontant(Number(note.montant), ficheDevise(p.catalogue, note.devise))} × ${formaterTaux(Number(note.taux))} = ${fmt(Number(note.montant_converti))}`
        : fmt(Number(note.montant_converti)),
    ],
    ["Justificatif", note.justificatif],
    ["Motif du refus", note.statut === "refusee" ? note.motif_refus : null],
    ["Remboursée le", note.rembourse_le ? formatDateLocale(note.rembourse_le, p.locale) : null],
  ];

  return (
    <Modal
      open
      onClose={onFermer}
      title={`${note.numero ?? "Note de frais"} · ${note.motif}`}
      icon={<Receipt className="h-5 w-5" />}
      size="md"
      headerAside={
        <span className={`app-badge ${STATUTS[note.statut].badge}`}>
          {STATUTS[note.statut].libelle}
        </span>
      }
    >
      <div className="space-y-4">
        <dl className="divide-y divide-border rounded-xl border border-border">
          {lignes
            .filter(([, v]) => v !== null && v !== undefined && v !== "")
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-3 py-2 text-sm">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium text-foreground">{v}</dd>
              </div>
            ))}
        </dl>

        {erreur && (
          <p
            role="alert"
            className="rounded-xl border border-danger-border bg-danger-soft px-3 py-2 text-sm t-danger"
          >
            {erreur}
          </p>
        )}

        {p.peutGerer && note.statut === "a_valider" && refus === null && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={enCours}
              onClick={() => agir(() => p.onDecider(note.id, "validee"))}
              className="app-btn-primary"
            >
              <Check className="h-4 w-4" />
              Valider
            </button>
            <button
              type="button"
              disabled={enCours}
              onClick={() => setRefus("")}
              className="app-btn-secondary"
            >
              <X className="h-4 w-4" />
              Refuser
            </button>
          </div>
        )}

        {refus !== null && (
          <div className="space-y-2">
            <label htmlFor="ndf-refus" className="block text-sm font-medium text-foreground">
              Pourquoi refuser ? (facultatif, visible par le déclarant)
            </label>
            <input
              id="ndf-refus"
              value={refus}
              onChange={(e) => setRefus(e.target.value)}
              className="app-field"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setRefus(null)} className="app-btn-ghost">
                Annuler
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={() =>
                  agir(() => p.onDecider(note.id, "refusee", refus)).then(() => setRefus(null))
                }
                className="app-btn-danger"
              >
                Confirmer le refus
              </button>
            </div>
          </div>
        )}

        {p.peutGerer && note.statut === "validee" && (
          <div className="space-y-2 rounded-xl border border-border p-3">
            <p className="text-sm text-foreground">
              Rembourser {fmt(Number(note.montant_converti))} à {note.beneficiaire}. Une dépense est
              créée et sort de la caisse.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateRemb}
                onChange={(e) => setDateRemb(e.target.value)}
                aria-label="Date du remboursement"
                className="app-field-sm w-40"
              />
              <button
                type="button"
                disabled={enCours}
                onClick={() => agir(() => p.onRembourser(note.id, dateRemb))}
                className="app-btn-primary"
              >
                {enCours ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}
                Rembourser
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={() => agir(() => p.onDecider(note.id, "a_valider"))}
                className="app-btn-ghost"
              >
                <Undo2 className="h-4 w-4" />
                Remettre à valider
              </button>
            </div>
          </div>
        )}

        {p.peutGerer && note.statut === "refusee" && (
          <button
            type="button"
            disabled={enCours}
            onClick={() => agir(() => p.onDecider(note.id, "a_valider"))}
            className="app-btn-ghost"
          >
            <Undo2 className="h-4 w-4" />
            Remettre à valider
          </button>
        )}

        {note.statut === "remboursee" && (
          <p className="text-xs text-muted-foreground">
            Le remboursement figure dans les Dépenses. Supprimer cette dépense remet la note «
            Validée ».
          </p>
        )}

        {((mienne && note.statut === "a_valider") ||
          (p.peutGerer && note.statut !== "remboursee") ||
          (mienne && note.statut === "refusee")) && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {note.statut === "a_valider" && (
              <button type="button" onClick={onEditer} className="app-btn-secondary">
                Modifier
              </button>
            )}
            <button
              type="button"
              disabled={enCours}
              onClick={() => {
                if (window.confirm(`Supprimer la note ${note.numero ?? ""} ?`))
                  agir(() => p.onSupprimer(note.id), true);
              }}
              className="app-btn-ghost t-danger"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

/** L'écran chargé à la demande : il lit les taux au moment où on l'ouvre. */
export const NotesDeFraisPage: React.FC<
  Omit<Props, "catalogue" | "devises" | "principale"> & { storeId: string | null }
> = ({ storeId, ...rest }) => {
  const d = useDevises(storeId, rest.moiId);
  return (
    <NotesDeFraisView
      {...rest}
      catalogue={d.catalogue}
      devises={d.devises}
      principale={d.principale}
    />
  );
};
