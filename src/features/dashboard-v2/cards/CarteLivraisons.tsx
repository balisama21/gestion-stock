import React from "react";
import { Card, CardHeader } from "../components/Card";
import { EtatVide } from "../components/States";
import { dateLocale, montant } from "../lib/format";
import { dateDuJour } from "../../../lib/dates";

/**
 * 18. LIVRAISONS
 *
 * Ce qui part aujourd'hui, puis ce qui est prévu. Une tournée se lit
 * dans l'ordre où on la fait, pas par ordre de création.
 *
 * LES RÉCEPTIONS FOURNISSEURS N'Y SONT PAS. La maquette annonçait une
 * « Réception fournisseur 18/09 · 09:00 » ; aucune table ne porte de
 * date de réception prévue — `purchases` n'a qu'une date d'achat et une
 * date d'échéance de paiement. Inventer cette ligne reviendrait à
 * afficher une donnée qui n'existe pas. Le titre de la carte a donc
 * perdu sa seconde moitié : il dit « Livraisons », et rien d'autre.
 * Voir `docs/dashboard-v2/audit.md`, § 7.
 */

export interface LivraisonAffichee {
  id: string;
  destinataire: string;
  adresse?: string | null;
  statut: string;
  date_prevue?: string | null;
  montant_a_encaisser?: number;
}

const ETATS: Record<string, string> = {
  a_preparer: "À préparer",
  en_cours: "En cours",
  livree: "Livrée",
  echouee: "Échouée",
  annulee: "Annulée",
};

export const CarteLivraisons: React.FC<{
  livraisons: LivraisonAffichee[];
  visible: boolean;
  onOuvrir?: () => void;
}> = ({ livraisons, visible, onOuvrir }) => {
  const aujourdhui = dateDuJour();

  const ouvertes = livraisons.filter((l) => l.statut !== "annulee" && l.statut !== "livree");
  const duJour = ouvertes.filter((l) => l.date_prevue === aujourdhui);
  const aVenir = ouvertes
    .filter((l) => l.date_prevue && l.date_prevue > aujourdhui)
    .sort((a, b) => (a.date_prevue ?? "").localeCompare(b.date_prevue ?? ""))
    .slice(0, 3);

  const arret = (l: LivraisonAffichee) => (
    <div className="stop" key={l.id}>
      <div className="dd">
        <b>{l.date_prevue ? Number(l.date_prevue.slice(8)) : "—"}</b>
        <small>
          {l.date_prevue
            ? dateLocale(l.date_prevue).toLocaleDateString("fr-FR", { month: "short" })
            : ""}
        </small>
      </div>
      <div>
        <span>{l.destinataire}</span>
        <em>
          {ETATS[l.statut] ?? l.statut}
          {l.adresse ? ` · ${l.adresse}` : ""}
        </em>
      </div>
      {(l.montant_a_encaisser ?? 0) > 0 && (
        <span className="num" style={{ fontSize: 13, fontWeight: 600 }}>
          {visible ? montant(l.montant_a_encaisser ?? 0) : "••• Ar"}
        </span>
      )}
    </div>
  );

  return (
    <Card span={6} id="carte-livraisons">
      <CardHeader
        title="Livraisons"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4h14v12H1zM15 9h4l3 3v4h-7" />
            <circle cx="5.5" cy="18.5" r="2" />
            <circle cx="18.5" cy="18.5" r="2" />
          </svg>
        }
        action={
          onOuvrir && (
            <button className="link" type="button" onClick={onOuvrir}>
              Tout voir
            </button>
          )
        }
      />

      {duJour.length === 0 ? (
        <EtatVide
          titre="Aucune livraison aujourd'hui"
          detail="Aucune commande client à livrer dans la journée."
        />
      ) : (
        <div className="route">{duJour.map(arret)}</div>
      )}

      {aVenir.length > 0 && (
        <>
          <div className="sous-titre">À venir</div>
          <div className="route">{aVenir.map(arret)}</div>
        </>
      )}
    </Card>
  );
};
