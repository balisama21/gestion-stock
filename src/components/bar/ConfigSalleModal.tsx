import React, { useState } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { Modal } from "../shared/Modal";
import { Toggle } from "../shared/Toggle";
import { formatCurrency } from "../../utils/formulas";
import { useConfirmation } from "../../hooks/useConfirmation";
import type { Bar } from "../../hooks/useBar";
import type { TableBar, ZoneBar } from "../../lib/bar";

const montant = (v: string): number => Math.max(0, Number(v.replace(/\s/g, "")) || 0);

/**
 * LA CONFIGURATION DE LA SALLE
 *
 * Les zones d'abord (Standard, VIP, Terrasse…), chacune avec son droit
 * de table ; puis les tables, créées d'un coup « de 1 à 12 » et réglées
 * une à une si besoin (places, droit de table propre, mise hors service).
 *
 * Une table qui a déjà servi ne se supprime pas — son historique
 * l'attend — : on la met hors service.
 */
export const ConfigSalleModal: React.FC<{ bar: Bar; onFermer: () => void }> = ({
  bar,
  onFermer,
}) => {
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const { confirmer, modaleConfirmation } = useConfirmation();

  const agir = async (f: () => Promise<{ error: string | null }>) => {
    setOccupe(true);
    setErreur(null);
    const r = await f();
    setOccupe(false);
    if (r.error) setErreur(r.error);
    return !r.error;
  };

  const zones = [...bar.zones].sort((a, b) => a.ordre - b.ordre);

  return (
    <Modal
      open
      onClose={onFermer}
      size="2xl"
      icon={<Settings2 className="h-4 w-4" />}
      title="Configurer la salle"
      description="Vos zones, leur droit de table, et vos tables numérotées."
      dismissible={!occupe}
      footer={
        <button type="button" onClick={onFermer} className="app-btn-primary">
          Terminé
        </button>
      }
    >
      {erreur && (
        <p className="mb-3 rounded-lg border border-danger-border bg-danger-soft p-2.5 text-sm t-danger">
          {erreur}
        </p>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Zones et droit de table</h3>
        <p className="text-xs text-muted-foreground">
          Le droit de table s&apos;ajoute à l&apos;addition à l&apos;ouverture de la table. Mettez 0
          pour une zone sans droit de table.
        </p>
        <ul className="space-y-2">
          {zones.map((z) => (
            <LigneZone
              key={z.id}
              zone={z}
              occupe={occupe}
              nbTables={bar.tables.filter((t) => t.zone_id === z.id).length}
              onEnregistrer={(nom, droit) =>
                agir(() =>
                  bar.enregistrerZone({ id: z.id, nom, droit_table: droit, ordre: z.ordre }),
                )
              }
              onSupprimer={async () => {
                if (
                  !(await confirmer(`Supprimer la zone « ${z.nom} » ?`, {
                    danger: true,
                    libelle: "Supprimer",
                  }))
                )
                  return;
                await agir(() => bar.supprimerZone(z.id));
              }}
            />
          ))}
        </ul>
        <NouvelleZone
          occupe={occupe}
          onAjouter={(nom, droit) => agir(() => bar.enregistrerZone({ nom, droit_table: droit }))}
        />
      </section>

      <section className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold">Tables</h3>
        <NouvellesTables
          zones={zones}
          occupe={occupe}
          onCreer={(zoneId, de, a, prefixe) => agir(() => bar.creerTables(zoneId, de, a, prefixe))}
        />
        <ul className="divide-y divide-border rounded-lg border border-border">
          {[...bar.tables]
            .sort(
              (a, b) =>
                (a.zone_id ?? "").localeCompare(b.zone_id ?? "") ||
                a.numero.localeCompare(b.numero, "fr", { numeric: true }),
            )
            .map((t) => (
              <LigneTable
                key={t.id}
                table={t}
                zones={zones}
                occupe={occupe || bar.noteDeLaTable.has(t.id)}
                onEnregistrer={(patch) => agir(() => bar.enregistrerTable({ ...t, ...patch }))}
              />
            ))}
          {bar.tables.length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">
              Aucune table pour l&apos;instant.
            </li>
          )}
        </ul>
      </section>
      {modaleConfirmation}
    </Modal>
  );
};

const LigneZone: React.FC<{
  zone: ZoneBar;
  nbTables: number;
  occupe: boolean;
  onEnregistrer: (nom: string, droit: number) => void;
  onSupprimer: () => void;
}> = ({ zone, nbTables, occupe, onEnregistrer, onSupprimer }) => {
  const [nom, setNom] = useState(zone.nom);
  const [droit, setDroit] = useState(String(zone.droit_table));
  const change = nom.trim() !== zone.nom || montant(droit) !== zone.droit_table;
  return (
    <li className="flex flex-wrap items-center gap-2">
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        aria-label="Nom de la zone"
        className="app-field min-w-[8rem] flex-1"
      />
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={droit}
        onChange={(e) => setDroit(e.target.value)}
        aria-label="Droit de table"
        className="app-field w-32"
      />
      <button
        type="button"
        disabled={occupe || !change || !nom.trim()}
        onClick={() => onEnregistrer(nom, montant(droit))}
        className="app-btn-secondary"
      >
        Enregistrer
      </button>
      <button
        type="button"
        disabled={occupe || nbTables > 0}
        onClick={onSupprimer}
        className="inline-flex h-[38px] w-[38px] items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
        aria-label={`Supprimer la zone ${zone.nom}`}
        title={nbTables > 0 ? "Elle contient des tables" : "Supprimer"}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
};

const NouvelleZone: React.FC<{
  occupe: boolean;
  onAjouter: (nom: string, droit: number) => Promise<boolean>;
}> = ({ occupe, onAjouter }) => {
  const [nom, setNom] = useState("");
  const [droit, setDroit] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!nom.trim()) return;
        if (await onAjouter(nom, montant(droit))) {
          setNom("");
          setDroit("");
        }
      }}
    >
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="Nouvelle zone (ex. VIP)"
        aria-label="Nom de la nouvelle zone"
        className="app-field min-w-[8rem] flex-1"
      />
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={droit}
        onChange={(e) => setDroit(e.target.value)}
        placeholder="Droit de table"
        aria-label="Droit de table de la nouvelle zone"
        className="app-field w-32"
      />
      <button type="submit" disabled={occupe || !nom.trim()} className="app-btn-primary">
        <Plus className="h-4 w-4" />
        Ajouter
      </button>
    </form>
  );
};

const NouvellesTables: React.FC<{
  zones: ZoneBar[];
  occupe: boolean;
  onCreer: (zoneId: string | null, de: number, a: number, prefixe: string) => Promise<boolean>;
}> = ({ zones, occupe, onCreer }) => {
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [de, setDe] = useState("1");
  const [a, setA] = useState("10");
  const [prefixe, setPrefixe] = useState("");
  const zoneChoisie = zones.some((z) => z.id === zoneId) ? zoneId : (zones[0]?.id ?? "");
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/50 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        await onCreer(
          zoneChoisie || null,
          parseInt(de, 10) || 1,
          parseInt(a, 10) || 1,
          prefixe.trim(),
        );
      }}
    >
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">Zone</span>
        <select
          value={zoneChoisie}
          onChange={(e) => setZoneId(e.target.value)}
          className="app-field"
        >
          {zones.length === 0 && <option value="">Sans zone</option>}
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nom}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">Préfixe</span>
        <input
          value={prefixe}
          onChange={(e) => setPrefixe(e.target.value)}
          placeholder="ex. V"
          className="app-field w-20"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">De</span>
        <input
          type="number"
          min={1}
          value={de}
          onChange={(e) => setDe(e.target.value)}
          className="app-field w-20"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">À</span>
        <input
          type="number"
          min={1}
          value={a}
          onChange={(e) => setA(e.target.value)}
          className="app-field w-20"
        />
      </label>
      <button type="submit" disabled={occupe} className="app-btn-primary">
        <Plus className="h-4 w-4" />
        Créer les tables
      </button>
    </form>
  );
};

const LigneTable: React.FC<{
  table: TableBar;
  zones: ZoneBar[];
  occupe: boolean;
  onEnregistrer: (patch: Partial<TableBar>) => void;
}> = ({ table, zones, occupe, onEnregistrer }) => {
  const [numero, setNumero] = useState(table.numero);
  const [droit, setDroit] = useState(table.droit_table === null ? "" : String(table.droit_table));
  const zone = zones.find((z) => z.id === table.zone_id);
  const droitSaisi = droit.trim() === "" ? null : montant(droit);
  const change = numero.trim() !== table.numero || droitSaisi !== table.droit_table;
  return (
    <li
      className={`flex flex-wrap items-center gap-2 px-3 py-2 ${table.active ? "" : "opacity-60"}`}
    >
      <input
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        aria-label="Numéro de table"
        className="app-field w-20"
      />
      <select
        value={table.zone_id ?? ""}
        onChange={(e) => onEnregistrer({ zone_id: e.target.value || null })}
        disabled={occupe}
        aria-label="Zone de la table"
        className="app-field w-36"
      >
        <option value="">Sans zone</option>
        {zones.map((z) => (
          <option key={z.id} value={z.id}>
            {z.nom}
          </option>
        ))}
      </select>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={droit}
        onChange={(e) => setDroit(e.target.value)}
        placeholder={zone ? `${formatCurrency(zone.droit_table)} (zone)` : "Droit de table"}
        aria-label="Droit de table propre à cette table"
        className="app-field w-40"
      />
      <button
        type="button"
        disabled={occupe || !change || !numero.trim()}
        onClick={() => onEnregistrer({ numero, droit_table: droitSaisi })}
        className="app-btn-secondary"
      >
        Enregistrer
      </button>
      <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        En service
        <Toggle
          checked={table.active}
          onChange={(v) => onEnregistrer({ active: v })}
          label={`Table ${table.numero} en service`}
          disabled={occupe}
          size="sm"
        />
      </span>
    </li>
  );
};
