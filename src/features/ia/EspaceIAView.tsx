import React, { useState } from "react";
import {
  AlertTriangle,
  Bot,
  Loader2,
  PackageSearch,
  PenLine,
  SearchCheck,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "../../components/shared/PageHeader";
import {
  deciderActionIA,
  disponibilite,
  executerIA,
  FONCTIONNALITES_PROPRIETAIRE,
  LIBELLES_FONCTIONNALITES,
  type EntreeIA,
  type FonctionnaliteIA,
  type ResultatIA,
} from "./clientIA";
import { useEtatIA } from "./useEtatIA";

interface EspaceIAViewProps {
  storeId: string | null;
  isOwner: boolean;
}

type Onglet = "assistant" | "redaction" | "reapprovisionnement" | "anomalies";

const ONGLETS: { id: Onglet; icone: React.ReactNode }[] = [
  { id: "assistant", icone: <Bot className="w-4 h-4" /> },
  { id: "redaction", icone: <PenLine className="w-4 h-4" /> },
  { id: "reapprovisionnement", icone: <PackageSearch className="w-4 h-4" /> },
  { id: "anomalies", icone: <SearchCheck className="w-4 h-4" /> },
];

/**
 * L'espace IA : quatre usages, chacun avec son état réel.
 *
 * Tant que l'IA n'est pas activée, chaque usage affiche pourquoi, et
 * aucun bouton n'envoie quoi que ce soit. Les réponses sont affichées en
 * texte brut (jamais interprétées comme du HTML) et présentées comme des
 * propositions à relire.
 */
export const EspaceIAView: React.FC<EspaceIAViewProps> = ({ storeId, isOwner }) => {
  const { etat, chargement, rafraichir } = useEtatIA(storeId);
  const [onglet, setOnglet] = useState<Onglet>(isOwner ? "assistant" : "redaction");
  const [question, setQuestion] = useState("");
  const [typeRedaction, setTypeRedaction] = useState<
    "description_produit" | "message_client" | "libre"
  >("description_produit");
  const [consignes, setConsignes] = useState("");
  const [contexte, setContexte] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<ResultatIA | null>(null);
  const [decision, setDecision] = useState<string | null>(null);

  const reserve = FONCTIONNALITES_PROPRIETAIRE.includes(onglet as FonctionnaliteIA) && !isOwner;
  const dispo = disponibilite(etat, onglet);
  const boutique = etat?.boutique;

  const lancer = async (entree: EntreeIA) => {
    if (!storeId) return;
    setEnCours(true);
    setResultat(null);
    setDecision(null);
    try {
      setResultat(await executerIA(storeId, entree));
    } finally {
      setEnCours(false);
      void rafraichir();
    }
  };

  const changerOnglet = (o: Onglet) => {
    setOnglet(o);
    setResultat(null);
    setDecision(null);
  };

  const decider = async (actionId: string, d: "confirmee" | "rejetee") => {
    const err = await deciderActionIA(actionId, d);
    setDecision(
      err
        ? `Décision non enregistrée : ${err}`
        : d === "confirmee"
          ? "Suggestion retenue et journalisée. Passez la commande depuis Achats ou le bon de commande."
          : "Suggestion écartée et journalisée.",
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Sparkles className="w-5 h-5 t-success" />}
        title="Assistant IA"
        subtitle="Des propositions à relire : l'IA n'enregistre jamais rien seule."
      />

      {/* Utilisation du mois */}
      {boutique && (boutique.boutique_active || boutique.requetes_mois > 0) && (
        <div className="app-card flex flex-wrap items-center gap-x-6 gap-y-1 p-4 text-sm">
          <span>
            Demandes ce mois : <strong>{boutique.requetes_mois}</strong>
            {boutique.requetes_mensuelles_max !== null && ` / ${boutique.requetes_mensuelles_max}`}
          </span>
          {boutique.part_utilisee_pct !== null && (
            <span>
              Enveloppe utilisée : <strong>{boutique.part_utilisee_pct} %</strong>
            </span>
          )}
          {boutique.cout_mois_usd !== null && boutique.plafond_mensuel_usd !== null && (
            <span className="text-muted-foreground">
              Coût estimé : {boutique.cout_mois_usd.toFixed(2)} $ /{" "}
              {Number(boutique.plafond_mensuel_usd).toFixed(2)} $
            </span>
          )}
        </div>
      )}

      <div className="app-scroll-x -mx-4 px-4">
        <div className="flex w-max gap-2">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => changerOnglet(o.id)}
              aria-pressed={onglet === o.id}
              className={`flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 text-sm font-semibold ${
                onglet === o.id
                  ? "border-success-border bg-success-soft t-success"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {o.icone}
              {LIBELLES_FONCTIONNALITES[o.id]}
            </button>
          ))}
        </div>
      </div>

      <div className="app-card space-y-4 p-5">
        {chargement && !etat ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Vérification de l'IA…
          </p>
        ) : reserve ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Fonction réservée au propriétaire : elle lit les chiffres de toute la boutique.
          </p>
        ) : !dispo.disponible ? (
          <p role="status" className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 t-warning" />
            {dispo.raison}
          </p>
        ) : (
          <>
            {onglet === "assistant" && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (question.trim())
                    void lancer({ fonctionnalite: "assistant", question: question.trim() });
                }}
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Votre question (période : 30 derniers jours)
                  </span>
                  <textarea
                    className="app-field min-h-24"
                    maxLength={2000}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ex. : quels produits rapportent le plus de marge ce mois-ci ?"
                  />
                </label>
                <button
                  type="submit"
                  className="app-btn-primary"
                  disabled={enCours || !question.trim()}
                >
                  {enCours ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                  Demander
                </button>
              </form>
            )}

            {onglet === "redaction" && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (consignes.trim())
                    void lancer({
                      fonctionnalite: "redaction",
                      type: typeRedaction,
                      consignes: consignes.trim(),
                      contexte: contexte.trim() || undefined,
                    });
                }}
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Type de texte
                  </span>
                  <select
                    className="app-field"
                    value={typeRedaction}
                    onChange={(e) => setTypeRedaction(e.target.value as typeof typeRedaction)}
                  >
                    <option value="description_produit">Description de produit</option>
                    <option value="message_client">Message à un client</option>
                    <option value="libre">Autre texte</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Consignes
                  </span>
                  <textarea
                    className="app-field min-h-20"
                    maxLength={2000}
                    value={consignes}
                    onChange={(e) => setConsignes(e.target.value)}
                    placeholder="Ex. : sac kraft 25 kg, résistant à l'humidité, pour la farine"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Contexte (facultatif)
                  </span>
                  <textarea
                    className="app-field min-h-16"
                    maxLength={8000}
                    value={contexte}
                    onChange={(e) => setContexte(e.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  className="app-btn-primary"
                  disabled={enCours || !consignes.trim()}
                >
                  {enCours ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PenLine className="h-4 w-4" />
                  )}
                  Rédiger
                </button>
              </form>
            )}

            {(onglet === "reapprovisionnement" || onglet === "anomalies") && (
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  {onglet === "reapprovisionnement"
                    ? "Analyse des produits sous leur seuil d'alerte et de leurs ventes des 30 derniers jours."
                    : "Relecture des chiffres des 30 derniers jours pour repérer ce qui mérite une vérification."}
                </p>
                <button
                  type="button"
                  className="app-btn-primary"
                  disabled={enCours}
                  onClick={() => void lancer({ fonctionnalite: onglet })}
                >
                  {enCours ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Lancer l'analyse
                </button>
              </div>
            )}
          </>
        )}

        {resultat && !resultat.ok && (
          <p
            role="alert"
            className="rounded-xl border border-danger-border bg-danger-soft px-3 py-2 text-sm t-danger"
          >
            {resultat.message}
          </p>
        )}

        {resultat?.ok && "texte" in resultat && resultat.texte && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Réponse générée par l'IA — à vérifier
            </p>
            <div className="whitespace-pre-wrap rounded-xl border border-border bg-muted p-3 text-sm">
              {resultat.texte}
            </div>
            {onglet === "redaction" && (
              <button
                type="button"
                className="app-btn-secondary"
                onClick={() => void navigator.clipboard?.writeText(resultat.texte)}
              >
                Copier le texte
              </button>
            )}
          </div>
        )}

        {resultat?.ok &&
          resultat.fonctionnalite === "reapprovisionnement" &&
          resultat.suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="overflow-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left">Produit</th>
                      <th className="px-3 py-2 text-right">Quantité proposée</th>
                      <th className="px-3 py-2 text-left">Raison</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultat.suggestions.map((s) => (
                      <tr key={s.product_id} className="border-t border-border">
                        <td className="px-3 py-2">{s.designation}</td>
                        <td className="px-3 py-2 text-right">{s.quantite}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.raison}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {resultat.action_id && !decision && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="app-btn-primary"
                    onClick={() => void decider(resultat.action_id!, "confirmee")}
                  >
                    Retenir ces suggestions
                  </button>
                  <button
                    type="button"
                    className="app-btn-secondary"
                    onClick={() => void decider(resultat.action_id!, "rejetee")}
                  >
                    Écarter
                  </button>
                </div>
              )}
              {decision && <p className="text-sm text-muted-foreground">{decision}</p>}
            </div>
          )}
      </div>
    </div>
  );
};
