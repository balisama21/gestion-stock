import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { PageHeader } from "./shared/PageHeader";
import { StatCol } from "./shared/StatBar";
import { Modal } from "./shared/Modal";
import { formatCurrency, formatDateLocale } from "../utils/formulas";
import type { LocaleSetting } from "../types";
import type { StoreMemberWithProfile } from "../hooks/useStoreMembers";
import {
  CLASSE_STATUT,
  decalerMois,
  demandesEnAttente,
  depassement,
  libelleMois,
  libelleStatut,
  libelleType,
  moisCourant,
  nomVoisin,
  situations,
  totauxDuMois,
  type PaiementSalaire,
  type Salaire,
  type SituationSalaire,
  type StatutPaiement,
  type TypePaiement,
} from "../lib/salaires";

interface SalairesViewProps {
  salaires: Salaire[];
  paiements: PaiementSalaire[];
  /** Les noms déjà connus de la boutique, pour les suggestions de saisie. */
  nomsConnus: string[];
  membres: StoreMemberWithProfile[];
  locale: LocaleSetting;
  /** Faux pour un employé : il lit sa situation, il ne décide de rien. */
  peutGerer: boolean;
  onAddSalaire: (data: {
    employe: string;
    poste?: string | null;
    montant: number;
    debut_le: string;
    user_id?: string | null;
  }) => Promise<{ error: string | null }>;
  onDeleteSalaire: (id: string) => Promise<{ error: string | null }>;
  onAddPaiement: (data: {
    employe: string;
    type: TypePaiement;
    montant: number;
    periode: string;
    statut: StatutPaiement;
    user_id?: string | null;
    motif?: string | null;
    depuis_la_caisse_du_vendeur?: boolean;
  }) => Promise<{ error: string | null }>;
  onUpdatePaiement: (
    id: string,
    data: {
      statut?: StatutPaiement;
      motif_refus?: string | null;
      depuis_la_caisse_du_vendeur?: boolean;
    },
  ) => Promise<{ error: string | null }>;
  onDeletePaiement: (id: string) => Promise<{ error: string | null }>;
}

/**
 * Les salaires, côté responsable.
 *
 * ── Pourquoi un sélecteur de mois et aucune clôture ──
 *
 * Le module est entièrement tourné vers un mois : la masse salariale,
 * les avances et le reste à payer n'ont de sens que rapportés à une
 * période. Mais il n'y a AUCUNE opération de fin de mois à lancer.
 * Octobre commence parce qu'on demande à voir octobre, et il est vide
 * parce qu'aucune ligne n'y est encore imputée. Une clôture est une
 * procédure qu'on oublie ; un sélecteur de mois ne s'oublie pas.
 *
 * ── Ce que cet écran ne fait pas ──
 *
 * Il ne filtre rien. Les règles de lecture sont en base : ce qu'un
 * employé n'a pas le droit de voir ne lui parvient jamais. Les boutons
 * absents quand `peutGerer` est faux sont une politesse, pas une
 * sécurité — la base refuserait de toute façon.
 */
export const SalairesView: React.FC<SalairesViewProps> = ({
  salaires,
  paiements,
  nomsConnus,
  membres,
  locale,
  peutGerer,
  onAddSalaire,
  onDeleteSalaire,
  onAddPaiement,
  onUpdatePaiement,
  onDeletePaiement,
}) => {
  const [periode, setPeriode] = useState(moisCourant());
  const [ficheOuverte, setFicheOuverte] = useState<string | null>(null);
  const [modaleFiche, setModaleFiche] = useState(false);
  const [versementPour, setVersementPour] = useState<SituationSalaire | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const liste = useMemo(
    () => situations(salaires, paiements, periode),
    [salaires, paiements, periode],
  );
  const totaux = useMemo(() => totauxDuMois(liste), [liste]);
  const situationOuverte = liste.find((s) => s.employe === ficheOuverte) ?? null;

  // Les demandes qui attendent, tous mois confondus : une demande pour
  // le mois prochain ne doit pas disparaître parce qu'on regarde ce
  // mois-ci.
  const enAttente = useMemo(() => demandesEnAttente(paiements), [paiements]);

  const agir = async (promesse: Promise<{ error: string | null }>) => {
    const { error } = await promesse;
    setErreur(error);
    return !error;
  };

  const decider = (id: string, statut: StatutPaiement) => agir(onUpdatePaiement(id, { statut }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Wallet className="h-5 w-5 text-muted-foreground" />}
        module="salaires"
        title="Salaires"
        subtitle="Ce que vous devez à chacun, ce que vous avez déjà versé, et ce qui reste à payer."
        actions={
          peutGerer ? (
            <button onClick={() => setModaleFiche(true)} className="app-btn-primary">
              <Plus className="h-4 w-4" />
              Nouvelle fiche
            </button>
          ) : undefined
        }
      />

      {erreur && (
        <div className="app-card border-l-2 border-l-destructive px-4 py-3 text-sm t-danger">
          {erreur}
        </div>
      )}

      {/* ── Le mois ──
          Tout ce qui suit est rapporté à cette période. Le bouton de
          retour au mois courant n'apparaît que lorsqu'on s'en est
          éloigné : sinon il ne fait rien et occupe la place. */}
      <div className="app-card flex items-center justify-between gap-3 p-3">
        <button
          type="button"
          onClick={() => setPeriode(decalerMois(periode, -1))}
          className="app-btn-icon h-9 w-9 shrink-0"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 text-center">
          <div className="truncate text-sm font-medium text-foreground">{libelleMois(periode)}</div>
          {periode !== moisCourant() && (
            <button
              type="button"
              onClick={() => setPeriode(moisCourant())}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              Revenir au mois en cours
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPeriode(decalerMois(periode, 1))}
          className="app-btn-icon h-9 w-9 shrink-0"
          aria-label="Mois suivant"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Le chiffre qui décide : ce qu'il reste à sortir de la caisse. */}
      <div className="app-card flex items-center justify-between gap-4 border-l-2 border-l-primary p-4">
        <div className="min-w-0">
          <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Reste à payer — {libelleMois(periode)}
          </div>
          <div className="font-mono text-xl font-semibold tabular-nums text-foreground">
            {formatCurrency(totaux.resteAPayer)}
          </div>
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          {liste.length} employé{liste.length > 1 ? "s" : ""}
        </div>
      </div>

      <div className="app-statbar grid-cols-1 sm:grid-cols-2">
        <StatCol
          label="Masse salariale"
          value={formatCurrency(totaux.masseSalariale)}
          hint="Engagement du mois"
          icon={<BadgeCheck className="h-3.5 w-3.5" />}
        />
        <StatCol
          label="Déjà versé"
          value={formatCurrency(totaux.verse)}
          hint="Avances et soldes remis"
          icon={<Banknote className="h-3.5 w-3.5" />}
        />
      </div>

      {/* ── Les demandes qui attendent ──
          Une section qui n'existe que lorsqu'il y a quelque chose à
          décider. Rien à afficher, rien à montrer. */}
      {enAttente.length > 0 && (
        <div className="app-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="app-section-title">Demandes en attente ({enAttente.length})</h3>
          </div>
          <div className="app-list">
            {enAttente.map((d) => (
              <div key={d.id} className="app-list-row gap-3">
                <span className="min-w-0 flex-1">
                  <span className="app-list-primary block">{d.employe}</span>
                  <span className="app-list-secondary block">
                    {[
                      libelleMois(d.periode),
                      d.motif || null,
                      formatDateLocale(d.demande_le.slice(0, 10), locale),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block font-mono text-base font-medium tabular-nums text-foreground">
                    {formatCurrency(Number(d.montant))}
                  </span>
                  <span className="app-list-secondary block">{d.numero}</span>
                </span>

                {peutGerer && (
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => decider(d.id, "approuvee")}
                      className="app-btn-icon h-9 w-9"
                      title="Approuver cette demande"
                      aria-label={`Approuver la demande de ${d.employe}`}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => decider(d.id, "refusee")}
                      className="app-btn-icon h-9 w-9"
                      title="Refuser cette demande"
                      aria-label={`Refuser la demande de ${d.employe}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Une ligne par employé ──
          Nom à gauche, son mois résumé en dessous, le reste à payer à
          droite. Le clic ouvre la fiche plutôt que d'étaler l'information
          en colonnes. */}
      <div className="app-card overflow-hidden">
        {liste.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-30" />
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
              Aucune fiche de salaire pour l&apos;instant. Créez-en une en tapant simplement le nom
              de la personne — elle n&apos;a besoin d&apos;aucune activité ni d&apos;aucun compte
              dans le logiciel.
            </p>
          </div>
        ) : (
          <div className="app-list">
            {liste.map((s) => (
              <div key={s.employe} className="app-list-row gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-sm font-medium text-muted-foreground">
                  {s.employe.charAt(0).toUpperCase()}
                </span>

                <button
                  type="button"
                  onClick={() => setFicheOuverte(s.employe)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="app-list-primary block">{s.employe}</span>
                    <span className="app-list-secondary block">
                      {[
                        s.poste,
                        s.salaire > 0 ? `Salaire ${formatCurrency(s.salaire)}` : "Sans fiche",
                        s.avances > 0 ? `Avancé ${formatCurrency(s.avances)}` : null,
                        s.soldes > 0 ? `Soldé ${formatCurrency(s.soldes)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <span className="text-right">
                      <span
                        className={`block font-mono text-base font-medium tabular-nums ${
                          s.resteAPayer < 0 ? "t-danger" : "text-foreground"
                        }`}
                      >
                        {formatCurrency(s.resteAPayer)}
                      </span>
                      <span className="app-list-secondary block">reste à payer</span>
                    </span>
                    {/* Sur un téléphone, le badge se réduit au nombre :
                        le mot « demande » coûte la place du nom, et la
                        section du dessus le dit déjà en toutes lettres. */}
                    {s.enAttente.length > 0 && (
                      <span className="app-badge app-badge-warning">
                        {s.enAttente.length}
                        <span className="hidden sm:inline">
                          &nbsp;demande{s.enAttente.length > 1 ? "s" : ""}
                        </span>
                      </span>
                    )}
                    {s.parti && <span className="app-badge app-badge-neutral">Parti</span>}
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/50 sm:block" />
                  </span>
                </button>

                {/* Sur un téléphone, ce bouton écrasait le nom jusqu'à
                    « Ha… » : l'information principale était la première
                    sacrifiée. Il reste sur grand écran ; ailleurs on
                    ouvre la fiche, dont le pied porte le même bouton. */}
                {peutGerer && s.salaire > 0 && (
                  <button
                    type="button"
                    onClick={() => setVersementPour(s)}
                    className="app-btn-secondary hidden shrink-0 sm:inline-flex"
                    title={`Verser de l'argent à ${s.employe}`}
                  >
                    <Banknote className="h-4 w-4" />
                    Verser
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {situationOuverte && (
        <FicheEmploye
          situation={situationOuverte}
          salaires={salaires}
          periode={periode}
          locale={locale}
          peutGerer={peutGerer}
          onClose={() => setFicheOuverte(null)}
          onVerser={() => {
            setVersementPour(situationOuverte);
            setFicheOuverte(null);
          }}
          onDecider={decider}
          onDeletePaiement={(id) => agir(onDeletePaiement(id))}
          onDeleteSalaire={(id) => agir(onDeleteSalaire(id))}
        />
      )}

      {modaleFiche && (
        <NouvelleFiche
          nomsConnus={nomsConnus}
          membres={membres}
          onClose={() => setModaleFiche(false)}
          onValider={async (data) => {
            if (await agir(onAddSalaire(data))) setModaleFiche(false);
          }}
        />
      )}

      {versementPour && (
        <Versement
          situation={versementPour}
          periode={periode}
          onClose={() => setVersementPour(null)}
          onValider={async (data) => {
            if (await agir(onAddPaiement({ ...data, statut: "versee" }))) setVersementPour(null);
          }}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// LA FICHE D'UN EMPLOYÉ
// ─────────────────────────────────────────────────────────────────────

const FicheEmploye: React.FC<{
  situation: SituationSalaire;
  salaires: Salaire[];
  periode: string;
  locale: LocaleSetting;
  peutGerer: boolean;
  onClose: () => void;
  onVerser: () => void;
  onDecider: (id: string, statut: StatutPaiement) => Promise<boolean>;
  onDeletePaiement: (id: string) => Promise<boolean>;
  onDeleteSalaire: (id: string) => Promise<boolean>;
}> = ({
  situation: s,
  salaires,
  periode,
  locale,
  peutGerer,
  onClose,
  onVerser,
  onDecider,
  onDeletePaiement,
  onDeleteSalaire,
}) => {
  // L'historique complet des salaires de cette personne : c'est lui qui
  // permet de relire un mois ancien avec le montant de l'époque.
  const historique = salaires
    .filter((x) => x.employe.trim().toLowerCase() === s.employe.trim().toLowerCase())
    .sort((a, b) => b.debut_le.localeCompare(a.debut_le));

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={<Wallet className="h-4 w-4" />}
      title={s.employe}
      description={[s.poste, libelleMois(periode)].filter(Boolean).join(" · ")}
      footer={
        peutGerer && s.salaire > 0 ? (
          <button onClick={onVerser} className="app-btn-primary">
            <Banknote className="h-4 w-4" />
            Verser
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="app-statbar grid-cols-2 sm:grid-cols-3">
          <StatCol label="Salaire du mois" value={formatCurrency(s.salaire)} />
          <StatCol label="Déjà versé" value={formatCurrency(s.verse)} />
          <StatCol
            label="Reste à payer"
            value={formatCurrency(s.resteAPayer)}
            alert={s.resteAPayer < 0}
            hint={s.resteAPayer < 0 ? "Avancé au-delà du salaire" : undefined}
          />
        </div>

        {/* Une dette qui se reporte ne doit pas se deviner. */}
        {s.resteAPayer < 0 && (
          <p className="app-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            Vous lui avez avancé {formatCurrency(-s.resteAPayer)} de plus que son salaire de ce
            mois. Pour que la dette ne se perde pas, imputez ce surplus au mois suivant en
            enregistrant le versement sur cette période-là.
          </p>
        )}

        {s.approuveNonVerse > 0 && (
          <p className="app-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {formatCurrency(s.approuveNonVerse)} sont approuvés mais pas encore remis. La caisse ne
            bouge qu&apos;au moment du versement.
          </p>
        )}

        {/* ── Le mois, ligne par ligne ── */}
        <div>
          <h4 className="app-section-title mb-2">Mouvements du mois</h4>
          {s.lignes.length === 0 ? (
            <p className="app-card px-4 py-6 text-center text-sm text-muted-foreground">
              Aucun mouvement sur {libelleMois(periode)}.
            </p>
          ) : (
            <div className="app-card overflow-hidden">
              <div className="app-list">
                {s.lignes.map((l) => (
                  <div key={l.id} className="app-list-row gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="app-list-primary block">
                        {libelleType(l.type)} {l.numero}
                      </span>
                      <span className="app-list-secondary block">
                        {[
                          l.verse_le ? formatDateLocale(l.verse_le, locale) : null,
                          l.motif || null,
                          l.motif_refus ? `Refus : ${l.motif_refus}` : null,
                          l.depuis_la_caisse_du_vendeur ? "Pris sur sa caisse" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </span>

                    <span className="shrink-0 text-right font-mono text-base font-medium tabular-nums text-foreground">
                      {formatCurrency(Number(l.montant))}
                    </span>

                    <span
                      className={`app-badge shrink-0 ${CLASSE_STATUT[l.statut as StatutPaiement] ?? "app-badge-neutral"}`}
                    >
                      {libelleStatut(l.statut)}
                    </span>

                    {peutGerer && (
                      <span className="flex shrink-0 items-center gap-1">
                        {l.statut === "en_attente" && (
                          <>
                            <button
                              type="button"
                              onClick={() => onDecider(l.id, "approuvee")}
                              className="app-btn-icon h-9 w-9"
                              title="Approuver"
                              aria-label="Approuver cette demande"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDecider(l.id, "refusee")}
                              className="app-btn-icon h-9 w-9"
                              title="Refuser"
                              aria-label="Refuser cette demande"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Supprimer définitivement ${l.numero} ?`)) {
                              onDeletePaiement(l.id);
                            }
                          }}
                          className="app-btn-icon h-9 w-9"
                          title="Supprimer cette ligne"
                          aria-label={`Supprimer ${l.numero}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── L'historique des salaires ──
            Une ligne par changement : c'est ce qui permet de relire juin
            avec le salaire de juin. */}
        <div>
          <h4 className="app-section-title mb-2">Historique du salaire</h4>
          <div className="app-card overflow-hidden">
            <div className="app-list">
              {historique.map((h) => (
                <div key={h.id} className="app-list-row gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="app-list-primary block">
                      {formatCurrency(Number(h.montant))} par mois
                    </span>
                    <span className="app-list-secondary block">
                      {[
                        `Depuis le ${formatDateLocale(h.debut_le, locale)}`,
                        h.fin_le ? `jusqu'au ${formatDateLocale(h.fin_le, locale)}` : "en cours",
                        h.poste || null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>

                  {peutGerer && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Supprimer cette période de salaire ? L'historique des mois concernés changera.",
                          )
                        ) {
                          onDeleteSalaire(h.id);
                        }
                      }}
                      className="app-btn-icon h-9 w-9 shrink-0"
                      title="Supprimer cette période"
                      aria-label="Supprimer cette période de salaire"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────
// NOUVELLE FICHE DE SALAIRE
// ─────────────────────────────────────────────────────────────────────

const NouvelleFiche: React.FC<{
  nomsConnus: string[];
  membres: StoreMemberWithProfile[];
  onClose: () => void;
  onValider: (data: {
    employe: string;
    poste?: string | null;
    montant: number;
    debut_le: string;
    user_id?: string | null;
  }) => void;
}> = ({ nomsConnus, membres, onClose, onValider }) => {
  const [employe, setEmploye] = useState("");
  const [poste, setPoste] = useState("");
  const [montant, setMontant] = useState("");
  const [debutLe, setDebutLe] = useState(moisCourant());
  const [compte, setCompte] = useState("");

  const voisin = nomVoisin(employe, nomsConnus);
  const valide = employe.trim() !== "" && Number(montant) > 0;

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      icon={<Plus className="h-4 w-4" />}
      title="Nouvelle fiche de salaire"
      description="Tapez simplement le nom. La personne n'a besoin d'aucune activité préalable."
      footer={
        <>
          <button onClick={onClose} className="app-btn-secondary">
            Annuler
          </button>
          <button
            onClick={() =>
              onValider({
                employe: employe.trim(),
                poste: poste.trim() || null,
                montant: Number(montant),
                debut_le: debutLe,
                user_id: compte || null,
              })
            }
            disabled={!valide}
            className="app-btn-primary"
          >
            Enregistrer
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="sal-nom" className="mb-1.5 block text-sm font-medium text-foreground">
            Nom de l&apos;employé
          </label>
          <input
            id="sal-nom"
            list="sal-noms-connus"
            value={employe}
            onChange={(e) => setEmploye(e.target.value)}
            placeholder="Naivo"
            className="app-field"
            autoFocus
          />
          <datalist id="sal-noms-connus">
            {nomsConnus.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          {/* On avertit, on ne bloque pas : deux frères peuvent
              travailler ensemble. Mais « Naivo » créé à côté d'un
              « Naivo R. » donne deux employés là où il n'y en a qu'un,
              et personne ne s'en aperçoit avant la paie. */}
          {voisin && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs t-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                « {voisin} » existe déjà. S&apos;il s&apos;agit de la même personne, reprenez
                exactement son nom.
              </span>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="sal-poste" className="mb-1.5 block text-sm font-medium text-foreground">
            Poste
          </label>
          <input
            id="sal-poste"
            value={poste}
            onChange={(e) => setPoste(e.target.value)}
            placeholder="Livreur, vendeur, gestionnaire de stock…"
            className="app-field"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="sal-montant"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Salaire mensuel
            </label>
            <input
              id="sal-montant"
              type="number"
              inputMode="numeric"
              min={1}
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="180000"
              className="app-field"
            />
          </div>

          <div>
            <label htmlFor="sal-debut" className="mb-1.5 block text-sm font-medium text-foreground">
              À partir du
            </label>
            <input
              id="sal-debut"
              type="date"
              value={debutLe}
              onChange={(e) => setDebutLe(e.target.value)}
              className="app-field"
            />
          </div>
        </div>

        {/* Le rattachement n'est proposé que s'il y a des comptes : une
            liste vide n'apprend rien et occupe la place. */}
        {membres.length > 0 && (
          <div>
            <label
              htmlFor="sal-compte"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Compte de la personne
            </label>
            <select
              id="sal-compte"
              value={compte}
              onChange={(e) => setCompte(e.target.value)}
              className="app-field"
            >
              <option value="">Aucun compte</option>
              {membres.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name || m.email}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Facultatif. Rattaché à un compte, l&apos;employé pourra consulter sa situation et
              demander une avance lui-même.
            </p>
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Si cette personne a déjà un salaire en cours, il sera automatiquement clos la veille de
          cette date. Les mois passés gardent le montant de l&apos;époque.
        </p>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────
// VERSER
// ─────────────────────────────────────────────────────────────────────

const Versement: React.FC<{
  situation: SituationSalaire;
  periode: string;
  onClose: () => void;
  onValider: (data: {
    employe: string;
    type: TypePaiement;
    montant: number;
    periode: string;
    user_id?: string | null;
    depuis_la_caisse_du_vendeur?: boolean;
  }) => void;
}> = ({ situation: s, periode, onClose, onValider }) => {
  // Le solde de fin de mois est le geste le plus fréquent, et son
  // montant est connu : on le propose pré-rempli plutôt que de le faire
  // retaper.
  const reste = Math.max(0, s.resteAPayer);
  const [type, setType] = useState<TypePaiement>(reste > 0 ? "solde" : "avance");
  const [montant, setMontant] = useState(reste > 0 ? String(reste) : "");
  const [surSaCaisse, setSurSaCaisse] = useState(false);
  const [moisImpute, setMoisImpute] = useState(periode);

  const valeur = Number(montant);
  const trop = depassement(valeur, s.resteAPayer);
  const valide = valeur > 0;

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      icon={<Banknote className="h-4 w-4" />}
      title={`Verser à ${s.employe}`}
      description={`Salaire ${formatCurrency(s.salaire)} · déjà versé ${formatCurrency(s.verse)}`}
      footer={
        <>
          <button onClick={onClose} className="app-btn-secondary">
            Annuler
          </button>
          <button
            onClick={() =>
              onValider({
                employe: s.employe,
                type,
                montant: valeur,
                periode: moisImpute,
                user_id: s.userId,
                depuis_la_caisse_du_vendeur: surSaCaisse,
              })
            }
            disabled={!valide}
            className="app-btn-primary"
          >
            Enregistrer le versement
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ver-type" className="mb-1.5 block text-sm font-medium text-foreground">
              Nature
            </label>
            <select
              id="ver-type"
              value={type}
              onChange={(e) => setType(e.target.value as TypePaiement)}
              className="app-field"
            >
              <option value="avance">Avance sur salaire</option>
              <option value="solde">Solde de fin de mois</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="ver-montant"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Montant
            </label>
            <input
              id="ver-montant"
              type="number"
              inputMode="numeric"
              min={1}
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className="app-field"
              autoFocus
            />
          </div>
        </div>

        <div>
          <label htmlFor="ver-mois" className="mb-1.5 block text-sm font-medium text-foreground">
            Imputé sur
          </label>
          <select
            id="ver-mois"
            value={moisImpute}
            onChange={(e) => setMoisImpute(e.target.value)}
            className="app-field"
          >
            {[decalerMois(periode, -1), periode, decalerMois(periode, 1)].map((m) => (
              <option key={m} value={m}>
                {libelleMois(m)}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Une avance prise fin septembre pour le salaire d&apos;octobre s&apos;impute sur octobre.
          </p>
        </div>

        {/* ── Le seul pont vers le solde en poche ──
            Coché, l'employé garde de l'argent qu'il détenait déjà : la
            trésorerie baisse ET ce qu'il détient pour la boutique baisse.
            Décoché, il est payé depuis le coffre et sa poche ne bouge
            pas. Sans cette case, il faudrait choisir un cas par défaut et
            l'autre serait faux. */}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3">
          <input
            type="checkbox"
            checked={surSaCaisse}
            onChange={(e) => setSurSaCaisse(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span className="min-w-0 text-sm">
            <span className="block font-medium text-foreground">
              Pris sur la caisse qu&apos;il détient
            </span>
            <span className="block text-xs leading-relaxed text-muted-foreground">
              Cochez si la personne garde de l&apos;argent qu&apos;elle avait encaissé. Son solde en
              poche baissera d&apos;autant. Laissez décoché si vous la payez depuis votre caisse.
            </span>
          </span>
        </label>

        {trop > 0 && (
          <p className="flex items-start gap-1.5 text-xs t-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Ce versement dépasse de {formatCurrency(trop)} ce qui reste dû sur{" "}
              {libelleMois(moisImpute)}. Ce n&apos;est pas bloquant : vous pouvez aussi imputer le
              surplus au mois suivant pour que la dette se suive.
            </span>
          </p>
        )}
      </div>
    </Modal>
  );
};
