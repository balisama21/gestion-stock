import React, { useMemo, useState } from "react";
import { Truck, Plus, Trash2, Edit3, MapPin, Phone, Wallet } from "lucide-react";
import { formatCurrency, formatDateLocale } from "../utils/formulas";
import { PageHeader, HeaderMetric } from "./shared/PageHeader";
import { FilterBar, FilterField } from "./shared/FilterBar";
import { DataList, type DataListItem } from "./shared/DataList";
import { StatCol } from "./shared/StatBar";
import { Modal } from "./shared/Modal";
import {
  STATUTS_LIVRAISON,
  argentChezLeLivreur,
  classeStatutLivraison,
  estEnCours,
  libelleStatutLivraison,
  lireContenu,
  resumeContenu,
  type ArticleLivre,
  type Livraison,
} from "../lib/livraisons";
import { dateDuJour } from "../lib/dates";

/** Un membre de l'équipe, tel que l'écran a besoin de le connaître. */
interface Membre {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string;
}

interface ChargeLivraison {
  destinataire: string;
  telephone?: string | null;
  adresse: string;
  precisions?: string | null;
  date_prevue?: string | null;
  montant_a_encaisser: number;
  contenu: ArticleLivre[];
  livreur_id?: string | null;
  note?: string | null;
}

interface LivraisonsViewProps {
  deliveries: Livraison[];
  /** L'équipe de la boutique : on y cherche les livreurs. */
  membres: Membre[];
  onAddDelivery: (data: ChargeLivraison) => Promise<{ error: string | null }>;
  onUpdateDelivery: (
    id: string,
    data: Partial<ChargeLivraison> & { statut?: string },
  ) => Promise<{ error: string | null }>;
  onDeleteDelivery: (id: string) => Promise<{ error: string | null }>;
  /** Le livreur a rendu l'argent de ces courses. */
  onRemettreArgent: (
    ids: string[],
  ) => Promise<{ courses: number; total: number; error: string | null }>;
  peutCreer?: boolean;
  peutModifier?: boolean;
  peutSupprimer?: boolean;
}

const AUJOURDHUI = () => dateDuJour();
const ARTICLE_VIDE: ArticleLivre = { designation: "", quantite: 1 };

/**
 * Les livraisons, vues du comptoir.
 *
 * C'est ici que la boutique prépare une course et la confie à quelqu'un.
 * Le livreur, lui, a son propre écran : il ne voit ni cette liste, ni
 * rien d'autre de la boutique — c'est la base qui le tient, pas cet
 * écran.
 */
export const LivraisonsView: React.FC<LivraisonsViewProps> = ({
  deliveries,
  membres,
  onAddDelivery,
  onUpdateDelivery,
  onDeleteDelivery,
  onRemettreArgent,
  peutCreer = true,
  peutModifier = true,
  peutSupprimer = true,
}) => {
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("en_cours_seulement");

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Livraison | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const [destinataire, setDestinataire] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [precisions, setPrecisions] = useState("");
  const [datePrevue, setDatePrevue] = useState(AUJOURDHUI);
  const [montant, setMontant] = useState(0);
  const [livreurId, setLivreurId] = useState("");
  const [note, setNote] = useState("");
  const [articles, setArticles] = useState<ArticleLivre[]>([{ ...ARTICLE_VIDE }]);

  const livreurs = useMemo(() => membres.filter((m) => m.role === "livreur"), [membres]);
  const nomDuLivreur = (id: string | null) => {
    if (!id) return null;
    const m = membres.find((x) => x.user_id === id);
    return m ? (m.full_name ?? m.email) : "Livreur retiré de l'équipe";
  };

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return deliveries.filter((l) => {
      const correspond =
        !q ||
        (l.numero ?? "").toLowerCase().includes(q) ||
        l.destinataire.toLowerCase().includes(q) ||
        l.adresse.toLowerCase().includes(q);
      const statut =
        filtreStatut === "toutes" ||
        (filtreStatut === "en_cours_seulement" ? estEnCours(l) : l.statut === filtreStatut);
      return correspond && statut;
    });
  }, [deliveries, recherche, filtreStatut]);

  const aFaire = deliveries.filter(estEnCours);
  const aEncaisser = aFaire.reduce((n, l) => n + l.montant_a_encaisser, 0);

  /**
   * Ce que les livreurs ont encaissé et pas encore rendu, par livreur.
   *
   * C'est le vrai geste du comptoir : quelqu'un repasse, pose l'argent
   * de ses trois courses, et on coche une fois. Cocher course par
   * course marcherait aussi, mais ce n'est pas ainsi que ça se passe.
   */
  const aRendre = useMemo(() => {
    const parLivreur = new Map<string, { montant: number; ids: string[] }>();
    for (const l of deliveries.filter(argentChezLeLivreur)) {
      const cle = l.livreur_id ?? "";
      const entree = parLivreur.get(cle) ?? { montant: 0, ids: [] };
      entree.montant += l.montant_encaisse;
      entree.ids.push(l.id);
      parLivreur.set(cle, entree);
    }
    return [...parLivreur.entries()];
  }, [deliveries]);

  const rendre = async (ids: string[], qui: string) => {
    setEnregistrement(true);
    const res = await onRemettreArgent(ids);
    setEnregistrement(false);
    if (res.error) setErreur(res.error);
    else {
      setSucces(
        `${formatCurrency(res.total)} rentrés en caisse — ${res.courses} course${res.courses > 1 ? "s" : ""} de ${qui}.`,
      );
    }
  };

  const ouvrirCreation = () => {
    setEnEdition(null);
    setDestinataire("");
    setTelephone("");
    setAdresse("");
    setPrecisions("");
    setDatePrevue(AUJOURDHUI());
    setMontant(0);
    setLivreurId("");
    setNote("");
    setArticles([{ ...ARTICLE_VIDE }]);
    setErreur(null);
    setFormulaireOuvert(true);
  };

  const ouvrirEdition = (l: Livraison) => {
    setEnEdition(l);
    setDestinataire(l.destinataire);
    setTelephone(l.telephone ?? "");
    setAdresse(l.adresse);
    setPrecisions(l.precisions ?? "");
    setDatePrevue(l.date_prevue ?? AUJOURDHUI());
    setMontant(l.montant_a_encaisser);
    setLivreurId(l.livreur_id ?? "");
    setNote(l.note ?? "");
    const contenu = lireContenu(l.contenu);
    setArticles(contenu.length > 0 ? contenu : [{ ...ARTICLE_VIDE }]);
    setErreur(null);
    setFormulaireOuvert(true);
  };

  const changerArticle = (i: number, patch: Partial<ArticleLivre>) =>
    setArticles((liste) => liste.map((a, k) => (k === i ? { ...a, ...patch } : a)));

  const enregistrer = async () => {
    if (!destinataire.trim()) {
      setErreur("Indiquez à qui la course est destinée.");
      return;
    }
    if (!adresse.trim()) {
      setErreur("Sans adresse, le livreur ne saura pas où aller.");
      return;
    }
    if (montant < 0) {
      setErreur("Le montant à encaisser ne peut pas être négatif.");
      return;
    }

    const charge: ChargeLivraison = {
      destinataire: destinataire.trim(),
      telephone: telephone.trim() || null,
      adresse: adresse.trim(),
      precisions: precisions.trim() || null,
      date_prevue: datePrevue || null,
      montant_a_encaisser: Number(montant),
      contenu: articles.filter((a) => a.designation.trim() && a.quantite > 0),
      livreur_id: livreurId || null,
      note: note.trim() || null,
    };

    setEnregistrement(true);
    setErreur(null);
    const res = enEdition
      ? await onUpdateDelivery(enEdition.id, charge)
      : await onAddDelivery(charge);
    setEnregistrement(false);

    if (res.error) {
      setErreur(res.error);
      return;
    }
    setSucces(enEdition ? `Course ${enEdition.numero ?? ""} modifiée.` : "Course créée.");
    setFormulaireOuvert(false);
  };

  const assigner = async (l: Livraison, id: string) => {
    const res = await onUpdateDelivery(l.id, { livreur_id: id || null });
    if (res.error) setErreur(res.error);
    else {
      setSucces(
        id
          ? `${l.numero ?? "Course"} confiée à ${nomDuLivreur(id)}.`
          : `${l.numero ?? "Course"} n'est plus assignée.`,
      );
    }
  };

  const annuler = async (l: Livraison) => {
    if (!window.confirm(`Annuler la course ${l.numero ?? ""} ?`)) return;
    const res = await onUpdateDelivery(l.id, { statut: "annulee" });
    if (res.error) setErreur(res.error);
    else setSucces(`Course ${l.numero ?? ""} annulée.`);
  };

  const supprimer = async (l: Livraison) => {
    if (!window.confirm(`Supprimer la course ${l.numero ?? ""} ?`)) return;
    const res = await onDeleteDelivery(l.id);
    if (res.error) setErreur(res.error);
    else setSucces(`Course ${l.numero ?? ""} supprimée.`);
  };

  const item = (l: Livraison): DataListItem => {
    const contenu = lireContenu(l.contenu);
    const livreur = nomDuLivreur(l.livreur_id);
    return {
      id: l.id,
      primary: <span className="block truncate">{l.destinataire || "Sans destinataire"}</span>,
      meta: [
        l.numero,
        l.date_prevue ? formatDateLocale(l.date_prevue, "FR") : null,
        l.adresse,
        livreur ?? "à confier",
      ],
      amount: l.montant_a_encaisser > 0 ? formatCurrency(l.montant_a_encaisser) : undefined,
      amountHint:
        l.montant_a_encaisser > 0 ? (
          <span className="app-list-secondary">à encaisser</span>
        ) : undefined,
      badge: (
        <span className={`app-badge ${classeStatutLivraison(l.statut)}`}>
          {libelleStatutLivraison(l.statut)}
        </span>
      ),
      detailTitle: l.destinataire || "Sans destinataire",
      detailSubtitle: `Course ${l.numero ?? ""}`,
      detailBody: (
        <div className="mb-2 space-y-3">
          <div className="rounded-xl border border-border p-3">
            <p className="flex items-start gap-2 text-sm text-foreground">
              <MapPin
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0">
                {l.adresse || "Adresse non précisée"}
                {l.precisions && (
                  <span className="block text-xs text-muted-foreground">{l.precisions}</span>
                )}
              </span>
            </p>
            {l.telephone && (
              <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <a href={`tel:${l.telephone}`} className="hover:underline">
                  {l.telephone}
                </a>
              </p>
            )}
          </div>

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

          {peutModifier && estEnCours(l) && (
            <div>
              <label
                htmlFor={`liv-assign-${l.id}`}
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Confiée à
              </label>
              <select
                id={`liv-assign-${l.id}`}
                value={l.livreur_id ?? ""}
                onChange={(e) => assigner(l, e.target.value)}
                className="app-field"
              >
                <option value="">Personne pour l&apos;instant</option>
                {livreurs.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name ?? m.email}
                  </option>
                ))}
              </select>
              {livreurs.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Aucun livreur dans l&apos;équipe. Invitez-en un depuis Paramètres → Équipe.
                </p>
              )}
            </div>
          )}
        </div>
      ),
      details: [
        { label: "Statut", value: libelleStatutLivraison(l.statut) },
        {
          label: "Prévue le",
          value: l.date_prevue ? formatDateLocale(l.date_prevue, "FR") : "—",
        },
        { label: "Confiée à", value: livreur ?? "personne", hideIfEmpty: true },
        {
          label: "À encaisser",
          value: l.montant_a_encaisser > 0 ? formatCurrency(l.montant_a_encaisser) : "rien",
        },
        ...(l.statut === "livree"
          ? [
              { label: "Encaissé", value: formatCurrency(l.montant_encaisse) },
              {
                label: "Argent rendu",
                value: l.argent_remis_le
                  ? new Date(l.argent_remis_le).toLocaleString("fr-FR")
                  : l.montant_encaisse > 0
                    ? "pas encore"
                    : "rien à rendre",
              },
            ]
          : []),
        ...(l.prise_en_charge_le
          ? [
              {
                label: "Prise en charge",
                value: new Date(l.prise_en_charge_le).toLocaleString("fr-FR"),
              },
            ]
          : []),
        ...(l.remise_le
          ? [{ label: "Remise", value: new Date(l.remise_le).toLocaleString("fr-FR") }]
          : []),
        { label: "Motif de l'échec", value: l.motif_echec ?? "-", hideIfEmpty: true },
        { label: "Note", value: l.note ?? "-", hideIfEmpty: true },
      ],
      actions: (
        <>
          {peutModifier && estEnCours(l) && (
            <button onClick={() => ouvrirEdition(l)} className="app-btn-secondary">
              <Edit3 className="h-4 w-4" />
              Modifier
            </button>
          )}
          {peutModifier && estEnCours(l) && (
            <button onClick={() => annuler(l)} className="app-btn-secondary">
              Annuler la course
            </button>
          )}
          {peutSupprimer && l.statut === "a_faire" && (
            <button onClick={() => supprimer(l)} className="app-btn-danger">
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
          )}
        </>
      ),
    };
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Truck className="h-5 w-5 t-success" />}
        title="Livraisons"
        module="livraisons"
        subtitle="Ce qui doit partir, à qui c'est confié, et ce qu'il faut rapporter."
        metric={
          <HeaderMetric
            label="À rapporter"
            value={formatCurrency(aEncaisser)}
            hint={`${aFaire.length} course${aFaire.length > 1 ? "s" : ""} en cours`}
          />
        }
        actions={
          peutCreer ? (
            <button onClick={ouvrirCreation} className="app-btn-primary w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Nouvelle course
            </button>
          ) : undefined
        }
      />

      {succes && (
        <p
          role="status"
          className="rounded-xl border border-success-border bg-success-soft px-4 py-2.5 text-sm font-medium t-success"
        >
          {succes}
        </p>
      )}

      {erreur && !formulaireOuvert && (
        <p
          role="alert"
          className="rounded-xl border border-danger-border bg-danger-soft px-4 py-2.5 text-sm t-danger"
        >
          {erreur}
        </p>
      )}

      <FilterBar
        searchValue={recherche}
        onSearchChange={setRecherche}
        searchPlaceholder="Rechercher un destinataire, une adresse, un numéro"
        activeFilterCount={filtreStatut === "en_cours_seulement" ? 0 : 1}
        onReset={() => setFiltreStatut("en_cours_seulement")}
      >
        <FilterField label="Statut">
          <select
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value)}
            className="app-field"
          >
            <option value="en_cours_seulement">Restant à faire</option>
            <option value="toutes">Toutes</option>
            {STATUTS_LIVRAISON.map((s) => (
              <option key={s.valeur} value={s.valeur}>
                {s.libelle}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      {aRendre.length > 0 && (
        <section className="app-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="app-section-title">
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              Argent chez les livreurs
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Encaissé pendant les courses, pas encore rentré en caisse. Cochez quand le livreur
              vous l&apos;a remis.
            </p>
          </div>
          <div className="app-list">
            {aRendre.map(([id, { montant, ids }]) => {
              const qui = nomDuLivreur(id || null) ?? "Non assignée";
              return (
                <div key={id || "sans"} className="app-list-row justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="app-list-primary block">{qui}</span>
                    <span className="app-list-secondary block">
                      {ids.length} course{ids.length > 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="app-list-amount t-warning">{formatCurrency(montant)}</span>
                  {peutModifier && (
                    <button
                      type="button"
                      onClick={() => rendre(ids, qui)}
                      disabled={enregistrement}
                      className="app-btn-primary shrink-0 px-3 py-1.5 text-xs"
                    >
                      Argent rendu
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="app-card overflow-hidden">
        <DataList
          emptyLabel="Aucune course ne correspond à ces filtres."
          items={filtrees.map(item)}
        />
      </div>

      <Modal
        open={formulaireOuvert}
        onClose={() => setFormulaireOuvert(false)}
        size="2xl"
        icon={<Truck className="h-4 w-4" />}
        title={enEdition ? `Modifier ${enEdition.numero ?? "la course"}` : "Nouvelle course"}
        description="Ce que le livreur verra : où aller, qui appeler, quoi remettre, combien rapporter."
        footer={
          <>
            <button
              type="button"
              onClick={() => setFormulaireOuvert(false)}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={enregistrer}
              disabled={enregistrement}
              className="app-btn-primary"
            >
              {enregistrement ? "Enregistrement…" : "Enregistrer la course"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="liv-destinataire"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Destinataire
              </label>
              <input
                id="liv-destinataire"
                type="text"
                value={destinataire}
                onChange={(e) => setDestinataire(e.target.value)}
                placeholder="À qui on remet le colis"
                className="app-field"
              />
            </div>
            <div>
              <label htmlFor="liv-tel" className="mb-1.5 block text-sm font-medium text-foreground">
                Téléphone
              </label>
              <input
                id="liv-tel"
                type="tel"
                inputMode="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+261 34 00 000 00"
                className="app-field"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="liv-adresse"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Adresse
            </label>
            <input
              id="liv-adresse"
              type="text"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="Lot II M 12 bis, Analamahitsy"
              className="app-field"
            />
            <input
              type="text"
              value={precisions}
              onChange={(e) => setPrecisions(e.target.value)}
              placeholder="Repère : portail bleu, après la pharmacie"
              className="app-field mt-2"
              aria-label="Précisions sur le lieu"
            />
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="app-section-title">Ce qu&apos;il transporte</p>
            <p className="text-xs text-muted-foreground">
              Sans les prix : le livreur doit savoir ce qu&apos;il remet, pas ce que la marchandise
              a coûté à la boutique.
            </p>
            {articles.map((a, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={a.designation}
                    onChange={(e) => changerArticle(i, { designation: e.target.value })}
                    placeholder="Désignation"
                    className="app-field"
                    aria-label={`Article ${i + 1}`}
                  />
                </div>
                <div className="w-20">
                  <input
                    type="number"
                    min={1}
                    value={a.quantite}
                    onChange={(e) => changerArticle(i, { quantite: Number(e.target.value) })}
                    className="app-field font-mono"
                    aria-label={`Quantité de l'article ${i + 1}`}
                  />
                </div>
                {articles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setArticles((l) => l.filter((_, k) => k !== i))}
                    className="app-btn-icon h-9 w-9 shrink-0"
                    aria-label={`Retirer l'article ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setArticles((l) => [...l, { ...ARTICLE_VIDE }])}
              className="app-btn-secondary w-full"
            >
              <Plus className="h-4 w-4" />
              Ajouter un article
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="liv-date"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Prévue le
              </label>
              <input
                id="liv-date"
                type="date"
                value={datePrevue}
                onChange={(e) => setDatePrevue(e.target.value)}
                className="app-field"
              />
            </div>
            <div>
              <label
                htmlFor="liv-montant"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                À encaisser
              </label>
              <input
                id="liv-montant"
                type="number"
                min={0}
                inputMode="decimal"
                value={montant}
                onChange={(e) => setMontant(Number(e.target.value))}
                className="app-field font-mono"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Zéro si le client a déjà payé.
              </p>
            </div>
            <div>
              <label
                htmlFor="liv-livreur"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Confiée à
              </label>
              <select
                id="liv-livreur"
                value={livreurId}
                onChange={(e) => setLivreurId(e.target.value)}
                className="app-field"
              >
                <option value="">Personne pour l&apos;instant</option>
                {livreurs.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name ?? m.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="liv-note" className="mb-1.5 block text-sm font-medium text-foreground">
              Note (optionnel)
            </label>
            <textarea
              id="liv-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Livrer avant midi, appeler en arrivant…"
              className="app-field"
            />
          </div>

          {erreur && (
            <p
              role="alert"
              className="rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm t-danger"
            >
              {erreur}
            </p>
          )}

          <div className="app-statbar grid-cols-2">
            <StatCol label="À encaisser" value={formatCurrency(montant)} />
            <StatCol
              label="Contenu"
              value={resumeContenu(articles.filter((a) => a.designation.trim()))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
