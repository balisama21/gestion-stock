import React, { useEffect, useMemo, useState } from "react";
import { Banknote, Gift, KeyRound, Plus, Undo2, UserRound, Users, X } from "lucide-react";
import type { Sale } from "../../types";
import { supabase } from "../../lib/supabase";
import { Modal } from "../shared/Modal";
import { formatCurrency } from "../../utils/formulas";
import { dateDuJour } from "../../lib/dates";
import { useConfirmation } from "../../hooks/useConfirmation";
import type { LigneNote } from "../../lib/bar";
import { dansLaPeriode, periodeDe, type Echelle, type Periode } from "../../lib/bilanBar";
import { bilanCaissiers, bilanServeurs, SANS_SERVEUR } from "../../lib/equipeBar";
import { ChoixPeriode } from "./ChoixPeriode";

const db = supabase as unknown as { from: (t: string) => any };

type Resultat = { error: string | null };

export interface ServeurSansCompte {
  id: string;
  nom: string;
  telephone: string | null;
}

interface Props {
  storeId: string;
  sales: Sale[];
  /** Les comptes de l'équipe (responsable et invités). */
  membres: { nom: string; mention: string | null }[];
  /** Les serveurs sans accès à l'application (fiches « hors équipe »). */
  serveursSansCompte: ServeurSansCompte[];
  estProprietaire: boolean;
  onAjouterServeur?: (d: { nom: string; telephone: string }) => Promise<Resultat>;
  onRetirerServeur?: (id: string) => Promise<Resultat>;
  onInviter?: () => void;
}

const lendemain = (jour: string) => {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Les lignes de notes servies dans la période (jours locaux, comme la caisse). */
function useLignesDeLaPeriode(storeId: string, periode: Periode) {
  const [lignes, setLignes] = useState<LigneNote[]>([]);
  const [chargement, setChargement] = useState(true);
  useEffect(() => {
    let actif = true;
    setChargement(true);
    const debut = new Date(`${periode.debut}T00:00:00`).toISOString();
    const fin = new Date(`${lendemain(periode.fin)}T00:00:00`).toISOString();
    void (async () => {
      const lues: LigneNote[] = [];
      // Par pages de 1000 : une grosse soirée de mois peut dépasser la limite d'une réponse.
      for (let page = 0; page < 20; page++) {
        const { data, error } = await db
          .from("bar_note_lignes")
          .select("*")
          .eq("store_id", storeId)
          .gte("cree_le", debut)
          .lt("cree_le", fin)
          .order("cree_le")
          .range(page * 1000, page * 1000 + 999);
        if (error || !data) break;
        lues.push(...data.map((l: LigneNote) => ({ ...l, prix_unit: Number(l.prix_unit) })));
        if (data.length < 1000) break;
      }
      if (!actif) return;
      setLignes(lues);
      setChargement(false);
    })();
    return () => {
      actif = false;
    };
  }, [storeId, periode.debut, periode.fin]);
  return { lignes, chargement };
}

/**
 * L'ÉQUIPE DU BAR
 *
 * Les serveurs servent, une seule caisse encaisse. Pour chaque serveur :
 * ce qu'il a servi, à combien de tables, ce qu'il a offert et ce qui a
 * été retiré de ses notes — les deux points à surveiller. Pour la
 * caisse : qui a encaissé combien. Puis la liste de l'équipe, où l'on
 * ajoute un serveur qui n'a pas besoin d'accès à l'application.
 */
export const EquipeBarView: React.FC<Props> = ({
  storeId,
  sales,
  membres,
  serveursSansCompte,
  estProprietaire,
  onAjouterServeur,
  onRetirerServeur,
  onInviter,
}) => {
  const aujourdhui = dateDuJour();
  const [echelle, setEchelle] = useState<Echelle>("soir");
  const [recul, setRecul] = useState(0);
  const [ajout, setAjout] = useState(false);
  const { confirmer, modaleConfirmation } = useConfirmation();
  const periode = useMemo(
    () => periodeDe(echelle, recul, aujourdhui),
    [echelle, recul, aujourdhui],
  );
  const { lignes, chargement } = useLignesDeLaPeriode(storeId, periode);

  const serveurs = useMemo(() => bilanServeurs(lignes), [lignes]);
  const caissiers = useMemo(
    () => bilanCaissiers(sales.filter((v) => dansLaPeriode(v.date, periode))),
    [sales, periode],
  );
  const meilleur = Math.max(1, ...serveurs.map((s) => s.servi));
  const totalOfferts = serveurs.reduce((n, s) => n + s.offerts, 0);
  const totalRetraits = serveurs.reduce((n, s) => n + s.retraits, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Équipe</h1>
        <p className="text-sm text-muted-foreground">Qui a servi, qui a encaissé</p>
      </header>

      <ChoixPeriode
        echelle={echelle}
        recul={recul}
        periode={periode}
        onEchelle={setEchelle}
        onRecul={setRecul}
      />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Les serveurs</h2>
          {(totalOfferts > 0 || totalRetraits > 0) && (
            <p className="text-xs text-muted-foreground">
              {totalOfferts > 0 && `${formatCurrency(totalOfferts)} offerts`}
              {totalOfferts > 0 && totalRetraits > 0 && " · "}
              {totalRetraits > 0 && `${formatCurrency(totalRetraits)} retirés`}
            </p>
          )}
        </div>
        {chargement ? (
          <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
            Chargement…
          </p>
        ) : serveurs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Rien n&apos;a été servi sur cette période.
          </p>
        ) : (
          <ul className="space-y-2">
            {serveurs.map((s) => (
              <li key={s.serveur} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate font-medium ${
                        s.serveur === SANS_SERVEUR ? "text-muted-foreground" : ""
                      }`}
                    >
                      {s.serveur}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.articles} article{s.articles > 1 ? "s" : ""} · {s.tables} table
                      {s.tables > 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="text-lg font-bold tabular-nums">{formatCurrency(s.servi)}</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((s.servi / meilleur) * 100)}%` }}
                  />
                </div>
                {(s.offerts > 0 || s.nbRetraits > 0) && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {s.offerts > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 t-success">
                        <Gift className="h-3 w-3" />
                        {formatCurrency(s.offerts)} offerts
                      </span>
                    )}
                    {s.nbRetraits > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 t-warning">
                        <Undo2 className="h-3 w-3" />
                        {s.nbRetraits} retrait{s.nbRetraits > 1 ? "s" : ""} ·{" "}
                        {formatCurrency(s.retraits)}
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">La caisse</h2>
        {caissiers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Aucune addition encaissée sur cette période.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {caissiers.map((c) => (
              <li key={c.caissier} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <Banknote className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">{c.caissier}</span>
                <span className="text-xs text-muted-foreground">
                  {c.additions} addition{c.additions > 1 ? "s" : ""}
                </span>
                <span className="font-semibold tabular-nums">{formatCurrency(c.encaisse)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">L&apos;équipe</h2>
          {onAjouterServeur && (
            <button
              type="button"
              onClick={() => setAjout(true)}
              className="flex items-center gap-1 text-sm font-medium text-primary"
            >
              <Plus className="h-4 w-4" />
              Serveur
            </button>
          )}
        </div>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {membres.map((m) => (
            <li key={`m-${m.nom}`} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <KeyRound className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">{m.nom}</span>
              <span className="text-xs text-muted-foreground">{m.mention ?? "Accès"}</span>
            </li>
          ))}
          {serveursSansCompte.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {p.nom}
                {p.telephone && (
                  <span className="ml-2 text-xs text-muted-foreground">{p.telephone}</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">Sans accès</span>
              {onRetirerServeur && (
                <button
                  type="button"
                  aria-label={`Retirer ${p.nom}`}
                  onClick={async () => {
                    if (
                      await confirmer(
                        `Retirer ${p.nom} de l'équipe ? Ce qu'il a déjà servi reste dans l'historique.`,
                        { danger: true, libelle: "Retirer" },
                      )
                    )
                      await onRetirerServeur(p.id);
                  }}
                  className="rounded p-1 text-muted-foreground hover:t-danger"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Un serveur sans accès est choisi sur la note quand on sert. Pour qu&apos;il prenne les
          commandes sur son propre téléphone, donnez-lui un accès.
        </p>
        {estProprietaire && onInviter && (
          <button type="button" onClick={onInviter} className="app-btn-secondary">
            <KeyRound className="h-4 w-4" />
            Donner un accès
          </button>
        )}
      </section>

      {ajout && onAjouterServeur && (
        <AjoutServeur onFermer={() => setAjout(false)} onAjouter={onAjouterServeur} />
      )}
      {modaleConfirmation}
    </div>
  );
};

const AjoutServeur: React.FC<{
  onFermer: () => void;
  onAjouter: (d: { nom: string; telephone: string }) => Promise<Resultat>;
}> = ({ onFermer, onAjouter }) => {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    if (!nom.trim()) {
      setErreur("Donnez son nom.");
      return;
    }
    setEnvoi(true);
    const r = await onAjouter({ nom: nom.trim(), telephone: telephone.trim() });
    setEnvoi(false);
    if (r.error) setErreur(r.error);
    else onFermer();
  };

  return (
    <Modal
      open
      onClose={onFermer}
      size="sm"
      icon={<UserRound className="h-4 w-4" />}
      title="Ajouter un serveur"
      description="Sans accès à l'application : on le choisit sur la note quand il sert."
      dismissible={!envoi}
      footer={
        <>
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
          <button type="submit" form="ajout-serveur" disabled={envoi} className="app-btn-primary">
            {envoi ? "Ajout…" : "Ajouter"}
          </button>
        </>
      }
    >
      <form id="ajout-serveur" onSubmit={valider} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Nom</span>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="app-field"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Téléphone (facultatif)
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            className="app-field"
          />
        </label>
        {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}
      </form>
    </Modal>
  );
};
