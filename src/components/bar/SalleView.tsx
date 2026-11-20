import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock,
  LayoutGrid,
  Mic,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";
import type { Product } from "../../types";
import type { Database } from "../../lib/database.types";
import { PageHeader } from "../shared/PageHeader";
import { formatCurrency } from "../../utils/formulas";
import { useBar } from "../../hooks/useBar";
import { dureeDepuis, tablesParZone, totalNote, droitDeTable, type TableBar } from "../../lib/bar";
import { NoteModal } from "./NoteModal";
import { ConfigSalleModal } from "./ConfigSalleModal";
import { OuvrirTableModal } from "./OuvrirTableModal";
import { numeroSuivant, TableModal } from "./TableModal";
import { useConfirmation } from "../../hooks/useConfirmation";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Categorie = Database["public"]["Tables"]["categories"]["Row"];

export interface SalleViewProps {
  storeId: string;
  products: Product[];
  categories: Categorie[];
  productImages: { product_id: string | null; chemin: string; ordre: number }[];
  clients: Client[];
  /** Les noms proposés pour « servi par ». */
  serveurs: string[];
  /** Le nom sous lequel la vente est enregistrée. */
  vendeur: string;
  estProprietaire: boolean;
  /** Après un encaissement : le stock et les ventes ont changé. */
  onVentes: () => void;
}

/**
 * LA SALLE DU BAR-KARAOKÉ
 *
 * Toutes les tables d'un coup d'œil, rangées par zone : libres en
 * pointillé, occupées en couleur avec ce qu'elles doivent et depuis
 * quand. On touche une table pour l'ouvrir ou voir son addition.
 *
 * Une seule caisse tient toutes les notes : le serveur annonce, la
 * caisse saisit. Le stock ne sort qu'à l'encaissement, en ventes
 * ordinaires — le bilan, l'historique et le crédit client suivent.
 */
export const SalleView: React.FC<SalleViewProps> = (props) => {
  const bar = useBar(props.storeId);
  const [config, setConfig] = useState(false);
  const [aOuvrir, setAOuvrir] = useState<TableBar | null>(null);
  const [noteOuverte, setNoteOuverte] = useState<string | null>(null);
  // Mode « Modifier la salle » : toucher une table l'édite au lieu de l'ouvrir.
  const [edition, setEdition] = useState(false);
  const [nettoyage, setNettoyage] = useState(false);
  const [bilanNettoyage, setBilanNettoyage] = useState<string | null>(null);
  const { confirmer, modaleConfirmation } = useConfirmation();
  const [aModifier, setAModifier] = useState<{
    table: TableBar | null;
    zoneId: string | null;
    numero?: string;
  } | null>(null);

  // Les durées « depuis 1 h 05 » avancent sans recharger.
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setMaintenant(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  // En modification, les tables hors service se montrent aussi (grisées).
  const groupes = useMemo(
    () =>
      tablesParZone(
        edition ? bar.tables.map((t) => ({ ...t, active: true })) : bar.tables,
        bar.zones,
      ),
    [bar.tables, bar.zones, edition],
  );
  const reelle = (t: TableBar) => bar.tables.find((x) => x.id === t.id) ?? t;
  const occupees = bar.notes.length;
  const actives = bar.tables.filter((t) => t.active).length;
  const enCours = useMemo(() => totalNote(bar.lignes).reste, [bar.lignes]);

  const toucher = (t: TableBar) => {
    if (edition) return setAModifier({ table: reelle(t), zoneId: t.zone_id });
    const note = bar.noteDeLaTable.get(t.id);
    if (note) setNoteOuverte(note.id);
    else setAOuvrir(t);
  };

  const note = noteOuverte ? bar.notes.find((n) => n.id === noteOuverte) : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Mic className="h-5 w-5 t-info" />}
        module="salle"
        title="Salle"
        subtitle="Vos tables, leurs additions en cours, et l'encaissement en fin de soirée."
        metric={
          actives > 0 ? (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">
                {occupees} / {actives} tables occupées
              </div>
              <div className="text-lg font-bold tabular-nums">{formatCurrency(enCours)}</div>
            </div>
          ) : undefined
        }
        actions={
          props.estProprietaire && bar.tables.length > 0 ? (
            <div className="flex w-full gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() => setEdition((e) => !e)}
                className={`${edition ? "app-btn-primary" : "app-btn-secondary"} flex-1 sm:flex-none`}
                aria-pressed={edition}
              >
                {edition ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                {edition ? "Terminé" : "Modifier la salle"}
              </button>
              <button
                type="button"
                onClick={() => setConfig(true)}
                className="app-btn-secondary"
                aria-label="Zones et création de tables"
                title="Zones et création de tables"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            </div>
          ) : undefined
        }
      />

      {bar.erreur && (
        <p className="rounded-lg border border-danger-border bg-danger-soft p-3 text-sm t-danger">
          {bar.erreur}
        </p>
      )}

      {edition && bar.tables.some((t) => !t.active) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
          <span className="flex-1">
            {bar.tables.filter((t) => !t.active).length} table(s) hors service. Celles qui
            n&apos;ont jamais servi peuvent être supprimées d&apos;un coup.
          </span>
          <button
            type="button"
            disabled={nettoyage}
            onClick={async () => {
              const horsService = bar.tables.filter((t) => !t.active);
              if (
                !(await confirmer(
                  `Supprimer les tables hors service qui n'ont jamais servi ? Celles qui ont un historique restent hors service.`,
                  { danger: true, libelle: "Supprimer" },
                ))
              )
                return;
              setNettoyage(true);
              let gardees = 0;
              for (const t of horsService) {
                const r = await bar.supprimerTable(t.id);
                if (r.error) gardees++;
              }
              setNettoyage(false);
              setBilanNettoyage(
                `${horsService.length - gardees} table(s) supprimée(s)` +
                  (gardees ? `, ${gardees} gardée(s) hors service (déjà servi).` : "."),
              );
            }}
            className="app-btn-secondary"
          >
            <Trash2 className="h-4 w-4" />
            {nettoyage ? "Suppression…" : "Supprimer les inutilisées"}
          </button>
          {bilanNettoyage && <p className="w-full text-xs t-success">{bilanNettoyage}</p>}
        </div>
      )}

      {edition && (
        <p className="rounded-lg border border-primary/40 bg-success-soft p-3 text-sm">
          Touchez une table pour changer son numéro, sa zone, ses places ou son droit de table, la
          mettre hors service ou la supprimer. « + Table » en ajoute une dans la zone.
        </p>
      )}

      {!bar.chargement && actives === 0 && !edition && (
        <div className="app-card flex flex-col items-center gap-3 p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutGrid className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-bold">Votre salle est vide</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Créez vos zones (Standard, VIP…) avec leur droit de table, puis vos tables numérotées.
            Elles apparaîtront ici, prêtes à servir.
          </p>
          {props.estProprietaire ? (
            <button type="button" onClick={() => setConfig(true)} className="app-btn-primary">
              <Settings2 className="h-4 w-4" />
              Configurer la salle
            </button>
          ) : (
            <p className="text-sm font-medium">Demandez au responsable de configurer la salle.</p>
          )}
        </div>
      )}

      {groupes.map(({ zone, tables }) => (
        <section key={zone?.id ?? "sans-zone"} className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {zone?.nom ?? "Autres tables"}
            </h2>
            {edition && zone ? (
              <button
                type="button"
                onClick={() => setConfig(true)}
                className="text-xs font-medium text-primary"
              >
                Zone : nom et droit de table
              </button>
            ) : (
              zone &&
              zone.droit_table > 0 && (
                <span className="text-xs text-muted-foreground">
                  Droit de table {formatCurrency(zone.droit_table)}
                </span>
              )
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7">
            {tables.map((t) => {
              const n = bar.noteDeLaTable.get(t.id);
              const tot = n ? totalNote(bar.lignesDeLaNote(n.id)) : null;
              const horsService = !reelle(t).active;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toucher(t)}
                  className={`flex min-h-[96px] flex-col justify-between rounded-xl border p-3 text-left transition-colors ${
                    n
                      ? "border-primary bg-success-soft hover:bg-success-soft/70"
                      : "border-dashed border-border bg-card hover:border-primary/60"
                  } ${edition ? "ring-1 ring-primary/30" : ""} ${horsService ? "opacity-50" : ""}`}
                  aria-label={`Table ${t.numero}${edition ? ", modifier" : n ? ", occupée" : ", libre"}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xl font-bold leading-none">{t.numero}</span>
                    {edition && <Pencil className="h-3.5 w-3.5 text-primary" />}
                    {n?.nb_personnes ? (
                      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {n.nb_personnes}
                      </span>
                    ) : null}
                  </div>
                  {n && tot ? (
                    <div>
                      <div className="text-sm font-bold tabular-nums">
                        {formatCurrency(tot.reste)}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {dureeDepuis(n.ouverte_le, maintenant)} · {tot.articles} art.
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      {horsService ? "Hors service" : "Libre"}
                      {droitDeTable(t, bar.zones) > 0 && !zone ? (
                        <> · {formatCurrency(droitDeTable(t, bar.zones))}</>
                      ) : null}
                    </div>
                  )}
                </button>
              );
            })}
            {edition && (
              <button
                type="button"
                onClick={() =>
                  setAModifier({
                    table: null,
                    zoneId: zone?.id ?? null,
                    numero: numeroSuivant(bar.tables, tables),
                  })
                }
                className="flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-primary/60 text-sm font-semibold text-primary"
              >
                <Plus className="h-5 w-5" />
                Table
              </button>
            )}
          </div>
        </section>
      ))}

      {aModifier && (
        <TableModal
          bar={bar}
          table={aModifier.table}
          zoneParDefaut={aModifier.zoneId}
          numeroPropose={aModifier.numero}
          onFermer={() => setAModifier(null)}
        />
      )}

      {aOuvrir && (
        <OuvrirTableModal
          table={aOuvrir}
          droit={droitDeTable(aOuvrir, bar.zones)}
          clients={props.clients}
          onFermer={() => setAOuvrir(null)}
          onOuvrir={async (options) => {
            const r = await bar.ouvrirNote(aOuvrir.id, options);
            if (r.note) {
              setAOuvrir(null);
              setNoteOuverte(r.note.id);
            }
            return r.error;
          }}
        />
      )}

      {note && (
        <NoteModal
          note={note}
          bar={bar}
          products={props.products}
          categories={props.categories}
          productImages={props.productImages}
          clients={props.clients}
          serveurs={props.serveurs}
          vendeur={props.vendeur}
          onVentes={props.onVentes}
          onFermer={() => setNoteOuverte(null)}
        />
      )}

      {config && <ConfigSalleModal bar={bar} onFermer={() => setConfig(false)} />}
      {modaleConfirmation}
    </div>
  );
};
