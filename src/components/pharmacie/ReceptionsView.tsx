import React, { useMemo, useState } from "react";
import { BoutonScan } from "../shared/BoutonScan";
import { codePropre, useDouchette } from "../../hooks/useDouchette";
import { Raccourcis } from "./ui";
import {
  AlertTriangle,
  ClipboardList,
  PackagePlus,
  Plus,
  ScanLine,
  Trash2,
  Truck,
} from "lucide-react";
import type { Product, Purchase } from "../../types";
import type { Database } from "../../lib/database.types";
import { formatCurrency } from "../../utils/formulas";
import { libelleUnite, prixAchatDe } from "../../lib/conditionnements";
import { correspond, finDeMois, urgence } from "../../lib/pharmacie";
import type { Pharmacie } from "../../hooks/usePharmacie";
import { Chiffre, EnTete, Panneau, Pastille, Recherche, Segments, Vide } from "./ui";
import { CommandeGrossiste, type LigneCommande } from "./CommandeGrossiste";

type Fournisseur = Database["public"]["Tables"]["suppliers"]["Row"];

interface Props {
  storeName?: string;
  products: Product[];
  purchases: Purchase[];
  fournisseurs: Fournisseur[];
  pharma: Pharmacie;
  aujourdhui: string;
  peutRecevoir: boolean;
  /** Après une réception : le stock et la trésorerie ont changé. */
  onRecue: () => void;
}

interface Ligne {
  cle: string;
  produit: Product;
  /** "" : l'unité de base ; sinon l'id du conditionnement. */
  conditionnementId: string;
  quantite: string;
  prix: string;
  numeroLot: string;
  mois: string;
}

type Reglement = "tout" | "partiel" | "credit";

const nombre = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

const dateCourte = (jour: string) => jour.split("-").reverse().join("/");

const decaler = (jour: string, jours: number) => {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
};
/** Le mois (AAAA-MM) dans `ans` années, à partir d'un jour. */
const moisDans = (jour: string, ans: number) =>
  `${Number(jour.slice(0, 4)) + ans}-${jour.slice(5, 7)}`;

const nouvelleLigne = (p: Product, quantite = ""): Ligne => ({
  cle: `${p.id}-${Date.now()}-${Math.random()}`,
  produit: p,
  conditionnementId: "",
  quantite,
  prix: String(p.prixAchat || ""),
  numeroLot: "",
  mois: "",
});

/**
 * LES RÉCEPTIONS
 *
 * Une livraison du grossiste se saisit ligne à ligne, comme on lit le
 * bon de livraison : le médicament, combien, à quel prix, le numéro de
 * lot et le mois de péremption imprimés sur la boîte. Chaque ligne
 * devient un achat (stock, dette fournisseur) et un lot. La commande au
 * grossiste se prépare ici aussi, et devient une réception à la livraison.
 */
export const ReceptionsView: React.FC<Props> = ({
  storeName = "Pharmacie",
  products,
  purchases,
  fournisseurs,
  pharma,
  aujourdhui,
  peutRecevoir,
  onRecue,
}) => {
  const [ouverte, setOuverte] = useState(false);
  const [commande, setCommande] = useState(false);
  const [fournisseur, setFournisseur] = useState("");
  const [date, setDate] = useState(aujourdhui);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [recherche, setRecherche] = useState("");
  const [reglement, setReglement] = useState<Reglement>("tout");
  const [paye, setPaye] = useState("");
  const [echeance, setEcheance] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const actifs = useMemo(() => products.filter((p) => p.statut !== "archive"), [products]);
  const trouves = recherche.trim()
    ? actifs.filter((p) => correspond(p, pharma.ficheDe.get(p.id), recherche)).slice(0, 8)
    : [];
  const sousLeSeuil = actifs.filter((p) => p.seuilAlerte > 0 && p.stockActuel <= p.seuilAlerte);

  const ajouter = (p: Product) => {
    setLignes((ls) => [...ls, nouvelleLigne(p)]);
    setRecherche("");
  };
  /** Une boîte scannée : sa ligne s'ajoute ; un code inconnu se signale. */
  const scanner = (code: string) => {
    const c = codePropre(code);
    const p = actifs.find((x) => codePropre(x.codeBarres) === c);
    if (p) {
      setErreur(null);
      ajouter(p);
    } else {
      setRecherche("");
      setErreur(
        `Le code ${c} n'est attaché à aucun médicament. Ajoutez-le dans sa fiche, ou cherchez-le par son nom.`,
      );
    }
  };
  useDouchette(scanner, ouverte);
  /** Les grossistes des dernières livraisons, le plus récent d'abord. */
  const grossistesRecents = useMemo(() => {
    const vus: string[] = [];
    for (const a of [...purchases].sort((x, y) => y.date.localeCompare(x.date))) {
      const n = a.fournisseur?.trim();
      if (n && !vus.includes(n)) vus.push(n);
      if (vus.length >= 4) break;
    }
    return vus;
  }, [purchases]);
  const changer = (cle: string, champ: Partial<Ligne>) =>
    setLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, ...champ } : l)));

  const totalLigne = (l: Ligne) => {
    const q = nombre(l.quantite);
    const p = nombre(l.prix);
    return Number.isFinite(q) && Number.isFinite(p) ? q * p : 0;
  };
  const total = lignes.reduce((n, l) => n + totalLigne(l), 0);

  const vider = () => {
    setLignes([]);
    setFournisseur("");
    setReglement("tout");
    setPaye("");
    setEcheance("");
    setErreur(null);
  };

  const recevoirCommande = (cmd: LigneCommande[], grossiste: string) => {
    setLignes(cmd.map((l) => nouvelleLigne(l.produit, String(l.quantite))));
    setFournisseur(grossiste);
    setCommande(false);
    setOuverte(true);
    setMessage(null);
  };

  const valider = async () => {
    if (envoi) return;
    setErreur(null);
    if (lignes.length === 0) return setErreur("Ajoutez au moins un médicament.");
    for (const l of lignes) {
      const q = nombre(l.quantite);
      if (!Number.isInteger(q) || q <= 0)
        return setErreur(`Quantité invalide pour ${l.produit.displayName}.`);
      if (!Number.isFinite(nombre(l.prix)) || nombre(l.prix) < 0)
        return setErreur(`Prix invalide pour ${l.produit.displayName}.`);
      if (l.mois && !finDeMois(l.mois))
        return setErreur(`Mois de péremption invalide pour ${l.produit.displayName}.`);
    }
    const montantPaye = reglement === "tout" ? null : reglement === "credit" ? 0 : nombre(paye);
    if (
      montantPaye !== null &&
      (!Number.isFinite(montantPaye) || montantPaye < 0 || montantPaye > total)
    )
      return setErreur("Le montant réglé doit être entre 0 et le total.");
    setEnvoi(true);
    const fiche = fournisseurs.find(
      (f) => f.nom.trim().toLowerCase() === fournisseur.trim().toLowerCase(),
    );
    const r = await pharma.recevoir({
      date,
      fournisseur: fournisseur.trim(),
      fournisseurId: fiche?.id ?? null,
      montantPaye,
      dateEcheance: reglement !== "tout" && echeance ? echeance : null,
      lignes: lignes.map((l) =>
        l.conditionnementId
          ? {
              productId: l.produit.id,
              conditionnementId: l.conditionnementId,
              nombre: nombre(l.quantite),
              prixConditionnement: nombre(l.prix),
              numeroLot: l.numeroLot.trim() || null,
              datePeremption: l.mois ? finDeMois(l.mois) : null,
            }
          : {
              productId: l.produit.id,
              quantite: nombre(l.quantite),
              prixAchatUnit: nombre(l.prix),
              numeroLot: l.numeroLot.trim() || null,
              datePeremption: l.mois ? finDeMois(l.mois) : null,
            },
      ),
    });
    setEnvoi(false);
    if (r.error) return setErreur(r.error);
    setMessage(
      `Réception enregistrée : ${lignes.length} ligne${lignes.length > 1 ? "s" : ""}, ${formatCurrency(total)}.`,
    );
    vider();
    setOuverte(false);
    onRecue();
  };

  /** Les dernières livraisons : les achats regroupés par jour et fournisseur. */
  const dernieres = useMemo(() => {
    const groupes = new Map<
      string,
      { date: string; fournisseur: string; lignes: number; total: number; du: number }
    >();
    for (const a of purchases) {
      const cle = `${a.date}|${a.fournisseur}`;
      const g = groupes.get(cle) ?? {
        date: a.date,
        fournisseur: a.fournisseur,
        lignes: 0,
        total: 0,
        du: 0,
      };
      g.lignes += 1;
      g.total += a.totalAchat;
      g.du += Math.max(0, a.soldeDu);
      groupes.set(cle, g);
    }
    return [...groupes.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  }, [purchases]);
  const duAuxGrossistes = purchases.reduce((n, a) => n + Math.max(0, a.soldeDu), 0);
  const ceMois = purchases.filter((a) => a.date.slice(0, 7) === aujourdhui.slice(0, 7));

  return (
    <div className="ph-page">
      <EnTete
        titre="Réceptions"
        sousTitre="Les livraisons des grossistes, lot par lot."
        icone={<Truck className="h-6 w-6" />}
        actions={
          peutRecevoir && (
            <>
              <button type="button" onClick={() => setCommande(true)} className="app-btn-secondary">
                <ClipboardList className="h-4 w-4" />
                Préparer une commande
              </button>
              {!ouverte && (
                <button
                  type="button"
                  onClick={() => {
                    setOuverte(true);
                    setMessage(null);
                  }}
                  className="app-btn-primary"
                >
                  <PackagePlus className="h-4 w-4" />
                  Nouvelle réception
                </button>
              )}
            </>
          )
        }
      >
        <Chiffre
          ton="plein"
          valeur={formatCurrency(ceMois.reduce((n, a) => n + a.totalAchat, 0))}
          libelle="Reçu ce mois"
        />
        <Chiffre
          valeur={formatCurrency(duAuxGrossistes)}
          libelle="À payer aux grossistes"
          ton={duAuxGrossistes > 0 ? "warning" : undefined}
        />
        <Chiffre
          valeur={sousLeSeuil.length}
          libelle="Sous le seuil"
          ton={sousLeSeuil.length ? "danger" : undefined}
          onClick={peutRecevoir ? () => setCommande(true) : undefined}
        />
      </EnTete>

      {message && (
        <p className="ph-panneau border-[var(--croix)] p-3 text-sm font-bold text-[var(--croix)]">
          {message}
        </p>
      )}

      {ouverte && (
        <Panneau titre="Nouvelle réception" icone={<PackagePlus className="h-4 w-4" />} corps>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Grossiste
                </span>
                <input
                  list="fournisseurs-pharma"
                  value={fournisseur}
                  onChange={(e) => setFournisseur(e.target.value)}
                  className="app-field"
                  placeholder="Nom du grossiste"
                />
                <datalist id="fournisseurs-pharma">
                  {fournisseurs.map((f) => (
                    <option key={f.id} value={f.nom} />
                  ))}
                </datalist>
                <Raccourcis
                  libelle="Grossistes récents"
                  options={grossistesRecents}
                  actif={fournisseur}
                  onChoisir={setFournisseur}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Date</span>
                <input
                  type="date"
                  value={date}
                  max={aujourdhui}
                  onChange={(e) => setDate(e.target.value)}
                  className="app-field"
                />
                <Raccourcis
                  libelle="Date de livraison"
                  actif={date}
                  onChoisir={setDate}
                  options={[
                    { valeur: aujourdhui, libelle: "Aujourd'hui" },
                    { valeur: decaler(aujourdhui, -1), libelle: "Hier" },
                  ]}
                />
              </label>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Recherche
                    valeur={recherche}
                    onChange={setRecherche}
                    placeholder="Scannez une boîte, ou tapez son nom"
                    icone={<ScanLine className="h-5 w-5" />}
                    onEntree={() => {
                      const q = recherche.trim();
                      if (!q) return;
                      if (/^\d{8,}$/.test(codePropre(q))) return scanner(q);
                      if (trouves[0]) ajouter(trouves[0]);
                    }}
                  />
                </div>
                <BoutonScan onCode={scanner} titre="Scanner une boîte livrée" />
              </div>
              {trouves.length > 0 && (
                <ul className="ph-liste absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  {trouves.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => ajouter(p)} className="ph-ligne">
                        <Plus className="h-4 w-4 text-primary" />
                        <span className="flex-1 truncate text-sm font-bold">{p.displayName}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.stockActuel} en stock
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {lignes.length === 0 ? (
              <Vide icone={<ScanLine className="h-6 w-6" />}>
                Cherchez les médicaments du bon de livraison, un par un.
              </Vide>
            ) : (
              <ul className="space-y-2">
                {lignes.map((l) => {
                  const d = l.mois ? finDeMois(l.mois) : null;
                  const u = urgence(d, aujourdhui);
                  const alerte = !l.mois
                    ? "Sans date de péremption : vous pourrez la donner plus tard."
                    : u === "perime"
                      ? "Cette date est déjà passée."
                      : u === "un_mois" || u === "trois_mois"
                        ? "Péremption courte : moins de 3 mois."
                        : null;
                  return (
                    <li
                      key={l.cle}
                      className="ph-ligne flex-col !items-stretch rounded-xl border border-border"
                      data-ton={l.mois && alerte ? "warning" : l.mois ? "croix" : undefined}
                    >
                      <div className="flex items-center gap-2">
                        <Pastille nom={l.produit.displayName} className="!h-8 !w-8" />
                        <span className="min-w-0 flex-1 truncate font-bold">
                          {l.produit.displayName}
                        </span>
                        <span className="text-sm font-extrabold tabular-nums">
                          {formatCurrency(totalLigne(l))}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))}
                          className="rounded-lg p-1.5 text-muted-foreground hover:t-danger"
                          aria-label={`Retirer ${l.produit.displayName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                            Quantité
                          </span>
                          <input
                            inputMode="numeric"
                            value={l.quantite}
                            onChange={(e) => changer(l.cle, { quantite: e.target.value })}
                            className="app-field"
                            aria-label={`Quantité reçue de ${l.produit.displayName}`}
                          />
                          {!l.quantite && (
                            <Raccourcis
                              libelle="Quantités courantes"
                              options={["10", "20", "50", "100"]}
                              onChoisir={(q) => changer(l.cle, { quantite: q })}
                            />
                          )}
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                            Reçu par
                          </span>
                          <select
                            value={l.conditionnementId}
                            onChange={(e) => {
                              const c = l.produit.conditionnements.find(
                                (x) => x.id === e.target.value,
                              );
                              changer(l.cle, {
                                conditionnementId: e.target.value,
                                prix: String(
                                  c ? prixAchatDe(c, l.produit) : l.produit.prixAchat || "",
                                ),
                              });
                            }}
                            className="app-field"
                          >
                            <option value="">{libelleUnite(l.produit.unite) || "unité"}</option>
                            {l.produit.conditionnements.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nom} ({c.quantite})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                            Prix d&apos;achat
                          </span>
                          <input
                            inputMode="decimal"
                            value={l.prix}
                            onChange={(e) => changer(l.cle, { prix: e.target.value })}
                            className="app-field"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                            N° de lot
                          </span>
                          <input
                            value={l.numeroLot}
                            onChange={(e) =>
                              changer(l.cle, { numeroLot: e.target.value.toUpperCase() })
                            }
                            className="app-field font-mono uppercase"
                            aria-label={`Numéro de lot de ${l.produit.displayName}`}
                          />
                        </label>
                        <label className="col-span-2 block sm:col-span-1">
                          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                            Périme fin
                          </span>
                          <input
                            type="month"
                            value={l.mois}
                            onChange={(e) => changer(l.cle, { mois: e.target.value })}
                            className="app-field"
                            aria-label={`Mois de péremption de ${l.produit.displayName}`}
                          />
                          <Raccourcis
                            libelle="Péremption"
                            actif={l.mois}
                            onChoisir={(m) => changer(l.cle, { mois: m })}
                            options={[1, 2, 3].map((n) => ({
                              valeur: moisDans(date || aujourdhui, n),
                              libelle: `+${n} an${n > 1 ? "s" : ""}`,
                            }))}
                          />
                        </label>
                      </div>
                      {alerte && (
                        <p
                          className={`flex items-center gap-1.5 text-xs ${
                            l.mois ? "font-semibold t-warning" : "text-muted-foreground"
                          }`}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {alerte}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="space-y-3 rounded-xl bg-muted/60 p-3">
              <div className="flex items-baseline justify-between">
                <span className="font-bold">Total de la livraison</span>
                <span className="ph-total text-2xl">{formatCurrency(total)}</span>
              </div>
              <Segments
                libelle="Règlement"
                valeur={reglement}
                onChange={setReglement}
                options={[
                  { cle: "tout", libelle: "Payé" },
                  { cle: "partiel", libelle: "Payé en partie" },
                  { cle: "credit", libelle: "À crédit" },
                ]}
              />
              {reglement !== "tout" && (
                <div className="grid grid-cols-2 gap-3">
                  {reglement === "partiel" && (
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                        Montant réglé
                      </span>
                      <input
                        inputMode="decimal"
                        value={paye}
                        onChange={(e) => setPaye(e.target.value)}
                        className="app-field"
                      />
                      {total > 0 && (
                        <Raccourcis
                          libelle="Montant réglé"
                          actif={paye}
                          onChoisir={setPaye}
                          options={[
                            { valeur: String(Math.round(total / 2)), libelle: "La moitié" },
                            { valeur: String(Math.round(total / 4)), libelle: "Un quart" },
                          ]}
                        />
                      )}
                    </label>
                  )}
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                      À payer avant le
                    </span>
                    <input
                      type="date"
                      value={echeance}
                      onChange={(e) => setEcheance(e.target.value)}
                      className="app-field"
                    />
                    <Raccourcis
                      libelle="Échéance"
                      actif={echeance}
                      onChoisir={setEcheance}
                      options={[15, 30, 60].map((j) => ({
                        valeur: decaler(date || aujourdhui, j),
                        libelle: `${j} jours`,
                      }))}
                    />
                  </label>
                </div>
              )}
              {erreur && <p className="text-sm font-semibold t-danger">{erreur}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    vider();
                    setOuverte(false);
                  }}
                  className="app-btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={valider}
                  disabled={envoi || lignes.length === 0}
                  className="app-btn-primary"
                >
                  {envoi ? "Enregistrement…" : "Enregistrer la réception"}
                </button>
              </div>
            </div>
          </div>
        </Panneau>
      )}

      <Panneau titre="Dernières livraisons" icone={<Truck className="h-4 w-4" />}>
        {dernieres.length === 0 ? (
          <Vide>Aucune livraison enregistrée.</Vide>
        ) : (
          <ul className="ph-liste">
            {dernieres.map((g) => (
              <li
                key={`${g.date}|${g.fournisseur}`}
                className="ph-ligne"
                data-ton={g.du > 0 ? "warning" : undefined}
              >
                <span className="w-20 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                  {dateCourte(g.date)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {g.fournisseur || "Sans fournisseur"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {g.lignes} ligne{g.lignes > 1 ? "s" : ""}
                    {g.du > 0 ? ` · ${formatCurrency(g.du)} à payer` : ""}
                  </span>
                </span>
                <span className="text-sm font-extrabold tabular-nums">
                  {formatCurrency(g.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panneau>

      {commande && (
        <CommandeGrossiste
          storeName={storeName}
          products={actifs}
          fournisseurs={fournisseurs.map((f) => f.nom)}
          onFermer={() => setCommande(false)}
          onRecevoir={recevoirCommande}
        />
      )}
    </div>
  );
};
