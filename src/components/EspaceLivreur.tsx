import React, { useMemo, useState } from "react";
import {
  Check,
  LogOut,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  RefreshCw,
  Save,
  Truck,
} from "lucide-react";
import { formatCurrency, formatDateLocale } from "../utils/formulas";
import { Modal } from "./shared/Modal";
import { useLivraisonsDuLivreur } from "../hooks/useLivraisonsDuLivreur";
import {
  classeStatutLivraison,
  estEnCours,
  libelleStatutLivraison,
  lireContenu,
  type Livraison,
} from "../lib/livraisons";

interface EspaceLivreurProps {
  storeId: string;
  storeName: string;
  userId: string;
  /** Comment on l'appelle, pour que l'écran soit le sien. */
  nom: string;
  onSignOut: () => void;
}

/**
 * L'écran du livreur.
 *
 * Il ne s'agit pas de l'application avec des onglets en moins : c'est un
 * autre écran, monté à la place de l'application, sans barre latérale ni
 * navigation. Un livreur travaille debout, sur un téléphone, entre deux
 * arrêts — il n'a besoin que de sa course en cours et d'un bouton.
 *
 * Ce qu'il ne voit pas ici, il ne le voit pas non plus en base : ni
 * ventes, ni prix d'achat, ni trésorerie. Ce n'est pas cet écran qui le
 * tient à l'écart, ce sont les règles de lecture.
 *
 * Ce composant-ci ne fait que chercher ses courses et les passer au
 * tableau. La séparation n'est pas de la cérémonie : elle permet de
 * regarder l'écran tel qu'il sera, avec des courses dans tous les
 * états, sans avoir à en créer de vraies dans la base.
 */
export const EspaceLivreur: React.FC<EspaceLivreurProps> = ({
  storeId,
  storeName,
  userId,
  nom,
  onSignOut,
}) => {
  const donnees = useLivraisonsDuLivreur(storeId, userId);
  return <TableauDuLivreur storeName={storeName} nom={nom} onSignOut={onSignOut} {...donnees} />;
};

interface TableauDuLivreurProps {
  storeName: string;
  nom: string;
  onSignOut: () => void;
  livraisons: Livraison[];
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
  avancer: (
    id: string,
    statut: "en_cours" | "livree" | "echouee",
    options?: { montantEncaisse?: number | null; motifEchec?: string | null },
  ) => Promise<{ error: string | null }>;
}

/** Ce que le livreur voit, quelles que soient ses courses. */
export const TableauDuLivreur: React.FC<TableauDuLivreurProps> = ({
  storeName,
  nom,
  onSignOut,
  livraisons,
  chargement,
  erreur,
  recharger,
  avancer,
}) => {
  const [remise, setRemise] = useState<Livraison | null>(null);
  const [echec, setEchec] = useState<Livraison | null>(null);
  const [encaisse, setEncaisse] = useState(0);
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [messageErreur, setMessageErreur] = useState<string | null>(null);

  /**
   * L'ordre du travail : ce qui est commencé d'abord, ce qui reste
   * ensuite, ce qui est fini tout en bas.
   */
  const { aFaire, terminees } = useMemo(() => {
    const rang = (l: Livraison) => (l.statut === "en_cours" ? 0 : 1);
    const ouvertes = livraisons.filter(estEnCours).sort((a, b) => rang(a) - rang(b));
    return { aFaire: ouvertes, terminees: livraisons.filter((l) => !estEnCours(l)) };
  }, [livraisons]);

  const aRapporter = aFaire.reduce((n, l) => n + l.montant_a_encaisser, 0);

  const prendre = async (l: Livraison) => {
    setEnCours(true);
    const res = await avancer(l.id, "en_cours");
    setEnCours(false);
    if (res.error) setMessageErreur(res.error);
  };

  const ouvrirRemise = (l: Livraison) => {
    setRemise(l);
    setEncaisse(l.montant_a_encaisser);
    setMessageErreur(null);
  };

  const confirmerRemise = async () => {
    if (!remise) return;
    setEnCours(true);
    const res = await avancer(remise.id, "livree", { montantEncaisse: encaisse });
    setEnCours(false);
    if (res.error) {
      setMessageErreur(res.error);
      return;
    }
    setRemise(null);
  };

  const confirmerEchec = async () => {
    if (!echec) return;
    if (!motif.trim()) {
      setMessageErreur("Dites en deux mots ce qui s'est passé.");
      return;
    }
    setEnCours(true);
    const res = await avancer(echec.id, "echouee", { motifEchec: motif.trim() });
    setEnCours(false);
    if (res.error) {
      setMessageErreur(res.error);
      return;
    }
    setEchec(null);
    setMotif("");
  };

  return (
    <div className="min-h-dvh bg-background">
      {/* Un en-tête, pas une barre de navigation : il n'y a nulle part
          où aller. */}
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{nom}</p>
            <p className="truncate text-xs text-muted-foreground">{storeName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={recharger}
              className="app-btn-icon h-9 w-9"
              aria-label="Actualiser mes courses"
            >
              <RefreshCw className={`h-4 w-4 ${chargement ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="app-btn-icon h-9 w-9"
              aria-label="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4 pb-16">
        <div className="app-statbar grid-cols-2">
          <div className="app-statbar-item">
            <span className="app-statbar-label">
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />À faire
            </span>
            <span className="app-statbar-value">{aFaire.length}</span>
          </div>
          <div className="app-statbar-item">
            <span className="app-statbar-label">À rapporter</span>
            <span className="app-statbar-value">{formatCurrency(aRapporter)}</span>
          </div>
        </div>

        {erreur && (
          <p
            role="alert"
            className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm t-danger"
          >
            {erreur}
          </p>
        )}

        {messageErreur && (
          <p
            role="alert"
            className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm t-danger"
          >
            {messageErreur}
          </p>
        )}

        {aFaire.length === 0 && !chargement && (
          <div className="app-card flex flex-col items-center gap-2 px-4 py-12 text-center">
            <Package className="h-7 w-7 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Aucune course pour vous.</p>
            <p className="text-sm text-muted-foreground">
              Elles apparaîtront ici dès que la boutique vous en confie une.
            </p>
          </div>
        )}

        {aFaire.map((l) => (
          <CarteCourse
            key={l.id}
            livraison={l}
            enCours={enCours}
            onPrendre={() => prendre(l)}
            onRemettre={() => ouvrirRemise(l)}
            onEchouer={() => {
              setEchec(l);
              setMotif("");
              setMessageErreur(null);
            }}
          />
        ))}

        {terminees.length > 0 && (
          <section className="pt-2">
            <h2 className="app-section-title mb-2">Terminées</h2>
            <div className="app-card app-list overflow-hidden">
              {terminees.map((l) => (
                <div key={l.id} className="app-list-row justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="app-list-primary block">{l.destinataire}</span>
                    <span className="app-list-secondary block">{l.adresse}</span>
                  </span>
                  <span className={`app-badge shrink-0 ${classeStatutLivraison(l.statut)}`}>
                    {libelleStatutLivraison(l.statut)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Remise ── */}
      <Modal
        open={remise !== null}
        onClose={() => setRemise(null)}
        size="sm"
        title="Colis remis"
        description={remise ? `${remise.destinataire} · ${remise.adresse}` : undefined}
        footer={
          <>
            <button type="button" onClick={() => setRemise(null)} className="app-btn-secondary">
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmerRemise}
              disabled={enCours}
              className="app-btn-primary"
            >
              <Check className="h-4 w-4" />
              {enCours ? "…" : "Confirmer"}
            </button>
          </>
        }
      >
        {remise && remise.montant_a_encaisser > 0 ? (
          <div>
            <label
              htmlFor="liv-encaisse"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Combien avez-vous encaissé ?
            </label>
            <input
              id="liv-encaisse"
              type="number"
              min={0}
              max={remise.montant_a_encaisser}
              inputMode="decimal"
              value={encaisse}
              onChange={(e) => setEncaisse(Number(e.target.value))}
              className="app-field font-mono text-lg"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Attendu : {formatCurrency(remise.montant_a_encaisser)}.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Rien à encaisser sur cette course : le client a déjà payé.
          </p>
        )}
      </Modal>

      {/* ── Échec ── */}
      <Modal
        open={echec !== null}
        onClose={() => setEchec(null)}
        size="sm"
        title="Livraison impossible"
        description={echec ? `${echec.destinataire} · ${echec.adresse}` : undefined}
        footer={
          <>
            <button type="button" onClick={() => setEchec(null)} className="app-btn-secondary">
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmerEchec}
              disabled={enCours}
              className="app-btn-primary"
            >
              <Save className="h-4 w-4" />
              {enCours ? "…" : "Enregistrer"}
            </button>
          </>
        }
      >
        <label htmlFor="liv-motif" className="mb-1.5 block text-sm font-medium text-foreground">
          Que s&apos;est-il passé ?
        </label>
        <textarea
          id="liv-motif"
          rows={3}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Personne à l'adresse, client injoignable, colis refusé…"
          className="app-field"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          La boutique le lira : c&apos;est ce qui lui permet de rappeler le client.
        </p>
      </Modal>
    </div>
  );
};

/**
 * Une course, en grand.
 *
 * Tout ce qu'il faut pour la faire tient sur la carte, et le geste
 * suivant est un bouton pleine largeur — celui qu'on atteint au pouce,
 * sans regarder.
 */
const CarteCourse: React.FC<{
  livraison: Livraison;
  enCours: boolean;
  onPrendre: () => void;
  onRemettre: () => void;
  onEchouer: () => void;
}> = ({ livraison: l, enCours, onPrendre, onRemettre, onEchouer }) => {
  const contenu = lireContenu(l.contenu);

  return (
    <article className="app-card space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-foreground">{l.destinataire}</h2>
          <p className="text-xs text-muted-foreground">
            {l.numero}
            {l.date_prevue ? ` · ${formatDateLocale(l.date_prevue, "FR")}` : ""}
          </p>
        </div>
        <span className={`app-badge shrink-0 ${classeStatutLivraison(l.statut)}`}>
          {libelleStatutLivraison(l.statut)}
        </span>
      </div>

      <p className="flex items-start gap-2 text-sm text-foreground">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0">
          {l.adresse || "Adresse non précisée"}
          {l.precisions && (
            <span className="block text-xs text-muted-foreground">{l.precisions}</span>
          )}
        </span>
      </p>

      {l.telephone && (
        <a
          href={`tel:${l.telephone}`}
          className="app-btn-secondary w-full"
          aria-label={`Appeler ${l.destinataire}`}
        >
          <Phone className="h-4 w-4" />
          {l.telephone}
        </a>
      )}

      {contenu.length > 0 && (
        <div className="app-list rounded-xl border border-border">
          {contenu.map((a, i) => (
            <div key={i} className="app-list-row justify-between gap-3">
              <span className="app-list-primary min-w-0 flex-1">{a.designation}</span>
              <span className="app-list-amount">×{a.quantite}</span>
            </div>
          ))}
        </div>
      )}

      {l.montant_a_encaisser > 0 && (
        <div className="rounded-xl border border-warning-border bg-warning-soft px-3.5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide t-warning">À encaisser</p>
          <p className="font-mono text-lg font-bold tabular-nums t-warning">
            {formatCurrency(l.montant_a_encaisser)}
          </p>
        </div>
      )}

      {l.note && <p className="text-sm text-muted-foreground">{l.note}</p>}

      {l.statut === "a_faire" ? (
        <button
          type="button"
          onClick={onPrendre}
          disabled={enCours}
          className="app-btn-primary w-full py-3 text-base"
        >
          <Truck className="h-4 w-4" />
          Je pars avec
        </button>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onRemettre}
            disabled={enCours}
            className="app-btn-primary w-full py-3 text-base"
          >
            <PackageCheck className="h-4 w-4" />
            Colis remis
          </button>
          <button
            type="button"
            onClick={onEchouer}
            disabled={enCours}
            className="app-btn-secondary w-full"
          >
            Je n&apos;ai pas pu livrer
          </button>
        </div>
      )}
    </article>
  );
};
