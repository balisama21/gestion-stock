import React from "react";
import { Printer, ReceiptText } from "lucide-react";
import { Modal } from "../shared/Modal";
import { formatCurrency } from "../../utils/formulas";
import { imprimerFeuille } from "../../features/documents/lib/imprimer";

export interface LigneDuTicket {
  designation: string;
  quantite: string;
  montant: number;
  /** « 1 comprimé matin et soir pendant 7 jours ». */
  posologie: string;
}

export interface TicketDelivrance {
  boutique: string;
  date: string;
  heure: string;
  vendeur: string;
  lignes: LigneDuTicket[];
  total: number;
  partOrganisme: number;
  organisme: string | null;
  paye: number;
  rendu: number;
  patient: string | null;
  ordonnance: number | null;
  prescripteur: string | null;
}

/**
 * LE TICKET D'UNE DÉLIVRANCE
 *
 * Ce que le patient emporte : les médicaments, ce qu'il a payé, la part
 * de son assurance, et surtout la POSOLOGIE de chaque boîte — ce que le
 * pharmacien écrit d'habitude au stylo sur l'emballage. Au format d'un
 * rouleau de 80 mm.
 */
export const TicketPharmacie: React.FC<{ ticket: TicketDelivrance; onFermer: () => void }> = ({
  ticket: t,
  onFermer,
}) => (
  <Modal
    open
    onClose={onFermer}
    size="md"
    icon={<ReceiptText className="h-4 w-4" />}
    title="Ticket de délivrance"
    footer={
      <>
        <button type="button" onClick={onFermer} className="app-btn-secondary">
          Fermer
        </button>
        <button type="button" onClick={() => imprimerFeuille(80)} className="app-btn-primary">
          <Printer className="h-4 w-4" />
          Imprimer
        </button>
      </>
    }
  >
    <div className="receipt-viewport flex justify-center">
      <div
        className="printable-receipt bg-white p-[4mm] font-mono text-[9pt] leading-snug text-black shadow-sm [&_*]:font-mono [&_p]:text-[9pt]"
        style={{ width: "76mm" }}
      >
        <p className="text-center !text-[11pt] font-bold">{t.boutique}</p>
        <p className="text-center">
          {t.date} · {t.heure}
        </p>
        <p className="text-center">Servi par {t.vendeur}</p>
        {t.ordonnance !== null && (
          <p className="mt-1 text-center">
            Ordonnance n° {t.ordonnance}
            {t.prescripteur ? ` · ${t.prescripteur}` : ""}
          </p>
        )}
        {t.patient && <p className="text-center">Patient : {t.patient}</p>}
        <div className="my-2 border-t border-dashed border-black" />
        {t.lignes.map((l, i) => (
          <div key={i} className="mb-1.5">
            <div className="flex justify-between gap-2">
              <span className="font-bold">{l.designation}</span>
              <span className="shrink-0">{formatCurrency(l.montant)}</span>
            </div>
            <div>{l.quantite}</div>
            {l.posologie && <div className="italic">→ {l.posologie}</div>}
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-black" />
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>{formatCurrency(t.total)}</span>
        </div>
        {t.partOrganisme > 0 && (
          <div className="flex justify-between">
            <span>Part {t.organisme ?? "organisme"}</span>
            <span>− {formatCurrency(t.partOrganisme)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Payé</span>
          <span>{formatCurrency(t.paye)}</span>
        </div>
        {t.rendu > 0 && (
          <div className="flex justify-between">
            <span>Rendu</span>
            <span>{formatCurrency(t.rendu)}</span>
          </div>
        )}
        <div className="my-2 border-t border-dashed border-black" />
        <p className="text-center">Prompt rétablissement.</p>
        <p className="text-center text-[8pt]">
          Conservez vos médicaments hors de portée des enfants.
        </p>
      </div>
    </div>
  </Modal>
);
