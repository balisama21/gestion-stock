import React, { useMemo } from "react";
import { CalendarRange, CheckCircle2 } from "lucide-react";
import type { Purchase } from "../types";
import { formatCurrency, formatDateLocale } from "../utils/formulas";
import { PageHeader, HeaderMetric } from "./shared/PageHeader";
import { moduleMasque, usePersonnalisation } from "../lib/personnalisation";
import {
  CLASSE_URGENCE,
  LIBELLE_NATURE,
  LIBELLE_URGENCE,
  ORDRE_URGENCE,
  joursAvant,
  urgenceDe,
  type EcheanceAgenda,
} from "../lib/agenda";

interface AgendaViewProps {
  purchases: Purchase[];
  quotes: {
    id: string;
    numero: string | null;
    client_nom: string;
    statut: string;
    total: number;
    valide_jusqu_au: string | null;
  }[];
  deliveries: {
    id: string;
    numero: string | null;
    destinataire: string;
    statut: string;
    date_prevue: string | null;
    montant_a_encaisser: number;
  }[];
  onNavigateTab: (tab: string) => void;
}

/**
 * L'agenda.
 *
 * Il ne contient aucune donnée à lui : tout ce qu'il montre est déjà
 * quelque part, avec une date. Son seul apport est de les mettre côte à
 * côte et de les trier par urgence — ce qu'aucun des trois écrans
 * d'origine ne peut faire, puisque chacun ne connaît que les siennes.
 *
 * Il n'y a pas de tâches libres, et c'est volontaire : les inventer
 * demanderait une table et des règles — qui peut en créer, qui les voit,
 * ce qu'il advient d'une tâche dont l'auteur quitte la boutique — que
 * personne n'a encore arbitrées.
 */
export const AgendaView: React.FC<AgendaViewProps> = ({
  purchases,
  quotes,
  deliveries,
  onNavigateTab,
}) => {
  const perso = usePersonnalisation();

  const echeances = useMemo(() => {
    const liste: EcheanceAgenda[] = [];
    const maintenant = new Date();

    for (const a of purchases) {
      if (!a.dateEcheance || a.soldeDu <= 0) continue;
      liste.push({
        id: `achat-${a.id}`,
        titre: a.fournisseur || a.designation,
        nature: "achat",
        date: a.dateEcheance,
        montant: a.soldeDu,
        detail: `${a.numero} · ${a.designation}`,
        urgence: urgenceDe(a.dateEcheance, maintenant),
        onglet: "fournisseurs",
      });
    }

    if (!moduleMasque(perso, "devis")) {
      for (const d of quotes) {
        if (!d.valide_jusqu_au) continue;
        if (d.statut !== "brouillon" && d.statut !== "envoye") continue;
        liste.push({
          id: `devis-${d.id}`,
          titre: d.client_nom || "Sans nom",
          nature: "devis",
          date: d.valide_jusqu_au,
          montant: d.total,
          detail: `${d.numero ?? ""} · valable jusqu'à cette date`,
          urgence: urgenceDe(d.valide_jusqu_au, maintenant),
          onglet: "devis",
        });
      }
    }

    if (!moduleMasque(perso, "livraisons")) {
      for (const l of deliveries) {
        if (!l.date_prevue) continue;
        if (l.statut !== "a_faire" && l.statut !== "en_cours") continue;
        liste.push({
          id: `livraison-${l.id}`,
          titre: l.destinataire || "Sans destinataire",
          nature: "livraison",
          date: l.date_prevue,
          montant: l.montant_a_encaisser > 0 ? l.montant_a_encaisser : null,
          detail: `${l.numero ?? ""} · ${l.statut === "en_cours" ? "en cours" : "à confier"}`,
          urgence: urgenceDe(l.date_prevue, maintenant),
          onglet: "livraisons",
        });
      }
    }

    return liste.sort((a, b) => a.date.localeCompare(b.date));
  }, [purchases, quotes, deliveries, perso]);

  const enRetard = echeances.filter((e) => e.urgence === "retard");
  const aRegler = enRetard.reduce((n, e) => n + (e.montant ?? 0), 0);

  const groupes = ORDRE_URGENCE.map((u) => ({
    urgence: u,
    lignes: echeances.filter((e) => e.urgence === u),
  })).filter((g) => g.lignes.length > 0);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<CalendarRange className="h-5 w-5 t-success" />}
        title="Agenda"
        module="agenda"
        subtitle="Ce qui arrive à échéance : règlements, devis, courses."
        metric={
          <HeaderMetric
            label="En retard"
            value={enRetard.length === 0 ? "Rien" : formatCurrency(aRegler)}
            hint={
              enRetard.length === 0
                ? "vous êtes à jour"
                : `${enRetard.length} échéance${enRetard.length > 1 ? "s" : ""} passée${enRetard.length > 1 ? "s" : ""}`
            }
            tone={enRetard.length === 0 ? "success" : "danger"}
          />
        }
      />

      {groupes.length === 0 ? (
        <div className="app-card flex flex-col items-center gap-2 px-4 py-12 text-center">
          <CheckCircle2 className="h-7 w-7 t-success" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Rien n&apos;attend de vous.</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Cet agenda réunit les échéances déjà enregistrées ailleurs : la date d&apos;un achat à
            crédit, la validité d&apos;un devis, le jour prévu d&apos;une course.
          </p>
        </div>
      ) : (
        groupes.map((g) => (
          <section key={g.urgence} className="app-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="app-section-title">{LIBELLE_URGENCE[g.urgence]}</h2>
              <span className={`app-badge ${CLASSE_URGENCE[g.urgence]}`}>{g.lignes.length}</span>
            </div>
            <div className="app-list">
              {g.lignes.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onNavigateTab(e.onglet)}
                  className="app-list-row w-full justify-between gap-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="app-list-primary block">{e.titre}</span>
                    <span className="app-list-secondary block">
                      {LIBELLE_NATURE[e.nature]} · {formatDateLocale(e.date, "FR")}
                      {e.urgence === "retard" ? ` · ${-joursAvant(e.date)} j de retard` : ""}
                      {e.detail ? ` · ${e.detail}` : ""}
                    </span>
                  </span>
                  {e.montant !== null && (
                    <span className="app-list-amount">{formatCurrency(e.montant)}</span>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
};
