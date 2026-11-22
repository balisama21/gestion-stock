import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  FileText,
  Flame,
  Minus,
  Package,
  Plus,
  Printer,
  Repeat,
  ScanLine,
  ScrollText,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import type { Product, Sale } from "../../types";
import type { Database } from "../../lib/database.types";
import { formatCurrency } from "../../utils/formulas";
import { MODES_DE_PAIEMENT } from "../facturation/paiement";
import { prixVenteDe } from "../../lib/conditionnements";
import {
  correspond,
  equivalents,
  etatStock,
  exigeOrdonnance,
  partsTiersPayant,
} from "../../lib/pharmacie";
import { inscrireOrdonnance, useOrdonnances, type Pharmacie } from "../../hooks/usePharmacie";
import { BadgeFroid, BadgePeremption, BadgeRegime } from "./badges";
import { Boite, Chiffre, EnTete, Panneau, Pastille, Recherche, Vide } from "./ui";
import { TicketPharmacie, type TicketDelivrance } from "./TicketPharmacie";
import { Raccourcis } from "./ui";
import { BoutonScan } from "../shared/BoutonScan";
import { codePropre, useDouchette } from "../../hooks/useDouchette";
import { lireGS1 } from "../../lib/gs1";
import { useMemoireSaisie } from "../../hooks/useMemoireSaisie";

type Client = Database["public"]["Tables"]["clients"]["Row"];

export interface LigneDeVente {
  productId: string;
  quantite: number;
  prixVenteUnit: number;
  conditionnementId?: string;
  nombre?: number;
  prixConditionnement?: number;
}

interface Props {
  storeId: string;
  storeName: string;
  products: Product[];
  sales: Sale[];
  clients: Client[];
  pharma: Pharmacie;
  aujourdhui: string;
  vendeur: string;
  onVendre: (panier: {
    date: string;
    vendeur: string;
    clientCredit: string | null;
    clientId: string | null;
    montantPaye: number;
    methode: string;
    lignes: LigneDeVente[];
  }) => Promise<{ ventes: Sale[]; error: string | null }>;
  /** Attache un code-barres inconnu à un médicament : il sera reconnu ensuite. */
  onAssocierCode?: (productId: string, code: string) => Promise<{ error: string | null }>;
}

interface Article {
  cle: string;
  produit: Product;
  /** "" : l'unité de base. */
  conditionnementId: string;
  nombre: number;
  posologie: string;
}

const nomClient = (c: Client) => [c.prenom, c.nom].filter(Boolean).join(" ").trim() || c.nom;
const nombre = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

/** Les posologies qu'on écrit le plus souvent, à un geste. */
const POSOLOGIES = [
  "1 matin et soir",
  "1 trois fois par jour",
  "1 le soir",
  "Si douleur, 6 h d'écart",
  "Pendant 5 jours",
  "Pendant 7 jours",
];

/** Combien d'unités de base et à quel prix, pour une ligne du panier. */
function chiffrer(a: Article) {
  const c = a.produit.conditionnements.find((x) => x.id === a.conditionnementId);
  if (!c) {
    return {
      unites: a.nombre,
      montant: a.nombre * a.produit.prixVenteDefaut,
      libelle: `${a.nombre} ${a.produit.unite || "unité"}${a.nombre > 1 ? "s" : ""}`,
      prix: a.produit.prixVenteDefaut,
    };
  }
  const prix = prixVenteDe(c, a.produit);
  return {
    unites: a.nombre * c.quantite,
    montant: a.nombre * prix,
    libelle: `${a.nombre} ${c.nom}${a.nombre > 1 ? "s" : ""} de ${c.quantite}`,
    prix,
  };
}

/**
 * LE COMPTOIR
 *
 * Ce que le pharmacien fait cent fois par jour : chercher (nom, molécule,
 * code-barres), voir d'un coup d'œil le stock, la péremption et s'il faut
 * une ordonnance, proposer un équivalent quand ça manque, écrire la
 * posologie, puis encaisser — avec la part d'une assurance quand le
 * patient en a une. Une vente sur ordonnance s'inscrit d'elle-même à
 * l'ordonnancier, et le ticket rappelle la posologie de chaque boîte.
 */
export const ComptoirView: React.FC<Props> = ({
  storeId,
  storeName,
  products,
  sales,
  clients,
  pharma,
  aujourdhui,
  vendeur,
  onVendre,
  onAssocierCode,
}) => {
  const [recherche, setRecherche] = useState("");
  const [toutVoir, setToutVoir] = useState(false);
  const [inconnu, setInconnu] = useState<string | null>(null);
  const [chercheAssoc, setChercheAssoc] = useState("");
  const [prescripteurs, retenirPrescripteur] = useMemoireSaisie(`tn-prescripteurs:${storeId}`);
  const [panier, setPanier] = useState<Article[]>([]);
  const [organismeId, setOrganismeId] = useState("");
  const [matricule, setMatricule] = useState("");
  const [avecOrdonnance, setAvecOrdonnance] = useState(false);
  const [patient, setPatient] = useState({ nom: "", age: "", telephone: "", clientId: "" });
  const [prescripteur, setPrescripteur] = useState("");
  const [datePrescription, setDatePrescription] = useState("");
  const [methode, setMethode] = useState<string>("especes");
  const [recu, setRecu] = useState("");
  const [credit, setCredit] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<TicketDelivrance | null>(null);
  const [ticketOuvert, setTicketOuvert] = useState(false);

  const actifs = useMemo(
    () => products.filter((p) => p.statut !== "archive" && p.statut !== "inactif"),
    [products],
  );
  const duJour = useMemo(() => sales.filter((s) => s.date === aujourdhui), [sales, aujourdhui]);
  const ordonnancesDuJour = useOrdonnances(storeId, aujourdhui, aujourdhui);
  /**
   * Tous les médicaments, du plus demandé ces trente derniers jours au
   * moins demandé, puis par nom ; et combien en tête se sont vendus.
   */
  const { parDemande, vendus } = useMemo(() => {
    const depuis = new Date(Date.parse(`${aujourdhui}T00:00:00Z`) - 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    const n = new Map<string, number>();
    for (const s of sales) {
      if (s.productId && s.date >= depuis)
        n.set(s.productId, (n.get(s.productId) ?? 0) + s.quantite);
    }
    const tries = [...actifs].sort(
      (a, b) =>
        (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0) || a.displayName.localeCompare(b.displayName, "fr"),
    );
    return { parDemande: tries, vendus: tries.filter((p) => n.has(p.id)).length };
  }, [sales, actifs, aujourdhui]);
  /** Les raccourcis du comptoir : les plus demandés, ou tous sur demande. */
  const enVitrine = toutVoir ? parDemande.slice(0, 200) : parDemande.slice(0, 8);

  const resultats = recherche.trim()
    ? actifs.filter((p) => correspond(p, pharma.ficheDe.get(p.id), recherche)).slice(0, 12)
    : enVitrine;

  /** Le médicament qui porte ce code-barres, s'il y en a un. */
  const parCode = (code: string) => {
    const c = codePropre(code);
    return c ? actifs.find((p) => codePropre(p.codeBarres) === c) : undefined;
  };
  const scanner = (code: string) => {
    const p = parCode(code);
    setChercheAssoc("");
    if (!p) {
      setRecherche("");
      setInconnu(codePropre(code));
      return;
    }
    setInconnu(null);
    const e = etatStock(p, pharma.lots, aujourdhui);
    if (p.stockActuel - e.perime <= 0) {
      // En rupture : on le montre, avec ses équivalents en stock.
      setRecherche(p.displayName);
      return;
    }
    ajouter(p);
  };
  // Une douchette lue alors que le curseur n'est dans aucun champ.
  useDouchette(scanner);
  const pourAssocier = inconnu
    ? actifs
        .filter((p) => correspond(p, pharma.ficheDe.get(p.id), chercheAssoc))
        .sort((a, b) => Number(!!a.codeBarres) - Number(!!b.codeBarres))
        .slice(0, 6)
    : [];
  const associer = async (p: Product) => {
    if (!inconnu || !onAssocierCode) return;
    const r = await onAssocierCode(p.id, inconnu);
    if (r.error) return setErreur(r.error);
    setInconnu(null);
    ajouter(p);
  };

  const organismes = pharma.organismes
    .filter((o) => o.actif)
    .map((o) => ({ ...o, client: clients.find((c) => c.id === o.client_id) }))
    .filter((o) => o.client);
  const organisme = organismes.find((o) => o.client_id === organismeId) ?? null;

  const lignes = panier.map((a) => ({ article: a, ...chiffrer(a) }));
  const total = lignes.reduce((n, l) => n + l.montant, 0);
  const parts = organisme
    ? partsTiersPayant(total, organisme.taux)
    : { organisme: 0, patient: total };
  const ordonnanceExigee =
    panier.some((a) => exigeOrdonnance(pharma.ficheDe.get(a.produit.id)?.regime)) || !!organisme;
  const ordonnance = ordonnanceExigee || avecOrdonnance;
  const montantRecu = recu.trim() ? nombre(recu) : parts.patient;
  const rendu = Number.isFinite(montantRecu) ? Math.max(0, montantRecu - parts.patient) : 0;
  /** Les billets qu'on tend le plus souvent pour ce montant. */
  const billets = (() => {
    const a = parts.patient;
    if (a <= 0) return [];
    const v = new Set<number>();
    for (const pas of [1000, 2000, 5000, 10000, 20000]) {
      const b = Math.ceil(a / pas) * pas;
      if (b > a) v.add(b);
    }
    return [...v].sort((x, y) => x - y).slice(0, 3);
  })();

  const ajouter = (p: Product, conditionnementId = "") => {
    setFait(null);
    setErreur(null);
    setPanier((ps) => {
      const deja = ps.find(
        (a) => a.produit.id === p.id && a.conditionnementId === conditionnementId,
      );
      if (deja) return ps.map((a) => (a === deja ? { ...a, nombre: a.nombre + 1 } : a));
      return [
        ...ps,
        {
          cle: `${p.id}-${conditionnementId}-${Date.now()}`,
          produit: p,
          conditionnementId,
          nombre: 1,
          posologie: "",
        },
      ];
    });
    setRecherche("");
  };
  const changerArticle = (cle: string, champ: Partial<Article>) =>
    setPanier((ps) => ps.map((a) => (a.cle === cle ? { ...a, ...champ } : a)));
  const changerNombre = (cle: string, delta: number) =>
    setPanier((ps) =>
      ps.flatMap((a) =>
        a.cle !== cle ? [a] : a.nombre + delta <= 0 ? [] : [{ ...a, nombre: a.nombre + delta }],
      ),
    );

  const vider = () => {
    setPanier([]);
    setOrganismeId("");
    setMatricule("");
    setAvecOrdonnance(false);
    setPatient({ nom: "", age: "", telephone: "", clientId: "" });
    setPrescripteur("");
    setDatePrescription("");
    setRecu("");
    setCredit(false);
    setErreur(null);
  };

  const encaisser = async () => {
    if (envoi || panier.length === 0) return;
    setErreur(null);
    // Le stock délivrable : ce qui n'est pas périmé.
    for (const l of lignes) {
      const e = etatStock(l.article.produit, pharma.lots, aujourdhui);
      const deja = lignes
        .filter((x) => x.article.produit.id === l.article.produit.id)
        .reduce((n, x) => n + x.unites, 0);
      if (deja > l.article.produit.stockActuel - e.perime) {
        return setErreur(
          `${l.article.produit.displayName} : seulement ${Math.max(
            0,
            l.article.produit.stockActuel - e.perime,
          )} délivrable(s)${e.perime > 0 ? ` (${e.perime} périmé(s) à retirer)` : ""}.`,
        );
      }
    }
    if (ordonnance && !patient.nom.trim())
      return setErreur("Écrivez le nom du patient : la vente s'inscrit à l'ordonnancier.");
    const patientClient = clients.find((c) => c.id === patient.clientId) ?? null;
    let montantPaye = parts.patient;
    if (!organisme && credit) {
      if (!patientClient)
        return setErreur("Une vente à crédit se fait au nom d'un patient enregistré.");
      // Rien d'écrit : tout part à crédit.
      const verse = recu.trim() ? nombre(recu) : 0;
      montantPaye = Number.isFinite(verse) ? Math.min(Math.max(0, verse), total) : 0;
    } else if (Number.isFinite(montantRecu) && montantRecu < parts.patient) {
      return setErreur(`Le patient doit ${formatCurrency(parts.patient)}.`);
    }

    setEnvoi(true);
    const res = await onVendre({
      date: aujourdhui,
      vendeur,
      // Avec un tiers payant, c'est l'organisme qui doit le reste : la vente est à son nom.
      clientId: organisme ? organisme.client_id : (patientClient?.id ?? null),
      clientCredit: organisme
        ? nomClient(organisme.client!)
        : patientClient
          ? nomClient(patientClient)
          : patient.nom.trim() || null,
      montantPaye,
      methode,
      lignes: lignes.map(({ article: a, unites, montant, prix }) =>
        a.conditionnementId
          ? {
              productId: a.produit.id,
              quantite: unites,
              prixVenteUnit: unites > 0 ? montant / unites : 0,
              conditionnementId: a.conditionnementId,
              nombre: a.nombre,
              prixConditionnement: prix,
            }
          : { productId: a.produit.id, quantite: unites, prixVenteUnit: a.produit.prixVenteDefaut },
      ),
    });
    if (res.error || res.ventes.length === 0) {
      setEnvoi(false);
      return setErreur(res.error ?? "La vente n'a pas pu être enregistrée.");
    }
    let numero: number | null = null;
    if (ordonnance) {
      const o = await inscrireOrdonnance(storeId, {
        patientNom: patient.nom,
        patientAge: patient.age,
        patientTelephone: patient.telephone,
        patientClientId: patientClient?.id ?? null,
        prescripteur,
        datePrescription: datePrescription || null,
        organismeId: organisme?.client_id ?? null,
        matricule,
        partOrganisme: parts.organisme,
        ticketId: res.ventes[0].ticketId ?? null,
        notes: null,
      });
      if (o.error) {
        setEnvoi(false);
        vider();
        return setErreur(
          `Vente enregistrée, mais l'ordonnance n'a pas pu s'inscrire : ${o.error}. Ajoutez-la depuis l'ordonnancier.`,
        );
      }
      numero = o.ordonnance?.numero ?? null;
    }
    const maintenant = new Date();
    setFait({
      boutique: storeName,
      date: aujourdhui.split("-").reverse().join("/"),
      heure: maintenant.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      vendeur,
      lignes: lignes.map((l) => ({
        designation: l.article.produit.displayName,
        quantite: l.libelle,
        montant: l.montant,
        posologie: l.article.posologie.trim(),
      })),
      total,
      partOrganisme: parts.organisme,
      organisme: organisme ? nomClient(organisme.client!) : null,
      paye: montantPaye,
      rendu: !credit ? rendu : 0,
      patient: patient.nom.trim() || null,
      ordonnance: numero,
      prescripteur: prescripteur.trim() || null,
    });
    if (ordonnance) {
      retenirPrescripteur(prescripteur);
      void ordonnancesDuJour.recharger();
    }
    setEnvoi(false);
    vider();
    void pharma.recharger();
  };

  return (
    <div className="ph-page">
      <EnTete
        titre="Comptoir"
        sousTitre="Cherchez, délivrez, encaissez."
        icone={<ShoppingBasket className="h-6 w-6" />}
      >
        <Chiffre
          ton="plein"
          valeur={formatCurrency(duJour.reduce((n, s) => n + s.totalVente, 0))}
          libelle="Vendu aujourd'hui"
        />
        <Chiffre
          valeur={new Set(duJour.map((s) => s.ticketId ?? s.id)).size}
          libelle="Clients servis"
        />
        <Chiffre
          valeur={ordonnancesDuJour.ordonnances.length}
          libelle="Ordonnances"
          icone={<ScrollText className="h-3 w-3" />}
        />
      </EnTete>

      <div className="grid gap-5 lg:grid-cols-[1fr_25rem]">
        <div className="min-w-0 space-y-3">
          <Recherche
            valeur={recherche}
            onChange={(v) => {
              setRecherche(v);
              if (v) {
                setInconnu(null);
                setToutVoir(false);
              }
            }}
            placeholder="Médicament, molécule ou code-barres…"
            icone={<Search className="h-5 w-5" />}
            autoFocus
            fin={
              <BoutonScan
                onCode={scanner}
                titre="Scanner une boîte"
                libelle="Scanner une boîte"
                classeBouton="ph-bouton-scan"
              />
            }
            onEntree={() => {
              const q = recherche.trim();
              if (!q) return;
              // Un code-barres (tapé ou lu par la douchette dans le champ).
              if (
                parCode(q) ||
                lireGS1(q) ||
                (/^\d{8,}$/.test(codePropre(q)) && resultats.length === 0)
              )
                return scanner(q);
              if (resultats[0]) ajouter(resultats[0]);
            }}
          />
          {inconnu && (
            <Panneau
              titre="Code-barres inconnu"
              icone={<ScanLine className="h-4 w-4" />}
              action={
                <button type="button" onClick={() => setInconnu(null)}>
                  Fermer
                </button>
              }
            >
              <div className="space-y-2 p-3">
                <p className="text-sm">
                  Le code <span className="ph-lot">{inconnu}</span> n&apos;est attaché à aucun
                  médicament.
                  {onAssocierCode &&
                    " Choisissez lequel c'est : il sera reconnu au prochain passage."}
                </p>
                {onAssocierCode && (
                  <>
                    <input
                      value={chercheAssoc}
                      onChange={(e) => setChercheAssoc(e.target.value)}
                      placeholder="Nom ou molécule du médicament"
                      className="app-field"
                      autoFocus
                    />
                    <ul className="ph-liste rounded-xl border border-border">
                      {pourAssocier.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => void associer(p)}
                            className="ph-ligne"
                          >
                            <Pastille nom={p.displayName} />
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                              {p.displayName}
                            </span>
                            <span className="text-xs font-bold text-primary">
                              {p.codeBarres ? "Remplacer le code" : "C'est lui"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </Panneau>
          )}
          <Panneau
            titre={
              recherche.trim()
                ? `${resultats.length} résultat(s)`
                : toutVoir
                  ? `Tous les médicaments · ${actifs.length}`
                  : vendus > 0
                    ? "Les plus demandés"
                    : "Vos médicaments"
            }
            icone={
              recherche.trim() ? <Search className="h-4 w-4" /> : <Flame className="h-4 w-4" />
            }
            action={
              !recherche.trim() &&
              actifs.length > 8 && (
                <button type="button" onClick={() => setToutVoir((v) => !v)}>
                  {toutVoir ? "Réduire" : "Voir tout"}
                  {!toutVoir && <ArrowRight className="h-4 w-4" />}
                </button>
              )
            }
          >
            {resultats.length === 0 ? (
              <Vide>
                {recherche.trim()
                  ? "Aucun médicament ne correspond."
                  : "Tapez le nom d'un médicament ou de sa molécule."}
              </Vide>
            ) : (
              <ul className="ph-liste">
                {resultats.map((p) => {
                  const fiche = pharma.ficheDe.get(p.id);
                  const e = etatStock(p, pharma.lots, aujourdhui);
                  const delivrable = p.stockActuel - e.perime;
                  const equiv =
                    delivrable <= 0
                      ? equivalents(p, pharma.ficheDe, actifs)
                          .filter((x) => x.stockActuel > 0)
                          .slice(0, 3)
                      : [];
                  return (
                    <li
                      key={p.id}
                      className="ph-ligne ph-produit flex-wrap"
                      data-ton={delivrable <= 0 ? "danger" : undefined}
                    >
                      <Boite nom={p.displayName} dosage={fiche?.dosage} />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5">
                          <span className="ph-produit-nom">{p.displayName}</span>
                          <BadgeRegime regime={fiche?.regime} />
                          <BadgeFroid conservation={fiche?.conservation} />
                        </p>
                        <p className="truncate text-[0.8rem] text-muted-foreground">
                          {[
                            fiche?.dci,
                            fiche?.forme,
                            fiche?.emplacement && `Rayon ${fiche.emplacement}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`ph-produit-stock ${
                              delivrable <= 0
                                ? "t-danger"
                                : delivrable <= p.seuilAlerte
                                  ? "t-warning"
                                  : "text-primary"
                            }`}
                          >
                            <Package className="h-3.5 w-3.5" />
                            {delivrable <= 0 ? "Rupture" : `${delivrable} en stock`}
                          </span>
                          {e.prochaine && (
                            <BadgePeremption date={e.prochaine} aujourdhui={aujourdhui} />
                          )}
                          {e.perime > 0 && (
                            <span className="font-semibold t-danger">
                              {e.perime} périmé(s) à retirer
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="ph-produit-prix">{formatCurrency(p.prixVenteDefaut)}</span>
                        {delivrable > 0 && (
                          <div className="flex flex-col items-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => ajouter(p)}
                              className="ph-bouton-ajout"
                            >
                              <Plus className="h-4 w-4" />
                              {p.unite || "Unité"}
                            </button>
                            {p.conditionnements.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => ajouter(p, c.id)}
                                className="ph-bouton-ajout"
                                data-variante="clair"
                              >
                                <Plus className="h-4 w-4" />
                                {c.nom} · {formatCurrency(prixVenteDe(c, p))}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {equiv.length > 0 && (
                        <div className="w-full rounded-lg bg-[var(--croix-soft)] p-2 text-xs">
                          <p className="mb-1 flex items-center gap-1 font-bold text-[var(--croix)]">
                            <Repeat className="h-3.5 w-3.5" />
                            Équivalents en stock
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {equiv.map((x) => (
                              <button
                                key={x.id}
                                type="button"
                                onClick={() => ajouter(x)}
                                className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold hover:border-primary"
                              >
                                {x.displayName} · {formatCurrency(x.prixVenteDefaut)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panneau>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          {fait && (
            <div className="ph-panneau border-[var(--croix)] p-4 text-sm">
              <p className="flex items-center gap-2 font-extrabold text-[var(--croix)]">
                <CheckCircle2 className="h-5 w-5" />
                Délivrance enregistrée · {formatCurrency(fait.total)}
              </p>
              {fait.rendu > 0 && (
                <p className="mt-1 text-lg font-extrabold">
                  À rendre : {formatCurrency(fait.rendu)}
                </p>
              )}
              {fait.ordonnance !== null && (
                <p className="mt-1">Inscrite à l&apos;ordonnancier sous le n° {fait.ordonnance}.</p>
              )}
              <button
                type="button"
                onClick={() => setTicketOuvert(true)}
                className="app-btn-secondary mt-3 w-full"
              >
                <Printer className="h-4 w-4" />
                Ticket avec posologie
              </button>
            </div>
          )}

          <section className="ph-ticket">
            <div className="ph-ticket-tete">
              <ShoppingBasket className="h-5 w-5" />
              Délivrance
              <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {panier.reduce((n, a) => n + a.nombre, 0)} article(s)
              </span>
            </div>

            <div className="p-3">
              {panier.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Ajoutez les médicaments demandés.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lignes.map(({ article: a, montant, libelle }) => (
                    <li key={a.cle} className="rounded-xl border border-border p-2.5 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{a.produit.displayName}</span>
                          <span className="block text-xs text-muted-foreground">{libelle}</span>
                        </span>
                        <span className="font-extrabold tabular-nums">
                          {formatCurrency(montant)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => changerNombre(a.cle, -1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border"
                            aria-label="Un de moins"
                          >
                            {a.nombre === 1 ? (
                              <Trash2 className="h-3.5 w-3.5" />
                            ) : (
                              <Minus className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <span className="w-7 text-center font-bold tabular-nums">{a.nombre}</span>
                          <button
                            type="button"
                            onClick={() => changerNombre(a.cle, 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border"
                            aria-label="Un de plus"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </span>
                        <input
                          list="posologies-pharma"
                          value={a.posologie}
                          onChange={(e) => changerArticle(a.cle, { posologie: e.target.value })}
                          placeholder="Posologie"
                          className="app-field h-8 min-w-0 flex-1 text-xs"
                          aria-label={`Posologie de ${a.produit.displayName}`}
                        />
                      </div>
                      {!a.posologie && (
                        <Raccourcis
                          libelle="Posologies courantes"
                          options={POSOLOGIES.slice(0, 4)}
                          onChoisir={(p) => changerArticle(a.cle, { posologie: p })}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <datalist id="posologies-pharma">
                {POSOLOGIES.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            {organismes.length > 0 && (
              <div className="ph-ticket-coupe space-y-2 p-3">
                <label className="block">
                  <span className="mb-1 flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Tiers payant
                  </span>
                  <select
                    value={organismeId}
                    onChange={(e) => setOrganismeId(e.target.value)}
                    className="app-field"
                  >
                    <option value="">Aucun : le patient paie tout</option>
                    {organismes.map((o) => (
                      <option key={o.client_id} value={o.client_id}>
                        {nomClient(o.client!)} · {o.taux} %
                      </option>
                    ))}
                  </select>
                </label>
                {organisme && (
                  <input
                    value={matricule}
                    onChange={(e) => setMatricule(e.target.value)}
                    placeholder="N° d'assuré ou matricule"
                    className="app-field"
                  />
                )}
              </div>
            )}

            <div className="ph-ticket-coupe space-y-2 p-3">
              {ordonnanceExigee ? (
                <p className="flex items-center gap-1.5 text-xs font-bold t-warning">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Ordonnance requise : la vente s&apos;inscrit à l&apos;ordonnancier.
                </p>
              ) : (
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={avecOrdonnance}
                    onChange={(e) => setAvecOrdonnance(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Sur ordonnance
                </label>
              )}
              {(ordonnance || credit) && (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={patient.clientId}
                    onChange={(e) => {
                      const c = clients.find((x) => x.id === e.target.value);
                      setPatient({
                        ...patient,
                        clientId: e.target.value,
                        nom: c ? nomClient(c) : patient.nom,
                        telephone: c?.telephone ?? patient.telephone,
                      });
                    }}
                    className="app-field col-span-2"
                    aria-label="Patient enregistré"
                  >
                    <option value="">Patient non enregistré</option>
                    {clients
                      .filter((c) => !pharma.organismes.some((o) => o.client_id === c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {nomClient(c)}
                        </option>
                      ))}
                  </select>
                  <input
                    value={patient.nom}
                    onChange={(e) => setPatient({ ...patient, nom: e.target.value })}
                    placeholder="Nom du patient"
                    className="app-field col-span-2"
                  />
                  {ordonnance && (
                    <>
                      <input
                        value={patient.age}
                        onChange={(e) => setPatient({ ...patient, age: e.target.value })}
                        placeholder="Âge"
                        className="app-field"
                      />
                      <input
                        value={patient.telephone}
                        onChange={(e) => setPatient({ ...patient, telephone: e.target.value })}
                        placeholder="Téléphone"
                        className="app-field"
                      />
                      <div className="col-span-2">
                        <input
                          value={prescripteur}
                          onChange={(e) => setPrescripteur(e.target.value)}
                          placeholder="Médecin prescripteur"
                          className="app-field"
                        />
                        <Raccourcis
                          libelle="Médecins récents"
                          options={prescripteurs.slice(0, 4)}
                          actif={prescripteur}
                          onChoisir={setPrescripteur}
                        />
                      </div>
                      <label className="col-span-2 block">
                        <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                          Date de l&apos;ordonnance
                        </span>
                        <input
                          type="date"
                          value={datePrescription}
                          max={aujourdhui}
                          onChange={(e) => setDatePrescription(e.target.value)}
                          className="app-field"
                        />
                        <Raccourcis
                          libelle="Date de l'ordonnance"
                          actif={datePrescription}
                          onChoisir={setDatePrescription}
                          options={[
                            { valeur: aujourdhui, libelle: "Aujourd'hui" },
                            {
                              valeur: new Date(Date.parse(`${aujourdhui}T12:00:00Z`) - 86400000)
                                .toISOString()
                                .slice(0, 10),
                              libelle: "Hier",
                            },
                          ]}
                        />
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="ph-ticket-coupe space-y-1 p-3 text-sm">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="font-bold tabular-nums">{formatCurrency(total)}</span>
              </div>
              {organisme && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Part de l&apos;organisme ({organisme.taux} %)</span>
                  <span className="tabular-nums">− {formatCurrency(parts.organisme)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-bold">À payer</span>
                <span className="ph-total text-2xl">{formatCurrency(parts.patient)}</span>
              </div>
            </div>

            <div className="space-y-2 border-t border-border bg-muted/40 p-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={methode}
                  onChange={(e) => setMethode(e.target.value)}
                  className="app-field"
                  aria-label="Moyen de paiement"
                >
                  {MODES_DE_PAIEMENT.map((m) => (
                    <option key={m.valeur} value={m.valeur}>
                      {m.libelle}
                    </option>
                  ))}
                </select>
                <input
                  inputMode="decimal"
                  value={recu}
                  onChange={(e) => setRecu(e.target.value)}
                  placeholder={credit ? "Payé maintenant" : "Reçu (monnaie)"}
                  className="app-field"
                  aria-label="Montant reçu"
                />
              </div>
              {!credit && parts.patient > 0 && (
                <Raccourcis
                  libelle="Montant reçu"
                  actif={recu}
                  onChoisir={setRecu}
                  options={[
                    { valeur: String(parts.patient), libelle: "Compte juste" },
                    ...billets.map((b) => ({ valeur: String(b), libelle: formatCurrency(b) })),
                  ]}
                />
              )}
              {!organisme && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={credit}
                    onChange={(e) => setCredit(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Le patient paiera plus tard (crédit)
                </label>
              )}
              {!credit && recu.trim() && rendu > 0 && (
                <p className="text-sm font-extrabold">À rendre : {formatCurrency(rendu)}</p>
              )}
              {erreur && <p className="text-sm font-semibold t-danger">{erreur}</p>}
              <button
                type="button"
                onClick={encaisser}
                disabled={envoi || panier.length === 0}
                className="app-btn-primary h-12 w-full text-base"
              >
                <Banknote className="h-5 w-5" />
                {envoi ? "Encaissement…" : `Encaisser ${formatCurrency(parts.patient)}`}
              </button>
              {panier.length > 0 && (
                <button
                  type="button"
                  onClick={vider}
                  className="w-full text-xs font-semibold text-muted-foreground"
                >
                  Vider la délivrance
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>
      {fait && ticketOuvert && (
        <TicketPharmacie ticket={fait} onFermer={() => setTicketOuvert(false)} />
      )}
    </div>
  );
};
