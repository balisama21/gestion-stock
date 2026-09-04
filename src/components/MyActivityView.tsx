import React from "react";
import { Lock, TrendingUp, Wallet, ShoppingBag } from "lucide-react";
import { formatCurrency } from "../utils/formulas";
import { Seller } from "../types";

interface MyActivityViewProps {
  /** "dashboard" ou "capital" — change uniquement le texte d'en-tête. */
  variant: "dashboard" | "capital";
  storeName: string;
  /** L'entrée de computedSellers correspondant à l'utilisateur connecté,
   *  s'il en a une (peut être absent s'il n'a encore rien vendu). */
  mySellerData: Seller | null;
}

/**
 * Remplace DashboardView/CapitalView pour un collaborateur qui n'a PAS la
 * permission "dashboard"/"capital" complète. Plutôt que de cacher
 * entièrement l'onglet, on affiche une vue dédiée limitée à SON PROPRE
 * activité (ses ventes, son solde) — jamais la trésorerie ou le capital
 * global de l'entreprise.
 */
export const MyActivityView: React.FC<MyActivityViewProps> = ({
  variant,
  storeName,
  mySellerData,
}) => {
  const title =
    variant === "dashboard" ? "Mon activité" : "Mon solde (accès trésorerie restreint)";

  return (
    <div className="space-y-6">
      <div className="bg-card border border-amber-500/20 rounded-2xl p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5 t-warning" />
        </div>
        <div>
          <h2 className="font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Le propriétaire de <strong>{storeName}</strong> ne vous a pas donné accès{" "}
            {variant === "dashboard"
              ? "au tableau de bord complet de l'entreprise"
              : "à la trésorerie complète de l'entreprise"}
            . Voici uniquement votre propre activité.
          </p>
        </div>
      </div>

      {mySellerData ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-2">
              <ShoppingBag className="w-4 h-4" />
              Mes ventes
            </div>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(mySellerData.totalVentesMontant)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {mySellerData.totalVentesNombre} vente{mySellerData.totalVentesNombre > 1 ? "s" : ""}
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-2">
              <TrendingUp className="w-4 h-4" />
              Mes dépenses enregistrées
            </div>
            <p className="text-2xl font-bold t-danger">
              {formatCurrency(mySellerData.totalDepenses)}
            </p>
          </div>

          <div className="bg-card border border-emerald-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 t-success text-xs font-semibold uppercase tracking-wide mb-2">
              <Wallet className="w-4 h-4" />
              Mon solde net en poche
            </div>
            <p className="text-2xl font-bold t-success">
              {formatCurrency(mySellerData.soldeNetEnPoche)}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">
          Aucune activité enregistrée à votre nom pour le moment.
        </div>
      )}
    </div>
  );
};