import React, { useEffect, useState } from "react";
import { ChevronRight, Inbox } from "lucide-react";
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
        <div className={`app-list ${className}`}>
          {items.slice(0, affichees).map((item) => {
            const meta = (item.meta ?? []).filter(Boolean) as string[];
            const clickable = Boolean(item.details?.length || item.actions);

            const inner = (
              <>
                {/* Bloc gauche : information principale puis, en dessous,
                  tout le contexte sur une seule ligne grise. */}
                <span className="min-w-0 flex-1">
                  <span className="app-list-primary block">{item.primary}</span>
                  {meta.length > 0 && (
                    <span className="app-list-secondary block">{meta.join(" · ")}</span>
                  )}
                </span>

                {/* Bloc droit : montant, puis badge de statut. */}
                <span className="flex shrink-0 items-center gap-2 sm:gap-3">
                  {(item.amount || item.amountHint) && (
                    <span className="text-right">
                      {item.amount && <span className="app-list-amount block">{item.amount}</span>}
                      {item.amountHint && (
                        <span className="app-list-secondary block">{item.amountHint}</span>
                      )}
                    </span>
                  )}
                  {item.badge && <span className="shrink-0">{item.badge}</span>}
                  {/* Le chevron disparaît sur écran étroit : ces 20 px sont
                    plus utiles au libellé principal qu'à un indice
                    d'affordance que le clic donne de toute façon. */}
                  {clickable && (
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/50 sm:block" />
                  )}
                </span>
              </>
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
                  className="app-list-row w-full justify-between gap-3 text-left"
                >
                  {inner}
                </Row>
              );
            }

            return (
              <div key={item.id} className="app-list-row gap-3">
                <span className="shrink-0">{item.leading}</span>
                {clickable ? (
                  <button
                    type="button"
                    onClick={() => setOpenItem(item)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                  >
                    {inner}
                  </button>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    {inner}
                  </span>
                )}
              </div>
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
