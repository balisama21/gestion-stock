import React, { useMemo, useState } from "react";
import { AlertTriangle, HandCoins, Wallet, X } from "lucide-react";
import { PageHeader } from "./shared/PageHeader";
import { StatCol } from "./shared/StatBar";
import { Modal } from "./shared/Modal";
import { formatCurrency, formatDateLocale } from "../utils/formulas";
import type { LocaleSetting } from "../types";
import {
  CLASSE_STATUT,
  decalerMois,
  libelleMois,
  libelleStatut,
  libelleType,
  moisCourant,
  salaireEnCours,
  situations,
  type PaiementSalaire,
  type Salaire,
  type StatutPaiement,
} from "../lib/salaires";

/** Combien de mois passés on garde sous les yeux. Au-delà, on demande. */
const MOIS_D_HISTORIQUE = 6;

interface MaPaieViewProps {
  /** Déjà réduites à cette personne par les règles de lecture. */
  salaires: Salaire[];
  paiements: PaiementSalaire[];
  locale: LocaleSetting;
  /**
   * Bloc nu à insérer dans un autre écran, sans en-tête de page et sans
   * l'historique des mois.
   *
   * C'est la forme que reçoit l'espace du livreur, qui n'est pas
   * « l'application avec des onglets en moins » mais un autre écran :
   * on y travaille debout, sur un téléphone, entre deux arrêts. Six mois
   * d'historique n'y ont pas leur place — ce qu'il vient chercher, c'est
   * ce qu'il lui reste à percevoir et un bouton.
   */
  compact?: boolean;
  onDemander: (data: {
    /** Son nom tel que porté par sa fiche : c'est la clé du module. */
    employe: string;
    montant: number;
    motif: string | null;
    periode: string;
  }) => Promise<{ error: string | null }>;
  onAnnuler: (id: string) => Promise<{ error: string | null }>;
}

/**
 * Ma paie — ce que l'employé voit de sa propre situation.
 *
 * Volontairement pauvre : son salaire, ce qu'il a déjà touché, ce qui
 * lui reste à percevoir, et un bouton pour demander une avance. Rien
 * d'autre. Une personne qui travaille debout derrière un comptoir ne
 * vient pas ici lire un tableau de bord.
 *
 * ── Ce que cet écran ne cache pas ──
 *
 * Il ne cache RIEN, parce qu'il n'a rien à cacher : les règles de
 * lecture de la base ne lui remettent que ses propres lignes. Le salaire
 * d'un collègue n'arrive jamais jusqu'ici, même si l'écran essayait de
 * l'afficher.
 *
 * ── Ce qu'il ne peut pas faire ──
 *
 * Décider. Ni approuver sa demande, ni se verser l'argent, ni même
 * corriger le montant en la retirant. Il peut l'ouvrir, et la retirer
 * tant qu'elle attend. Le reste est refusé en base, pas seulement ici.
 */
export const MaPaieView: React.FC<MaPaieViewProps> = ({
  salaires,
  paiements,
  locale,
  compact = false,
  onDemander,
  onAnnuler,
}) => {
  const [periode, setPeriode] = useState(moisCourant());
  const [modale, setModale] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Les règles de lecture n'ont laissé passer que ses lignes : le nom
  // se déduit donc de ses propres fiches, il n'y en a pas d'autre.
  const fiche = useMemo(() => {
    const s = salaires[0] ?? null;
    return s ? salaireEnCours(salaires, s.employe) : null;
  }, [salaires]);

  const moi = fiche?.employe ?? salaires[0]?.employe ?? paiements[0]?.employe ?? "";
  const situation = useMemo(
    () => situations(salaires, paiements, periode).find((s) => s.employe === moi) ?? null,
    [salaires, paiements, periode, moi],
  );

  // Les derniers mois, pour voir d'un coup ce qui a été perçu et quand.
  const historique = useMemo(() => {
    const mois: string[] = [];
    for (let i = 0; i < MOIS_D_HISTORIQUE; i += 1) mois.push(decalerMois(moisCourant(), -i));
    return mois.map((m) => ({
      mois: m,
      situation: situations(salaires, paiements, m).find((s) => s.employe === moi) ?? null,
    }));
  }, [salaires, paiements, moi]);

  const agir = async (promesse: Promise<{ error: string | null }>) => {
    const { error } = await promesse;
    setErreur(error);
    return !error;
  };

  // Sans salaire enregistré, il n'y a rien à avancer : la base refuserait
  // la demande, autant le dire plutôt que d'offrir un bouton qui échoue.
  const salaireConnu = fiche !== null;

  const corps = (
    <>
      {erreur && (
        <div className="app-card border-l-2 border-l-destructive px-4 py-3 text-sm t-danger">
          {erreur}
        </div>
      )}

      {!salaireConnu ? (
        <div className="app-card px-4 py-10 text-center">
          <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-30" />
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            Aucun salaire n&apos;est enregistré à votre nom pour le moment. Votre responsable doit
            en créer un avant que vous puissiez suivre votre situation ou demander une avance.
          </p>
        </div>
      ) : (
        <>
          {/* Le chiffre qu'il vient chercher, et rien devant lui. */}
          <div className="app-card flex items-center justify-between gap-4 border-l-2 border-l-primary p-4">
            <div className="min-w-0">
              <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Reste à percevoir — {libelleMois(periode)}
              </div>
              <div className="font-mono text-xl font-semibold tabular-nums text-foreground">
                {formatCurrency(situation?.resteAPayer ?? 0)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModale(true)}
              className="app-btn-primary shrink-0"
            >
              <HandCoins className="h-4 w-4" />
              <span className="hidden sm:inline">Demander une avance</span>
              <span className="sm:hidden">Demander</span>
            </button>
          </div>

          <div className="app-statbar grid-cols-2">
            <StatCol label="Mon salaire" value={formatCurrency(situation?.salaire ?? 0)} />
            <StatCol label="Déjà perçu" value={formatCurrency(situation?.verse ?? 0)} />
          </div>

          {(situation?.approuveNonVerse ?? 0) > 0 && (
            <p className="app-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">
              {formatCurrency(situation!.approuveNonVerse)} ont été approuvés et vous seront remis
              par votre responsable. Le montant ci-dessus ne les compte pas encore.
            </p>
          )}

          {/* ── Ses mouvements du mois ── */}
          <div className="app-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h3 className="app-section-title">{libelleMois(periode)}</h3>
            </div>
            {!situation || situation.lignes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Rien ce mois-ci.
              </p>
            ) : (
              <div className="app-list">
                {situation.lignes.map((l) => (
                  <div key={l.id} className="app-list-row gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="app-list-primary block">
                        {libelleType(l.type)} {l.numero}
                      </span>
                      <span className="app-list-secondary block">
                        {[
                          l.verse_le ? formatDateLocale(l.verse_le, locale) : null,
                          l.motif || null,
                          l.motif_refus ? `Motif du refus : ${l.motif_refus}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </span>

                    <span className="shrink-0 text-right font-mono text-base font-medium tabular-nums text-foreground">
                      {formatCurrency(Number(l.montant))}
                    </span>

                    <span
                      className={`app-badge shrink-0 ${
                        CLASSE_STATUT[l.statut as StatutPaiement] ?? "app-badge-neutral"
                      }`}
                    >
                      {libelleStatut(l.statut)}
                    </span>

                    {/* Il peut retirer sa demande tant qu'elle attend.
                        C'est le seul changement d'état qui lui est
                        ouvert, et la base le vérifie aussi. */}
                    {l.statut === "en_attente" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Retirer votre demande ${l.numero} ?`)) {
                            agir(onAnnuler(l.id));
                          }
                        }}
                        className="app-btn-icon h-9 w-9 shrink-0"
                        title="Retirer cette demande"
                        aria-label={`Retirer la demande ${l.numero}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Les mois précédents ──
              Les mois sans aucune ligne restent affichés : c'est une
              série qu'on relit, et un mois vide y est une information. */}
          {!compact && (
            <div className="app-card overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h3 className="app-section-title">Mois précédents</h3>
              </div>
              <div className="app-list">
                {historique.map(({ mois, situation: s }) => (
                  <button
                    key={mois}
                    type="button"
                    onClick={() => setPeriode(mois)}
                    className={`app-list-row w-full gap-3 text-left ${
                      mois === periode ? "bg-muted/50" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="app-list-primary block">{libelleMois(mois)}</span>
                      <span className="app-list-secondary block">
                        {s && s.salaire > 0
                          ? `Salaire ${formatCurrency(s.salaire)} · perçu ${formatCurrency(s.verse)}`
                          : "Aucun salaire sur ce mois"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right font-mono text-base font-medium tabular-nums text-foreground">
                      {formatCurrency(s?.resteAPayer ?? 0)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {modale && situation && (
        <DemandeAvance
          reste={situation.resteAPayer}
          periode={periode}
          onClose={() => setModale(false)}
          onValider={async (data) => {
            if (await agir(onDemander({ ...data, employe: moi }))) setModale(false);
          }}
        />
      )}
    </>
  );

  if (compact) return <div className="space-y-4">{corps}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Wallet className="h-5 w-5 text-muted-foreground" />}
        module="salaires"
        title="Ma paie"
        subtitle="Votre salaire, vos avances, et ce qu'il vous reste à percevoir."
      />
      {corps}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// DEMANDER UNE AVANCE
// ─────────────────────────────────────────────────────────────────────

const DemandeAvance: React.FC<{
  reste: number;
  periode: string;
  onClose: () => void;
  onValider: (data: { montant: number; motif: string | null; periode: string }) => void;
}> = ({ reste, periode, onClose, onValider }) => {
  const [montant, setMontant] = useState("");
  const [motif, setMotif] = useState("");

  const valeur = Number(montant);
  const valide = valeur > 0;
  const depasse = valeur > Math.max(0, reste);

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      icon={<HandCoins className="h-4 w-4" />}
      title="Demander une avance"
      // Courte exprès : sur un téléphone, une phrase entière se coupait
      // entre le nombre et sa monnaie.
      description={`${libelleMois(periode)} · reste ${formatCurrency(reste)}`}
      footer={
        <>
          <button onClick={onClose} className="app-btn-secondary">
            Annuler
          </button>
          <button
            onClick={() => onValider({ montant: valeur, motif: motif.trim() || null, periode })}
            disabled={!valide}
            className="app-btn-primary"
          >
            Envoyer la demande
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="dem-montant" className="mb-1.5 block text-sm font-medium text-foreground">
            Montant demandé
          </label>
          <input
            id="dem-montant"
            type="number"
            inputMode="numeric"
            min={1}
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            className="app-field"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="dem-motif" className="mb-1.5 block text-sm font-medium text-foreground">
            Motif
          </label>
          <input
            id="dem-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Frais médicaux, transport…"
            className="app-field"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Facultatif, mais il aide votre responsable à décider vite.
          </p>
        </div>

        {depasse && (
          <p className="flex items-start gap-1.5 text-xs t-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Ce montant dépasse ce qu&apos;il vous reste à percevoir sur ce mois. Vous pouvez quand
              même l&apos;envoyer : c&apos;est votre responsable qui décide.
            </span>
          </p>
        )}

        {/* On ne promet rien : l'argent est dans la caisse de quelqu'un
            d'autre, et le logiciel ne peut pas engager cette personne. */}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Votre demande sera transmise à votre responsable, qui l&apos;acceptera ou la refusera.
          Tant qu&apos;elle attend, vous pouvez la retirer.
        </p>
      </div>
    </Modal>
  );
};
