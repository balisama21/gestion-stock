import React, { useEffect, useState } from "react";
import { ChevronRight, Inbox, MoreVertical } from "lucide-react";
import { Modal } from "./Modal";
import { AvisIntrouvable } from "./AvisIntrouvable";
import { useEcranTableau } from "../../hooks/useEcranTableau";

export interface DetailField {
  label: string;
  value: React.ReactNode;
  /** Ligne masquée si la valeur est vide, nulle, « - » ou « 0 ». */
  hideIfEmpty?: boolean;
}

export interface DataListItem {
  id: string;
  /**
   * Élément posé avant le contenu, HORS de la zone cliquable : case de
   * sélection multiple, vignette produit, pastille d'avatar. Un contrôle
   * interactif imbriqué dans le bouton de ligne ne serait ni valide en
   * HTML ni utilisable au clavier.
   */
  leading?: React.ReactNode;
  /** Information principale : nom du produit, du client, du mouvement. */
  primary: React.ReactNode;
  /**
   * Informations secondaires regroupées sur UNE seule ligne grise sous
   * la principale (date, vendeur, prix unitaire…). Les valeurs vides
   * sont retirées et le séparateur « · » est posé automatiquement.
   */
  meta?: (string | null | undefined | false)[];
  /** Montant, aligné à droite. */
  amount?: string;
  /** Complément sous le montant (marge, reste dû…). */
  amountHint?: React.ReactNode;
  /** Badge de statut, à l'extrême droite. */
  badge?: React.ReactNode;
  /** Contenu du panneau de détails, ouvert au clic sur la ligne. */
  details?: DetailField[];
  /**
   * Bloc libre placé en haut du panneau de détails, avant les couples
   * libellé / valeur. Pour ce qui ne se dit pas en une valeur alignée à
   * droite : les lignes d'un ticket, chacune avec son montant et ses
   * propres actions.
   */
  detailBody?: React.ReactNode;
  /** Boutons affichés en pied du panneau de détails. */
  actions?: React.ReactNode;
  /** Titre du panneau de détails (par défaut : la valeur principale). */
  detailTitle?: string;
  detailSubtitle?: string;
  /**
   * EN TABLEAU (PC) — la petite ligne sous le nom, dans la première
   * colonne : une référence, une quantité. Le reste vit dans les
   * colonnes, pas dans une ligne grise interminable.
   */
  sousTitre?: React.ReactNode;
  /** EN TABLEAU (PC) — le contenu de chaque colonne, par sa clé. */
  cellules?: Record<string, React.ReactNode>;
  /**
   * Le groupe de la ligne : le jour d'une opération (« Aujourd'hui »,
   * « Hier », « lundi 9 novembre »). Chaque nouveau groupe ouvre un bloc
   * sous son titre — un bloc blanc en allure « operation », sans cadre
   * en allure « produit ». Les lignes doivent
   * arriver déjà triées : la liste ne regroupe que des voisines.
   */
  groupe?: string;
  /**
   * Une jauge sous la ligne : la part d'un apport dans le capital, ce qui
   * est déjà réglé d'une facture. `part` va de 0 à 1 ; à 1, la ligne est
   * dite complète (la facture est réglée) et le dit en couleur.
   */
  jauge?: { part: number; libelle?: string };
}

/**
 * L'ALLURE D'UNE LISTE, selon ce qu'elle montre.
 *
 * Une liste de produits, un journal de ventes et une liste de rappels
 * ne se lisent pas de la même façon. Chacune a donc sa forme, sur
 * téléphone (sur PC, toutes deviennent des tableaux) :
 *
 *   produit   — un catalogue. Pas de cadre, une vague entre deux
 *               lignes, grande photo, prix en grand et en vert.
 *   operation — un journal d'argent. Les lignes sont rangées par jour,
 *               chaque jour dans un bloc blanc sous son titre, comme un
 *               relevé de banque. Le montant se colore selon le sens.
 *   compact   — une liste de travail (tâches, rappels, classements) :
 *               un bloc, des filets, rien qui prenne de la place.
 *   chronologie — des dépenses : une frise verticale, chaque dépense un
 *               point sur la ligne du temps, son icône dans le point.
 *   jalon     — des apports : le montant d'abord, et une jauge qui dit
 *               la part de chacun dans tout ce qui a été apporté.
 *   document  — des pièces (factures, reçus, avoirs) : une petite feuille
 *               au coin plié qui porte le type, un numéro en chiffres
 *               réguliers, des pointillés de détachement entre deux.
 *   registre  — des factures à régler : un liseré de couleur à gauche et
 *               une jauge de ce qui est déjà réglé.
 *
 * Les personnes (clients, fournisseurs, prestataires) ont la leur, mais
 * leurs écrans ne passent pas par cette liste : voir `.app-personnes`.
 */
export type AllureListe =
  "produit" | "operation" | "compact" | "chronologie" | "jalon" | "document" | "registre";

/**
 * Le sens de l'argent dans une liste d'opérations : une vente entre, une
 * dépense sort. Seule l'entrée se colore — la sortie garde l'encre du
 * texte, son signe « − » suffit, et une colonne entière de rouge se lit
 * comme une alerte qui n'en est pas une.
 */
export type SensMontant = "entree" | "sortie" | "neutre";

/**
 * « Aujourd'hui », « Hier », ou le jour en toutes lettres : le titre d'un
 * groupe d'opérations. `jour` est une date ISO (AAAA-MM-JJ…).
 */
export function libelleDuJour(jour: string, maintenant: Date = new Date()): string {
  const iso = jour.slice(0, 10);
  const local = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const aujourdhui = local(maintenant);
  const veille = new Date(maintenant);
  veille.setDate(veille.getDate() - 1);
  if (iso === aujourdhui) return "Aujourd'hui";
  if (iso === local(veille)) return "Hier";
  const [a, m, j] = iso.split("-").map(Number);
  const d = new Date(a, (m || 1) - 1, j || 1);
  if (Number.isNaN(d.getTime())) return iso;
  const texte = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(a !== maintenant.getFullYear() ? { year: "numeric" as const } : {}),
  });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Une colonne du tableau affiché sur PC. */
export interface ColonneTableau {
  cle: string;
  titre: string;
  align?: "gauche" | "droite" | "centre";
  /** Largeur CSS de la colonne : « 9rem », « 12% ». Absente : selon le contenu. */
  largeur?: string;
  /** Seulement sur grand écran (≥ 1440 px) : une colonne utile mais secondaire. */
  large?: boolean;
}

interface DataListProps {
  items: DataListItem[];
  emptyLabel?: string;
  className?: string;
  /**
   * Une fiche à ouvrir d'office — celle dont parle une notification.
   * L'élément peut être absent de `items` (filtré) : il s'ouvre quand
   * même. `item` nul signifie que l'enregistrement n'existe plus : la
   * liste le dit, plutôt que de laisser l'utilisateur chercher.
   * Chaque nouvelle `cle` rouvre, même vers la même fiche.
   */
  ouvrir?: { cle: number; item: DataListItem | null } | null;
  /**
   * Les colonnes du tableau, sur PC. Absentes, la liste reste une liste
   * partout. Sur téléphone et tablette, la liste ne change jamais.
   */
  colonnes?: ColonneTableau[];
  /** L'en-tête de la première colonne, celle du nom : « Produit », « Client ». */
  titrePrincipal?: string;
  /** La forme de la liste sur téléphone. Par défaut : `compact`. */
  allure?: AllureListe;
  /** En allure `operation` : le sens de l'argent, qui colore le montant. */
  sens?: SensMontant;
}

const classeColonne = (c: ColonneTableau) =>
  [
    c.align === "droite" ? "a-droite" : c.align === "centre" ? "a-centre" : "",
    c.large ? "app-grille-large" : "",
  ]
    .filter(Boolean)
    .join(" ");

const isEmpty = (v: React.ReactNode) =>
  v === null || v === undefined || v === "" || v === "-" || v === "0";

/**
 * Liste dense sur téléphone ; tableau sur PC quand l'écran fournit des
 * `colonnes` (voir `useEcranTableau`).
 *
 * Elle remplace les tableaux à dix colonnes et plus, qui imposaient un
 * défilement horizontal aussi bien sur téléphone que sur grand écran :
 * il fallait suivre une ligne du regard puis faire glisser une barre en
 * bas pour lire la fin. Ici chaque ligne se lit d'un seul coup d'œil —
 * l'essentiel à gauche, le montant à droite, le statut à l'extrême
 * droite — et tout le reste est accessible d'un clic dans un panneau de
 * détails plutôt qu'étalé en colonnes.
 */
/**
 * Combien de lignes on peint d un coup.
 *
 * Une boutique qui tourne depuis un an a des milliers de ventes. Les
 * peindre toutes fige le telephone plusieurs secondes, pour un ecran
 * dont personne ne lit la trois centieme ligne.
 *
 * Ce decoupage ne porte QUE sur l affichage : les totaux, les filtres et
 * les cumuls sont calcules par l ecran appelant, sur la liste entiere.
 * Un chiffre affiche reste donc celui de toutes les donnees, pas celui
 * des lignes visibles — c est la seule facon de ne pas mentir.
 */
const PAR_PAGE = 50;

export const DataList: React.FC<DataListProps> = ({
  items,
  emptyLabel,
  className = "",
  ouvrir,
  colonnes,
  titrePrincipal = "Élément",
  allure = "compact",
  sens = "neutre",
}) => {
  const ecranTableau = useEcranTableau();
  const enTableau = Boolean(colonnes?.length) && ecranTableau;
  /*
   * LA FICHE OUVERTE SUIT LA LISTE.
   *
   * On retenait une COPIE de la ligne au moment du clic. Après une
   * suppression faite depuis la fiche, la copie restait affichée — la
   * vente supprimée toujours à l'écran, avec son bouton « Supprimer » ; après
   * un règlement, le « reste à payer » restait l'ancien. On retient
   * maintenant l'identifiant, et l'on relit la ligne à chaque rendu :
   * modifiée, la fiche se met à jour ; disparue, elle se ferme.
   *
   * Exception : une fiche ouverte par une notification peut viser une
   * ligne que les filtres cachent. Sa copie sert alors tant que la ligne
   * n'est pas dans la liste.
   */
  const [ouverte, setOuverte] = useState<{ id: string; copie: DataListItem | null } | null>(null);
  const ouvrirFiche = (item: DataListItem, depuisLaListe: boolean) =>
    setOuverte({ id: item.id, copie: depuisLaListe ? null : item });
  const setOpenItem = (item: DataListItem | null) =>
    item ? ouvrirFiche(item, true) : setOuverte(null);
  const openItem = ouverte ? (items.find((i) => i.id === ouverte.id) ?? ouverte.copie) : null;
  const [introuvable, setIntrouvable] = useState(false);
  const [affichees, setAffichees] = useState(PAR_PAGE);

  const cleOuverture = ouvrir?.cle;
  useEffect(() => {
    if (!ouvrir) return;
    if (ouvrir.item) ouvrirFiche(ouvrir.item, false);
    else setIntrouvable(true);
    // Seule la clé déclenche : l'élément est recalculé à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleOuverture]);

  return (
    <>
      {items.length === 0 ? (
        <div className={`flex flex-col items-center gap-2 px-4 py-10 text-center ${className}`}>
          <Inbox className="h-7 w-7 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {emptyLabel ?? "Aucun élément à afficher."}
          </p>
        </div>
      ) : enTableau && colonnes ? (
        /* ── Sur PC : un tableau ──
           Chaque information a sa colonne, alignée d'une ligne à
           l'autre : on compare les montants d'un regard au lieu de les
           chercher au bout d'une ligne grise. Le nom reste un vrai
           bouton (clavier, lecteur d'écran) ; le clic n'importe où sur
           la ligne ouvre la même fiche. */
        <div className={`app-grille-cadre ${className}`}>
          <table className="app-grille">
            <thead>
              <tr>
                <th scope="col">{titrePrincipal}</th>
                {colonnes.map((c) => (
                  <th
                    key={c.cle}
                    scope="col"
                    className={classeColonne(c)}
                    style={c.largeur ? { width: c.largeur } : undefined}
                  >
                    {c.titre}
                  </th>
                ))}
                <th aria-hidden="true" className="app-grille-chevron" />
              </tr>
            </thead>
            <tbody>
              {items.slice(0, affichees).map((item) => {
                const clickable = Boolean(item.details?.length || item.actions);
                return (
                  <tr
                    key={item.id}
                    className={clickable ? "est-cliquable" : undefined}
                    onClick={clickable ? () => setOpenItem(item) : undefined}
                  >
                    <td className="app-grille-principal">
                      <div className="flex min-w-0 items-center gap-3">
                        {item.leading && (
                          // Une case à cocher ou une vignette ne doivent
                          // pas ouvrir la fiche.
                          <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            {item.leading}
                          </span>
                        )}
                        <div className="min-w-0">
                          {clickable ? (
                            <button
                              type="button"
                              className="app-grille-titre"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenItem(item);
                              }}
                            >
                              {item.primary}
                            </button>
                          ) : (
                            <span className="app-grille-titre">{item.primary}</span>
                          )}
                          {item.sousTitre && (
                            <div className="app-grille-sous">{item.sousTitre}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {colonnes.map((c) => {
                      const v = item.cellules?.[c.cle];
                      return (
                        <td key={c.cle} className={classeColonne(c)}>
                          {isEmpty(v) ? <span className="app-grille-vide">—</span> : v}
                        </td>
                      );
                    })}
                    <td className="app-grille-chevron">
                      {clickable && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50" aria-hidden />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={`app-list app-allure-${allure} app-sens-${sens} ${className}`}>
          {regrouper(allure, items.slice(0, affichees)).map((bloc, i) => {
            const lignes = bloc.lignes.map((item) => {
              const meta = (item.meta ?? []).filter(Boolean) as string[];
              const clickable = Boolean(item.details?.length || item.actions);

              /* ── Une ligne, en trois blocs ──

                   [photo]  nom                    montant   ⋮
                            référence · contexte   complément
                            [badge]

                 Le nom et le montant sont ce que l'on cherche : ils sont
                 en haut et en gras. Les trois points (allure produit)
                 disent que la ligne s'ouvre — toute la ligne est le
                 bouton, ils n'en sont que le signe. */
              const inner = (
                <span className="app-ligne">
                  <span className="app-ligne-texte">
                    <span className="app-list-primary">{item.primary}</span>
                    {meta.length > 0 && (
                      <span className="app-list-secondary">{meta.join(" · ")}</span>
                    )}
                    {item.badge && <span className="app-ligne-badge">{item.badge}</span>}
                  </span>
                  {item.jauge && (
                    <span className="app-ligne-jauge">
                      <span className="app-ligne-jauge-piste" aria-hidden="true">
                        <i
                          style={{
                            width: `${Math.round(Math.min(1, Math.max(0, item.jauge.part)) * 100)}%`,
                          }}
                        />
                      </span>
                      {item.jauge.libelle && (
                        <span className="app-ligne-jauge-libelle">{item.jauge.libelle}</span>
                      )}
                    </span>
                  )}
                  {(item.amount || item.amountHint) && (
                    <span className="app-ligne-prix">
                      {item.amount && <span className="app-list-amount">{item.amount}</span>}
                      {item.amountHint && (
                        <span className="app-list-secondary">{item.amountHint}</span>
                      )}
                    </span>
                  )}
                  {clickable &&
                    (allure === "produit" ? (
                      <span className="app-ligne-menu" aria-hidden="true">
                        <MoreVertical className="h-[18px] w-[18px]" />
                      </span>
                    ) : (
                      <ChevronRight
                        className="app-ligne-chevron h-4 w-4 shrink-0 text-muted-foreground/50"
                        aria-hidden="true"
                      />
                    ))}
                </span>
              );

              // Sans élément de tête, la ligne EST le bouton. Avec, c'est le
              // conteneur qui porte l'espacement et le bouton n'a plus de
              // marge interne propre — sinon les deux s'additionnent et la
              // ligne dépasse à droite.
              if (!item.leading) {
                const Row = clickable ? "button" : "div";
                return (
                  <Row
                    key={item.id}
                    {...(clickable
                      ? { type: "button" as const, onClick: () => setOpenItem(item) }
                      : {})}
                    className="app-list-row w-full gap-3 text-left"
                    data-complet={item.jauge && item.jauge.part >= 1 ? "" : undefined}
                  >
                    {inner}
                  </Row>
                );
              }

              return (
                <div
                  key={item.id}
                  className="app-list-row gap-3"
                  data-complet={item.jauge && item.jauge.part >= 1 ? "" : undefined}
                >
                  <span className="shrink-0">{item.leading}</span>
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => setOpenItem(item)}
                      className="flex min-w-0 flex-1 text-left"
                    >
                      {inner}
                    </button>
                  ) : (
                    <span className="flex min-w-0 flex-1">{inner}</span>
                  )}
                </div>
              );
            });

            return bloc.titre === null ? (
              <React.Fragment key={`b${i}`}>{lignes}</React.Fragment>
            ) : (
              <section key={`b${i}`} className="app-jour" aria-label={bloc.titre}>
                <h3 className="app-jour-titre">{bloc.titre}</h3>
                <div className="app-jour-bloc">{lignes}</div>
              </section>
            );
          })}
        </div>
      )}

      {items.length > affichees && (
        <button
          type="button"
          onClick={() => setAffichees((n) => n + PAR_PAGE)}
          className="w-full border-t border-border px-4 py-3 text-sm font-medium text-primary hover:bg-muted"
        >
          Voir la suite — {affichees} sur {items.length}
        </button>
      )}

      {openItem && (
        <Modal
          open
          onClose={() => setOpenItem(null)}
          size="md"
          title={
            openItem.detailTitle ??
            (typeof openItem.primary === "string" ? openItem.primary : "Détail")
          }
          description={openItem.detailSubtitle}
          footer={openItem.actions}
        >
          {/* Ce qui ne tient pas dans un couple libellé / valeur : les
              lignes d'un ticket, par exemple, qui ont chacune leur
              montant et leurs propres actions. */}
          {openItem.detailBody}
          <dl className="divide-y divide-border">
            {(openItem.details ?? [])
              .filter((f) => !(f.hideIfEmpty && isEmpty(f.value)))
              .map((f, i) => (
                <div key={i} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <dt className="shrink-0 text-muted-foreground">{f.label}</dt>
                  <dd className="min-w-0 text-right font-medium text-foreground">{f.value}</dd>
                </div>
              ))}
          </dl>
        </Modal>
      )}

      <AvisIntrouvable open={introuvable} onClose={() => setIntrouvable(false)} />
    </>
  );
};

/**
 * Les lignes, en blocs : par jour, quand les lignes portent un `groupe`
 * (les ventes et les achats, en allure produit comme en allure
 * operation). La liste compacte reste toujours d'un seul tenant.
 */
function regrouper(
  allure: AllureListe,
  lignes: DataListItem[],
): { titre: string | null; lignes: DataListItem[] }[] {
  if (allure === "compact" || !lignes.some((l) => l.groupe)) {
    return [{ titre: null, lignes }];
  }
  const blocs: { titre: string | null; lignes: DataListItem[] }[] = [];
  for (const l of lignes) {
    const titre = l.groupe ?? "";
    const dernier = blocs[blocs.length - 1];
    if (dernier && dernier.titre === titre) dernier.lignes.push(l);
    else blocs.push({ titre, lignes: [l] });
  }
  return blocs;
}

/**
 * Un pictogramme de ligne : une icône sur un disque doux, dans un ton.
 * À poser en `leading` des listes qui n'ont pas de photo (dépenses,
 * apports, factures reçues).
 */
export const Picto: React.FC<{
  ton?: "vert" | "orange" | "rouge" | "bleu" | "violet" | "gris";
  children: React.ReactNode;
}> = ({ ton = "vert", children }) => (
  <span className={`app-picto ton-${ton}`} aria-hidden="true">
    {children}
  </span>
);

/**
 * Une petite feuille au coin plié, qui porte le type d'une pièce : « FAC »,
 * « REÇU », « AVOIR ». Le ton suit la nature de la pièce.
 */
export const PictoDocument: React.FC<{
  type: string;
  ton?: "vert" | "orange" | "rouge" | "bleu" | "violet" | "gris";
}> = ({ type, ton = "vert" }) => (
  <span className={`app-picto-doc ton-${ton}`} aria-hidden="true">
    <span className="app-picto-doc-lignes" />
    <span className="app-picto-doc-type">{type}</span>
  </span>
);
