import React, { useMemo, useState } from "react";
import { CalendarClock, FileWarning, Hourglass, PackageX, Pill, Plus, Search } from "lucide-react";
import type { Product } from "../../types";
import type { Database } from "../../lib/database.types";
import { formatCurrency } from "../../utils/formulas";
import { correspond, etatStock, exigeOrdonnance, urgence } from "../../lib/pharmacie";
import type { Pharmacie } from "../../hooks/usePharmacie";
import { BadgeFroid, BadgePeremption, BadgeRegime } from "./badges";
import { FicheMedicament } from "./FicheMedicament";
import { FormulaireMedicament, type ValeursMedicament } from "./FormulaireMedicament";
import { Chiffre, EnTete, Panneau, Pastille, Recherche, Vide } from "./ui";

type Categorie = Database["public"]["Tables"]["categories"]["Row"];
type Resultat = { error: string | null };

interface Props {
  products: Product[];
  categories: Categorie[];
  pharma: Pharmacie;
  aujourdhui: string;
  peutModifier: boolean;
  onCreer: (v: ValeursMedicament) => Promise<Resultat & { id?: string | null }>;
  onModifier: (p: Product, v: ValeursMedicament) => Promise<Resultat>;
  onStockModifie: () => void;
}

type Filtre = "tous" | "rupture" | "a_perimer" | "sans_date" | "ordonnance";

/**
 * LES MÉDICAMENTS
 *
 * Le registre de l'officine : on y cherche par nom commercial, par
 * molécule ou au code-barres ; chaque ligne dit l'emplacement, la
 * prochaine péremption, le stock et le prix. Les chiffres de l'en-tête
 * servent aussi de filtres. La fiche ouvre les lots, la fiche technique
 * et les génériques équivalents.
 */
export const MedicamentsView: React.FC<Props> = ({
  products,
  categories,
  pharma,
  aujourdhui,
  peutModifier,
  onCreer,
  onModifier,
  onStockModifie,
}) => {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [rubrique, setRubrique] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [edition, setEdition] = useState<Product | "nouveau" | null>(null);

  const medicaments = useMemo(
    () =>
      products
        .filter((p) => p.statut !== "archive")
        .sort((a, b) => a.displayName.localeCompare(b.displayName, "fr")),
    [products],
  );
  const etats = useMemo(
    () => new Map(medicaments.map((p) => [p.id, etatStock(p, pharma.lots, aujourdhui)])),
    [medicaments, pharma.lots, aujourdhui],
  );

  const aPerimer = (p: Product) => {
    const e = etats.get(p.id)!;
    if (e.perime > 0) return true;
    const u = urgence(e.prochaine, aujourdhui);
    return u === "un_mois" || u === "trois_mois";
  };
  const compte = {
    rupture: medicaments.filter((p) => p.stockActuel <= 0).length,
    a_perimer: medicaments.filter(aPerimer).length,
    sans_date: medicaments.filter((p) => etats.get(p.id)!.sansDate > 0).length,
    ordonnance: medicaments.filter((p) => exigeOrdonnance(pharma.ficheDe.get(p.id)?.regime)).length,
  };
  const valeurStock = medicaments.reduce((n, p) => n + Math.max(0, p.stockActuel) * p.prixAchat, 0);

  const visibles = medicaments.filter((p) => {
    const fiche = pharma.ficheDe.get(p.id);
    if (rubrique && p.categoryId !== rubrique) return false;
    if (filtre === "rupture" && p.stockActuel > 0) return false;
    if (filtre === "a_perimer" && !aPerimer(p)) return false;
    if (filtre === "sans_date" && etats.get(p.id)!.sansDate <= 0) return false;
    if (filtre === "ordonnance" && !exigeOrdonnance(fiche?.regime)) return false;
    return correspond(p, fiche, recherche);
  });

  const rubriques = categories
    .filter(
      (c) =>
        (c.usage ?? "produit") === "produit" &&
        c.actif !== false &&
        medicaments.some((p) => p.categoryId === c.id),
    )
    .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"));

  const basculer = (f: Filtre) => setFiltre((x) => (x === f ? "tous" : f));
  const produitOuvert = medicaments.find((p) => p.id === ouvert) ?? null;

  return (
    <div className="ph-page">
      <EnTete
        titre="Médicaments"
        sousTitre={`${medicaments.length} références · ${formatCurrency(valeurStock)} de stock au prix d'achat`}
        icone={<Pill className="h-6 w-6" />}
        actions={
          peutModifier && (
            <button type="button" onClick={() => setEdition("nouveau")} className="app-btn-primary">
              <Plus className="h-4 w-4" />
              Médicament
            </button>
          )
        }
      >
        <Chiffre
          valeur={compte.a_perimer}
          libelle="À périmer"
          icone={<Hourglass className="h-3 w-3" />}
          ton={compte.a_perimer ? "warning" : undefined}
          onClick={() => basculer("a_perimer")}
          actif={filtre === "a_perimer"}
        />
        <Chiffre
          valeur={compte.rupture}
          libelle="En rupture"
          icone={<PackageX className="h-3 w-3" />}
          ton={compte.rupture ? "danger" : undefined}
          onClick={() => basculer("rupture")}
          actif={filtre === "rupture"}
        />
        <Chiffre
          valeur={compte.sans_date}
          libelle="Stock sans date"
          icone={<CalendarClock className="h-3 w-3" />}
          onClick={() => basculer("sans_date")}
          actif={filtre === "sans_date"}
        />
        <Chiffre
          valeur={compte.ordonnance}
          libelle="Sur ordonnance"
          icone={<FileWarning className="h-3 w-3" />}
          onClick={() => basculer("ordonnance")}
          actif={filtre === "ordonnance"}
        />
      </EnTete>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <Recherche
            valeur={recherche}
            onChange={setRecherche}
            placeholder="Nom, molécule, laboratoire ou code-barres"
            icone={<Search className="h-5 w-5" />}
          />
        </div>
        {rubriques.length > 0 && (
          <select
            value={rubrique}
            onChange={(e) => setRubrique(e.target.value)}
            className="app-field h-[3.25rem] rounded-2xl sm:w-60"
            aria-label="Rubrique"
          >
            <option value="">Toutes les rubriques</option>
            {rubriques.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        )}
      </div>

      <Panneau
        titre={
          filtre === "tous" && !recherche.trim() && !rubrique
            ? "Le registre"
            : `${visibles.length} médicament(s)`
        }
        action={
          filtre !== "tous" ? (
            <button type="button" onClick={() => setFiltre("tous")}>
              Tout afficher
            </button>
          ) : undefined
        }
      >
        {visibles.length === 0 ? (
          <Vide icone={<Pill className="h-6 w-6" />}>
            {medicaments.length === 0
              ? "Aucun médicament au catalogue. Ajoutez le premier."
              : "Aucun médicament ne correspond."}
          </Vide>
        ) : (
          <>
            {/* Sur ordinateur : un tableau, comme un registre. */}
            <table className="ph-tableau hidden md:table">
              <thead>
                <tr>
                  <th>Médicament</th>
                  <th>Molécule</th>
                  <th>Rayon</th>
                  <th>Péremption</th>
                  <th className="ph-num">Stock</th>
                  <th className="ph-num">Prix</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => {
                  const fiche = pharma.ficheDe.get(p.id);
                  const e = etats.get(p.id)!;
                  return (
                    <tr key={p.id} data-cliquable onClick={() => setOuvert(p.id)}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Pastille nom={p.displayName} className="!h-8 !w-8 !rounded-lg" />
                          <div className="min-w-0">
                            <p className="truncate font-bold">{p.displayName}</p>
                            <p className="flex gap-1.5">
                              <BadgeRegime regime={fiche?.regime} />
                              <BadgeFroid conservation={fiche?.conservation} />
                              {!fiche?.regime && (
                                <span className="text-xs text-muted-foreground">
                                  {fiche?.forme}
                                </span>
                              )}
                              {fiche?.regime === "libre" && (
                                <span className="text-xs text-muted-foreground">
                                  {fiche?.forme}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-muted-foreground">{fiche?.dci ?? "—"}</td>
                      <td className="font-mono text-xs">{fiche?.emplacement ?? "—"}</td>
                      <td>
                        {e.perime > 0 ? (
                          <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-bold t-danger">
                            {e.perime} périmé(s)
                          </span>
                        ) : e.prochaine ? (
                          <BadgePeremption date={e.prochaine} aujourdhui={aujourdhui} />
                        ) : e.sansDate > 0 ? (
                          <span className="text-xs text-muted-foreground">sans date</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td
                        className={`ph-num font-bold ${
                          p.stockActuel <= 0
                            ? "t-danger"
                            : p.stockActuel <= p.seuilAlerte
                              ? "t-warning"
                              : ""
                        }`}
                      >
                        {p.stockActuel}
                      </td>
                      <td className="ph-num font-bold">{formatCurrency(p.prixVenteDefaut)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Sur téléphone : des lignes. */}
            <ul className="ph-liste md:hidden">
              {visibles.map((p) => {
                const fiche = pharma.ficheDe.get(p.id);
                const e = etats.get(p.id)!;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setOuvert(p.id)}
                      className="ph-ligne"
                      data-ton={
                        p.stockActuel <= 0 || e.perime > 0
                          ? "danger"
                          : aPerimer(p)
                            ? "warning"
                            : undefined
                      }
                    >
                      <Pastille nom={p.displayName} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{p.displayName}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[fiche?.dci, fiche?.emplacement && `Rayon ${fiche.emplacement}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {(e.prochaine || (fiche?.regime && fiche.regime !== "libre")) && (
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            {e.prochaine && (
                              <BadgePeremption date={e.prochaine} aujourdhui={aujourdhui} />
                            )}
                            <BadgeRegime regime={fiche?.regime} />
                          </span>
                        )}
                      </span>
                      <span className="text-right">
                        <span
                          className={`block text-sm font-extrabold tabular-nums ${
                            p.stockActuel <= 0 ? "t-danger" : ""
                          }`}
                        >
                          {p.stockActuel}
                        </span>
                        <span className="block text-xs font-semibold tabular-nums text-muted-foreground">
                          {formatCurrency(p.prixVenteDefaut)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panneau>

      {produitOuvert && !edition && (
        <FicheMedicament
          produit={produitOuvert}
          produits={medicaments}
          pharma={pharma}
          aujourdhui={aujourdhui}
          peutModifier={peutModifier}
          onModifier={() => setEdition(produitOuvert)}
          onOuvrir={(p) => setOuvert(p.id)}
          onStockModifie={onStockModifie}
          onFermer={() => setOuvert(null)}
        />
      )}
      {edition && (
        <FormulaireMedicament
          produit={edition === "nouveau" ? undefined : edition}
          fiche={edition === "nouveau" ? undefined : pharma.ficheDe.get(edition.id)}
          categories={categories}
          onFermer={() => setEdition(null)}
          onEnregistrer={async (v) => {
            const r = edition === "nouveau" ? await onCreer(v) : await onModifier(edition, v);
            if (r.error) return r.error;
            const id = edition === "nouveau" ? (r as { id?: string | null }).id : edition.id;
            if (id) {
              const f = await pharma.enregistrerFiche(id, {
                dci: v.dci,
                dosage: v.dosage,
                forme: v.forme,
                laboratoire: v.laboratoire,
                emplacement: v.emplacement,
                regime: v.regime,
                conservation: v.frais ? "frais" : "ambiante",
                notes: v.notes,
              });
              if (f.error) return f.error;
              if (edition === "nouveau") setOuvert(id);
            }
            setEdition(null);
            return null;
          }}
        />
      )}
    </div>
  );
};
