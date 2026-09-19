import React from "react";
import { Card, CardHeader } from "../components/Card";
import { EtatVide } from "../components/States";
import { montant, nombre } from "../lib/format";
import type { ChiffresClients } from "../lib/chiffres";
import { teinteDe } from "../../../lib/teintes";

/**
 * 13. CLIENTS
 *
 * Trois nombres, puis ceux qu'il faut rappeler.
 *
 * « RELANCER » N'ENVOIE RIEN. Le bouton ouvre le panneau, qui propose un
 * appel, un SMS ou WhatsApp déjà rédigés — et c'est la personne qui
 * appuie sur envoyer, dans son application de messages. Un logiciel de
 * gestion qui enverrait des relances tout seul finirait par en envoyer
 * une de trop.
 */

export const CarteClients: React.FC<{
  clients: ChiffresClients;
  visible: boolean;
  onRelancer?: (client: ChiffresClients["aRelancer"][number]) => void;
  onTous?: () => void;
}> = ({ clients, visible, onRelancer, onTous }) => {
  const aRelancer = clients.aRelancer.slice(0, 3);

  return (
    <Card span={4} id="carte-clients">
      <CardHeader
        title="Clients"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
            <path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
          </svg>
        }
        action={
          onTous && (
            <button className="link" type="button" onClick={onTous}>
              Tous
            </button>
          )
        }
      />

      <div className="facts3">
        <div className="fact">
          <small>Nouveaux</small>
          <b>{nombre(clients.nouveaux)}</b>
        </div>
        <div className="fact">
          <small>Actifs</small>
          <b>{nombre(clients.actifs)}</b>
        </div>
        <div className={`fact${clients.aRelancer.length > 0 ? " warn" : ""}`}>
          <small>À relancer</small>
          <b>{nombre(clients.aRelancer.length)}</b>
        </div>
      </div>

      {aRelancer.length === 0 ? (
        <EtatVide
          titre="Aucun client à relancer"
          detail="Toutes les ventes à crédit ont été réglées."
        />
      ) : (
        <>
          <div className="sous-titre">À relancer</div>
          <div className="people">
            {aRelancer.map((c) => (
              <div className="person" key={c.id ?? c.nom}>
                <div className="av" style={{ background: teinteDe(c.nom) }}>
                  {c.nom.charAt(0).toUpperCase()}
                </div>
                <div className="info">
                  <b>{c.nom}</b>
                  <small>
                    Doit {visible ? montant(c.du) : "••• Ar"} · depuis{" "}
                    {c.depuis <= 1 ? "1 jour" : `${nombre(c.depuis)} jours`}
                  </small>
                </div>
                {onRelancer && (
                  <button className="btn ghost" type="button" onClick={() => onRelancer(c)}>
                    Relancer
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};
