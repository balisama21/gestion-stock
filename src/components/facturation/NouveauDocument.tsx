import React, { useMemo, useRef, useState } from "react";
import { ChevronDown, FileText, Plus, X } from "lucide-react";
import { Modal } from "../shared/Modal";
import { useClicExterieur } from "../../hooks/useClicExterieur";
import type { Product } from "../../types";
import type { Database } from "../../lib/database.types";
import { montant as formaterMontant } from "../../features/documents/lib/format";
import { MODES_DE_PAIEMENT } from "./paiement";

type Client = Database["public"]["Tables"]["clients"]["Row"];

/**
 * « + NOUVEAU DOCUMENT »
 *
 * ── LE POINT LE PLUS DÉLICAT DU CAHIER, ET SA RÉPONSE ──────────────
 *
 * « Une même opération ne doit jamais être comptée deux fois, ni dans
 * le chiffre d'affaires, ni dans le stock. »
 *
 * Ce formulaire n'écrit RIEN qui lui soit propre. Établir une facture
 * ici, c'est enregistrer une VENTE — par `create_sale_ticket`, la
 * fonction même qu'appelle la caisse. C'est elle qui verrouille le
 * produit, vérifie le stock disponible, écrit le mouvement, tire le
 * numéro et enregistre l'acompte. La facture est ensuite le DOCUMENT
 * de cette vente, et la page Facturation la relit dans `sales` comme
 * toutes les autres.
 *
 * Le double comptage n'est donc pas évité par un contrôle : il est
 * impossible, parce qu'il n'existe qu'un seul chemin d'écriture.
 *
 * ── UNE LIGNE SANS PRODUIT NE TOUCHE PAS AU STOCK ──────────────────
 *
 * Une prestation n'a pas d'article au catalogue. La ligne part alors
 * sans `product_id`, et la base saute le verrou, le contrôle de stock
 * et le mouvement — mais enregistre bien la recette, sans quoi le
 * tableau de bord ignorerait ce que cette page affiche.
 *
 * ── CE QUI N'EST PAS ICI, ET POURQUOI ──────────────────────────────
 *
 * Le devis, la proforma et la facture reçue d'un fournisseur ont déjà
 * leur écran, avec leur formulaire, leurs lignes et leurs règles. Le
 * menu y conduit au lieu d'en refaire une seconde version : deux
 * formulaires pour une même pièce, c'est deux occasions de diverger.
 */

export type NatureNouveau =
  | "facture"
  | "commission"
  | "recu"
  | "proforma"
  | "devis"
  | "facture_achat";

const CHOIX: { cle: NatureNouveau; libelle: string; detail: string }[] = [
  { cle: "facture", libelle: "Facture", detail: "Produits du catalogue ou prestation" },
  { cle: "recu", libelle: "Reçu", detail: "Une vente réglée comptant" },
  {
    cle: "commission",
    libelle: "Facture de service avec commission",
    detail: "La part que la boutique garde sur la prestation",
  },
  { cle: "proforma", libelle: "Proforma", detail: "Un prix ferme, avant la commande" },
  { cle: "devis", libelle: "Devis", detail: "Une proposition à faire accepter" },
  {
    cle: "facture_achat",
    libelle: "Facture d'achat fournisseur",
    detail: "Ranger la facture reçue d'un fournisseur",
  },
];

export interface LigneNouvelle {
  productId: string;
  designation: string;
  quantite: number;
  prixUnitaire: number;
}

export const LIGNE_VIDE: LigneNouvelle = {
  productId: "",
  designation: "",
  quantite: 1,
  prixUnitaire: 0,
};

export interface SaisieNouveauDocument {
  nature: "facture" | "commission" | "recu";
  date: string;
  clientId: string | null;
  clientNom: string;
  vendeur: string;
  lignes: LigneNouvelle[];
  montantPaye: number;
  methode: string;
  commission: number;
}

/* ─────────────────────────────────────────────────────────────
 * Le menu
 * ───────────────────────────────────────────────────────────── */

export const MenuNouveauDocument: React.FC<{
  onChoisir: (nature: NatureNouveau) => void;
  /** Les natures que cette personne n'a pas le droit d'établir. */
  interdites?: NatureNouveau[];
}> = ({ onChoisir, interdites = [] }) => {
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  useClicExterieur(boite, ouvert, () => setOuvert(false));

  const choix = CHOIX.filter((c) => !interdites.includes(c.cle));

  return (
    <div ref={boite} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        className="app-btn-primary w-full sm:w-auto"
      >
        <Plus className="h-4 w-4" />
        Nouveau document
        <ChevronDown className={`h-4 w-4 transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-72 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          {choix.map((c) => (
            <button
              key={c.cle}
              type="button"
              role="menuitem"
              onClick={() => {
                setOuvert(false);
                onChoisir(c.cle);
              }}
              className="block w-full px-3 py-2 text-left transition-colors hover:bg-muted"
            >
              {/* L'espace explicite separe les deux libelles dans le nom
                  lu a voix haute : sans lui, un lecteur d ecran annonce
                  « FactureProduits du catalogue ». */}
              <span className="block text-sm text-foreground">{c.libelle}</span>{" "}
              <span className="block text-xs text-muted-foreground">{c.detail}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
 * Le formulaire
 * ───────────────────────────────────────────────────────────── */

const TITRES: Record<SaisieNouveauDocument["nature"], string> = {
  facture: "Nouvelle facture",
  recu: "Nouveau reçu",
  commission: "Facture de service avec commission",
};

export const FormulaireNouveauDocument: React.FC<{
  nature: SaisieNouveauDocument["nature"];
  produits: Product[];
  clients: Client[];
  vendeurs: string[];
  moiNom: string;
  aujourdhui: string;
  devise: string;
  enCours: boolean;
  erreur: string | null;
  /** Les lignes reprises d'une pièce qu'on duplique. */
  lignesInitiales?: LigneNouvelle[];
  clientInitial?: { id: string | null; nom: string };
  onFermer: () => void;
  onValider: (saisie: SaisieNouveauDocument) => void;
}> = ({
  nature,
  produits,
  clients,
  vendeurs,
  moiNom,
  aujourdhui,
  devise,
  enCours,
  erreur,
  lignesInitiales,
  clientInitial,
  onFermer,
  onValider,
}) => {
  const [date, setDate] = useState(aujourdhui);
  const [clientId, setClientId] = useState<string>(clientInitial?.id ?? "");
  const [clientNom, setClientNom] = useState(clientInitial?.nom ?? "");
  const [vendeur, setVendeur] = useState(moiNom);
  const [lignes, setLignes] = useState<LigneNouvelle[]>(
    lignesInitiales?.length ? lignesInitiales : [{ ...LIGNE_VIDE }],
  );
  const [methode, setMethode] = useState<string>(MODES_DE_PAIEMENT[0].valeur);
  const [commission, setCommission] = useState("0");

  const total = useMemo(
    () => lignes.reduce((n, l) => n + l.quantite * l.prixUnitaire, 0),
    [lignes],
  );

  /* Un reçu constate un paiement : il part soldé, et le champ ne
     s'affiche pas. Une facture part à zéro, avec un acompte libre. */
  const [paye, setPaye] = useState("0");
  const montantPaye = nature === "recu" ? total : Number(paye) || 0;

  const changer = (i: number, p: Partial<LigneNouvelle>) =>
    setLignes((l) => l.map((ligne, j) => (j === i ? { ...ligne, ...p } : ligne)));

  const choisirProduit = (i: number, id: string) => {
    const p = produits.find((x) => x.id === id);
    changer(i, {
      productId: id,
      designation: p ? p.displayName : lignes[i].designation,
      prixUnitaire: p ? p.prixVenteDefaut : lignes[i].prixUnitaire,
    });
  };

  const argent = (n: number) => formaterMontant(n, devise);
  const valides = lignes.filter((l) => l.quantite > 0 && (l.productId || l.designation.trim()));
  const commissionValeur = Number(commission) || 0;
  const commissionTropGrande = nature === "commission" && commissionValeur > total;
  const payeTropGrand = montantPaye > total;

  return (
    <Modal
      open
      onClose={onFermer}
      size="2xl"
      icon={<FileText className="h-4 w-4" />}
      title={TITRES[nature]}
      description="Le document et la vente sont enregistrés ensemble : rien n'est compté deux fois."
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valides.length === 0 || payeTropGrand || commissionTropGrande) return;
          onValider({
            nature,
            date,
            clientId: clientId || null,
            clientNom: clientNom.trim(),
            vendeur: vendeur.trim(),
            lignes: valides,
            montantPaye,
            methode,
            commission: nature === "commission" ? commissionValeur : 0,
          });
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="nd-date" className="mb-1.5 block text-sm font-medium">
              Date
            </label>
            <input
              id="nd-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="app-field"
            />
          </div>
          <div>
            <label htmlFor="nd-client" className="mb-1.5 block text-sm font-medium">
              Client
            </label>
            <select
              id="nd-client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                const c = clients.find((x) => x.id === e.target.value);
                if (c) setClientNom([c.prenom, c.nom].filter(Boolean).join(" ") || c.entreprise || "");
              }}
              className="app-field"
            >
              <option value="">Client comptoir ou nom libre</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.entreprise || [c.prenom, c.nom].filter(Boolean).join(" ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nd-nom" className="mb-1.5 block text-sm font-medium">
              Nom sur le document
            </label>
            <input
              id="nd-nom"
              type="text"
              value={clientNom}
              onChange={(e) => setClientNom(e.target.value)}
              placeholder="Laisser vide pour « Client comptoir »"
              className="app-field"
            />
          </div>
        </div>

        <div>
          <label htmlFor="nd-vendeur" className="mb-1.5 block text-sm font-medium">
            Vendeur
          </label>
          <input
            id="nd-vendeur"
            type="text"
            list="nd-vendeurs"
            value={vendeur}
            onChange={(e) => setVendeur(e.target.value)}
            className="app-field"
          />
          <datalist id="nd-vendeurs">
            {vendeurs.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Lignes</span>
            <span className="text-xs text-muted-foreground">
              Sans produit du catalogue, la ligne est une prestation : elle ne touche pas au stock.
            </span>
          </div>

          <div className="space-y-3">
            {lignes.map((ligne, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`nd-produit-${i}`}
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      Produit
                    </label>
                    <select
                      id={`nd-produit-${i}`}
                      value={ligne.productId}
                      onChange={(e) => choisirProduit(i, e.target.value)}
                      className="app-field"
                    >
                      <option value="">Prestation — hors catalogue</option>
                      {produits.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.displayName} · {p.stockDisponible} en stock
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={`nd-designation-${i}`}
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      Désignation
                    </label>
                    <input
                      id={`nd-designation-${i}`}
                      type="text"
                      value={ligne.designation}
                      onChange={(e) => changer(i, { designation: e.target.value })}
                      disabled={Boolean(ligne.productId)}
                      placeholder="Ce que le client lira sur sa facture"
                      className="app-field"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-end gap-3">
                  <div className="w-24">
                    <label
                      htmlFor={`nd-quantite-${i}`}
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      Quantité
                    </label>
                    <input
                      id={`nd-quantite-${i}`}
                      type="number"
                      min={1}
                      value={ligne.quantite}
                      onChange={(e) => changer(i, { quantite: Number(e.target.value) })}
                      className="app-field font-mono"
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      htmlFor={`nd-prix-${i}`}
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      Prix unitaire
                    </label>
                    <input
                      id={`nd-prix-${i}`}
                      type="number"
                      min={0}
                      value={ligne.prixUnitaire}
                      onChange={(e) => changer(i, { prixUnitaire: Number(e.target.value) })}
                      className="app-field font-mono"
                    />
                  </div>
                  <div className="w-28 pb-2 text-right font-mono text-sm tabular-nums">
                    {formaterMontant(ligne.quantite * ligne.prixUnitaire, devise)}
                  </div>
                  {lignes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLignes((l) => l.filter((_, j) => j !== i))}
                      aria-label={`Retirer la ligne ${i + 1}`}
                      className="mb-1 inline-flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setLignes((l) => [...l, { ...LIGNE_VIDE }])}
            className="app-btn-secondary mt-2"
          >
            <Plus className="h-4 w-4" />
            Ajouter une ligne
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {nature !== "recu" && (
            <div>
              <label htmlFor="nd-paye" className="mb-1.5 block text-sm font-medium">
                Déjà réglé
              </label>
              <input
                id="nd-paye"
                type="number"
                min={0}
                value={paye}
                onChange={(e) => setPaye(e.target.value)}
                className="app-field font-mono"
              />
              {payeTropGrand && (
                <p className="mt-1 text-xs t-danger">
                  Le montant réglé dépasse le total ({argent(total)}).
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="nd-methode" className="mb-1.5 block text-sm font-medium">
              Mode de paiement
            </label>
            <select
              id="nd-methode"
              value={methode}
              onChange={(e) => setMethode(e.target.value)}
              className="app-field"
            >
              {MODES_DE_PAIEMENT.map((m) => (
                <option key={m.valeur} value={m.valeur}>
                  {m.libelle}
                </option>
              ))}
            </select>
          </div>

          {nature === "commission" && (
            <div>
              <label htmlFor="nd-commission" className="mb-1.5 block text-sm font-medium">
                Commission de la boutique
              </label>
              <input
                id="nd-commission"
                type="number"
                min={0}
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                className="app-field font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Elle est COMPRISE dans le total, elle ne s&apos;y ajoute pas : c&apos;est la part
                que la boutique garde sur ce que le client paie.
              </p>
              {commissionTropGrande && (
                <p className="mt-1 text-xs t-danger">
                  La commission dépasse le total ({argent(total)}).
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-mono text-lg font-medium tabular-nums">{argent(total)}</span>
        </div>

        {erreur && <p className="text-xs t-danger">{erreur}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={enCours || valides.length === 0 || payeTropGrand || commissionTropGrande}
            className="app-btn-primary flex-1"
          >
            {enCours ? "Enregistrement…" : "Établir le document"}
          </button>
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
        </div>
      </form>
    </Modal>
  );
};
