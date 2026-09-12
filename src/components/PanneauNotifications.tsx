import React from "react";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import type { ActiveTab } from "../types";
import { libelleQuand, type Notification, type TonNotif } from "../lib/activite";

interface PanneauNotificationsProps {
  alertes: Notification[];
  activites: Notification[];
  /** Identifiants déjà vus — sert à marquer ce qui est nouveau. */
  lues: Set<string>;
  nonLues: number;
  onToutMarquerLu: () => void;
  onOuvrirEcran: (onglet: ActiveTab) => void;
  onFermer: () => void;
}

/** Un filet de couleur, pas une pastille : le statut se lit au bord. */
const FILET: Record<TonNotif, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutre: "bg-border",
};

/**
 * Ce que dit la cloche.
 *
 * Elle ne signalait qu'une chose : les produits sous leur seuil. Tout le
 * reste de ce que fait la boutique — une vente, un règlement reçu, un
 * devis accepté, une livraison qui échoue — n'y laissait aucune trace.
 *
 * Le panneau distingue maintenant deux choses qui ne se lisent pas de la
 * même façon :
 *
 * — « À traiter » rassemble des ÉTATS. Un stock en rupture, une
 *   trésorerie sous le seuil, de l'argent resté chez un livreur : cela
 *   dure tant que ce n'est pas réglé, et cela appelle une action. Ces
 *   lignes sont regroupées — « 3 produits sous le seuil » plutôt que
 *   trois lignes — parce qu'on y va pour agir, pas pour compter ;
 * — « Activité » est un journal d'ÉVÉNEMENTS datés, du plus récent au
 *   plus ancien. On le parcourt, on ne le traite pas.
 *
 * Chaque ligne conduit à l'écran concerné : une notification qui ne mène
 * nulle part oblige à refaire à la main le chemin qu'elle vient de
 * décrire.
 */
export const PanneauNotifications: React.FC<PanneauNotificationsProps> = ({
  alertes,
  activites,
  lues,
  nonLues,
  onToutMarquerLu,
  onOuvrirEcran,
  onFermer,
}) => {
  const ligne = (n: Notification) => {
    const nouvelle = !lues.has(n.id);
    return (
      <button
        key={n.id}
        onClick={() => {
          if (n.onglet) onOuvrirEcran(n.onglet);
          onFermer();
        }}
        className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
      >
        <span className={`mt-1.5 h-8 w-0.5 shrink-0 rounded-full ${FILET[n.ton]}`} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={`truncate text-[13px] ${nouvelle ? "font-semibold text-foreground" : "text-foreground"}`}
            >
              {n.titre}
            </span>
            {n.quand && (
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {libelleQuand(n.quand)}
              </span>
            )}
          </span>
          {/* Le quoi à gauche, le qui à droite. C'est la question qu'on
              se pose en ouvrant ce panneau — qui a enregistré cette
              vente, qui a passé cette commande — et elle mérite sa
              colonne plutôt que d'être noyée en fin de phrase. */}
          <span className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {n.detail}
            </span>
            {n.acteur && (
              <span className="shrink-0 text-[11px] font-medium text-foreground/70">
                {n.acteur}
              </span>
            )}
          </span>
        </span>
        {n.onglet && (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
        )}
      </button>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onFermer} />
      {/* ── Deux positionnements, et il en faut deux ──
          Sur téléphone, le panneau se pose SOUS la barre du haut et
          s'étend d'un bord à l'autre. Il ne s'accrochait auparavant
          qu'au bouton de la cloche, et c'est ce qui le faisait sortir
          de l'écran : la cloche n'est pas au bord — le bouton des
          réglages la suit. À 360 pixels, le panneau en mesure 330 et
          son bord droit tombait à 297 : il commençait donc à moins
          trente-trois, et l'on perdait les deux premières lettres de
          chaque ligne.
          Le plafond de largeur qui était censé l'en empêcher ne
          pouvait rien : il se mesure sur l'écran, alors que le
          débordement venait du point d'ancrage.
          À partir de 640 pixels il n'y a plus de problème de place :
          le panneau redevient un menu déroulant sous la cloche. */}
      <div className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[70dvh] overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-top-2 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-none sm:w-[22rem]">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bell className="h-4 w-4 text-primary" />
            Notifications
          </div>
          {nonLues > 0 && (
            <button
              onClick={onToutMarquerLu}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Tout marquer lu
            </button>
          )}
        </div>

        {/* Sur telephone le plafond vient du panneau lui-meme, qui se
            mesure sur la hauteur de l ecran ; ici on borne seulement le
            menu deroulant de bureau. */}
        <div className="max-h-[calc(70dvh-3.25rem)] overflow-y-auto sm:max-h-[26rem]">
          {alertes.length === 0 && activites.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">Rien à signaler.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Les ventes, achats et alertes de stock apparaîtront ici.
              </p>
            </div>
          ) : (
            <>
              {alertes.length > 0 && (
                <div>
                  <div className="px-4 pb-1 pt-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                    À traiter
                  </div>
                  <div className="divide-y divide-border/60">{alertes.map(ligne)}</div>
                </div>
              )}
              {activites.length > 0 && (
                <div>
                  <div
                    className={`px-4 pb-1 pt-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70 ${
                      alertes.length > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    Activité
                  </div>
                  <div className="divide-y divide-border/60">{activites.map(ligne)}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};
