import React, { useState } from "react";
import { Armchair, Trash2 } from "lucide-react";
import { Modal } from "../shared/Modal";
import { Toggle } from "../shared/Toggle";
import { formatCurrency } from "../../utils/formulas";
import { useConfirmation } from "../../hooks/useConfirmation";
import type { Bar } from "../../hooks/useBar";
import { nomDeTable, type TableBar, type ZoneBar } from "../../lib/bar";

const montant = (v: string): number => Math.max(0, Number(v.replace(/\s/g, "")) || 0);

/**
 * Modifier une table, ou en créer une : numéro, zone, places, droit de
 * table propre, en service. Une table libre se supprime ; une table qui a
 * déjà servi se met hors service (son historique reste).
 */
export const TableModal: React.FC<{
  bar: Bar;
  table: TableBar | null;
  zoneParDefaut: string | null;
  numeroPropose?: string;
  onFermer: () => void;
}> = ({ bar, table, zoneParDefaut, numeroPropose, onFermer }) => {
  const [numero, setNumero] = useState(table?.numero ?? numeroPropose ?? "");
  const [zoneId, setZoneId] = useState(table ? (table.zone_id ?? "") : (zoneParDefaut ?? ""));
  const [places, setPlaces] = useState(table?.places ? String(table.places) : "");
  const [droit, setDroit] = useState(
    table?.droit_table === null || table?.droit_table === undefined
      ? ""
      : String(table.droit_table),
  );
  const [active, setActive] = useState(table?.active ?? true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const { confirmer, modaleConfirmation } = useConfirmation();

  const occupee = table ? bar.noteDeLaTable.has(table.id) : false;
  const zone: ZoneBar | undefined = bar.zones.find((z) => z.id === zoneId);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero.trim()) return setErreur("Donnez un numéro ou un nom à la table.");
    if (bar.tables.some((t) => t.numero === numero.trim() && t.id !== table?.id)) {
      return setErreur(`La table ${numero.trim()} existe déjà.`);
    }
    setEnvoi(true);
    setErreur(null);
    const p = parseInt(places, 10);
    const r = await bar.enregistrerTable({
      id: table?.id,
      numero,
      zone_id: zoneId || null,
      places: Number.isFinite(p) && p > 0 ? p : null,
      droit_table: droit.trim() === "" ? null : montant(droit),
      active,
    });
    setEnvoi(false);
    if (r.error) setErreur(r.error);
    else onFermer();
  };

  const supprimer = async () => {
    if (!table) return;
    if (
      !(await confirmer(`Supprimer ${nomDeTable(table.numero)} ?`, {
        danger: true,
        libelle: "Supprimer",
      }))
    )
      return;
    setEnvoi(true);
    const r = await bar.supprimerTable(table.id);
    setEnvoi(false);
    if (r.error) setErreur(r.error);
    else onFermer();
  };

  return (
    <Modal
      open
      onClose={onFermer}
      size="sm"
      icon={<Armchair className="h-4 w-4" />}
      title={table ? nomDeTable(table.numero) : "Nouvelle table"}
      dismissible={!envoi}
      footer={
        <>
          {table && (
            <button
              type="button"
              onClick={supprimer}
              disabled={envoi || occupee}
              className="app-btn-secondary mr-auto"
              title={occupee ? "La table est occupée" : "Supprimer la table"}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
          )}
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
          <button type="submit" form="fiche-table" disabled={envoi} className="app-btn-primary">
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <form id="fiche-table" onSubmit={enregistrer} className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Numéro ou nom
          </span>
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="12, V3, Comptoir…"
            className="app-field"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Places</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={places}
            onChange={(e) => setPlaces(e.target.value)}
            placeholder="Facultatif"
            className="app-field"
          />
        </label>
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Zone</span>
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="app-field">
            <option value="">Sans zone</option>
            {bar.zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Droit de table propre à cette table
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={droit}
            onChange={(e) => setDroit(e.target.value)}
            placeholder={zone ? `Celui de la zone : ${formatCurrency(zone.droit_table)}` : "Aucun"}
            className="app-field"
          />
        </label>
        <div className="col-span-2 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-sm">
            En service
            <span className="block text-xs text-muted-foreground">
              Hors service, elle disparaît de la salle sans perdre son historique.
            </span>
          </span>
          <Toggle
            checked={active}
            onChange={setActive}
            label="Table en service"
            disabled={occupee}
            size="sm"
          />
        </div>
        {occupee && (
          <p className="col-span-2 text-xs t-warning">
            La table est occupée : encaissez ou déplacez sa note avant de la supprimer ou de la
            mettre hors service.
          </p>
        )}
        {erreur && <p className="col-span-2 text-sm font-medium t-danger">{erreur}</p>}
      </form>
      {modaleConfirmation}
    </Modal>
  );
};

/** Le prochain numéro libre d'une zone : après le plus grand nombre déjà pris. */
export function numeroSuivant(tables: TableBar[], zoneTables: TableBar[]): string {
  // D'abord les tables en service de la zone : « Table6 » après « Table5 »,
  // pas « 11 » après d'anciennes tables mises de côté.
  const enService = zoneTables.filter((t) => t.active);
  const source = enService.length ? enService : zoneTables.length ? zoneTables : tables;
  let prefixe = "";
  let max = 0;
  for (const t of source) {
    const m = /^(\D*)(\d+)$/.exec(t.numero.trim());
    if (m && Number(m[2]) >= max) {
      max = Number(m[2]);
      prefixe = m[1];
    }
  }
  const pris = new Set(tables.map((t) => t.numero));
  let n = max + 1;
  while (pris.has(`${prefixe}${n}`)) n++;
  return `${prefixe}${n}`;
}
