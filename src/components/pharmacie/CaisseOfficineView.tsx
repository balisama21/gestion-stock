import React, { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Calculator,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CreditCard,
  Printer,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type { Payment, Sale } from "../../types";
import { Modal } from "../shared/Modal";
import { formatCurrency } from "../../utils/formulas";
import { imprimerFeuille } from "../../features/documents/lib/imprimer";
import { MODES_DE_PAIEMENT } from "../facturation/paiement";
import { caisseDuJour, ecartDuTiroir } from "../../lib/caisseOfficine";
import type { OrganismePharma } from "../../lib/pharmacie";
import { Chiffre, EnTete, Panneau, Raccourcis, Vide } from "./ui";

/** Le fond de caisse posé un autre jour, s'il a été noté sur cet appareil. */
const fondDe = (storeId: string, jour: string): string => {
  try {
    const brut = window.localStorage.getItem(`tn-caisse-officine:${storeId}:${jour}`);
    return brut ? ((JSON.parse(brut) as { fond?: string }).fond ?? "") : "";
  } catch {
    return "";
  }
};

interface Props {
  storeId: string;
  storeName: string;
  sales: Sale[];
  payments: Payment[];
  organismes: OrganismePharma[];
  aujourdhui: string;
}

const libelleMoyen = (m: string) =>
  MODES_DE_PAIEMENT.find((x) => x.valeur === m)?.libelle ?? (m || "Espèces");

const ICONES: Record<string, React.ReactNode> = {
  especes: <Banknote className="h-4 w-4" />,
  mobile_money: <Smartphone className="h-4 w-4" />,
  virement: <CreditCard className="h-4 w-4" />,
  cheque: <ReceiptText className="h-4 w-4" />,
};

const decaler = (jour: string, n: number) => {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const jourLisible = (jour: string, aujourdhui: string) => {
  if (jour === aujourdhui) return "Aujourd'hui";
  if (jour === decaler(aujourdhui, -1)) return "Hier";
  const d = new Date(`${jour}T12:00:00Z`);
  const [a, m, j] = jour.split("-");
  return `${JOURS[d.getUTCDay()]} ${j}/${m}/${a}`;
};

const heure = (iso: string) =>
  iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";

/** Le comptage du tiroir, gardé sur l'appareil pour la journée. */
function useComptage(storeId: string, jour: string) {
  const cle = `tn-caisse-officine:${storeId}:${jour}`;
  const lire = () => {
    try {
      const brut = window.localStorage.getItem(cle);
      if (brut) return JSON.parse(brut) as { fond: string; compte: string };
    } catch {
      /* stockage indisponible : on recompte */
    }
    return { fond: "", compte: "" };
  };
  const [valeur, setValeur] = useState(lire);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setValeur(lire()), [cle]);
  const changer = (v: { fond: string; compte: string }) => {
    setValeur(v);
    try {
      window.localStorage.setItem(cle, JSON.stringify(v));
    } catch {
      /* rien à faire */
    }
  };
  return [valeur, changer] as const;
}

const nombre = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * LA CAISSE DU JOUR
 *
 * Ce que le pharmacien regarde en fermant : la recette, l'argent reçu
 * moyen par moyen, le tiroir compté contre ce qu'il devrait contenir, ce
 * que doivent encore les patients et les organismes. Le relevé s'imprime.
 */
export const CaisseOfficineView: React.FC<Props> = ({
  storeId,
  storeName,
  sales,
  payments,
  organismes,
  aujourdhui,
}) => {
  const [jour, setJour] = useState(aujourdhui);
  const [releve, setReleve] = useState(false);
  const ids = useMemo(() => new Set(organismes.map((o) => o.client_id)), [organismes]);
  const c = useMemo(() => caisseDuJour(jour, sales, payments, ids), [jour, sales, payments, ids]);
  const [comptage, setComptage] = useComptage(storeId, jour);
  const fond = nombre(comptage.fond);
  const compte = nombre(comptage.compte);
  const attendu = fond + c.especes;
  const ecart = ecartDuTiroir(fond, c.especes, compte);
  const compteSaisi = comptage.compte.trim() !== "";
  const plusGros = Math.max(1, ...c.parMoyen.map((m) => m.montant));
  const fondHier = fondDe(storeId, decaler(jour, -1)).trim();
  const fonds = [
    ...(fondHier ? [{ valeur: fondHier, libelle: "Comme hier" }] : []),
    ...["10000", "20000", "50000"].map((f) => ({
      valeur: f,
      libelle: formatCurrency(Number(f)),
    })),
  ];

  return (
    <div className="ph-page">
      <EnTete
        icone={<Calculator className="h-6 w-6" />}
        titre="Caisse du jour"
        sousTitre="L'argent reçu, moyen par moyen, et le tiroir compté au centime."
        actions={
          <>
            <div className="flex min-w-0 items-center rounded-xl border border-border bg-card sm:min-w-[13rem]">
              <button
                type="button"
                onClick={() => setJour(decaler(jour, -1))}
                className="p-2 text-muted-foreground hover:text-primary"
                aria-label="Jour précédent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-0 flex-1 truncate px-1 text-center text-sm font-bold capitalize">
                {jourLisible(jour, aujourdhui)}
              </span>
              <button
                type="button"
                onClick={() => setJour(decaler(jour, 1))}
                disabled={jour >= aujourdhui}
                className="p-2 text-muted-foreground hover:text-primary disabled:opacity-30"
                aria-label="Jour suivant"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button type="button" onClick={() => setReleve(true)} className="app-btn-primary">
              <Printer className="h-4 w-4" />
              Relevé de caisse
            </button>
          </>
        }
      >
        <Chiffre ton="plein" valeur={formatCurrency(c.vendu)} libelle="Délivré" />
        <Chiffre valeur={formatCurrency(c.recu)} libelle="Encaissé" />
        <Chiffre
          ton={c.creditPatients > 0 ? "warning" : undefined}
          valeur={formatCurrency(c.creditPatients)}
          libelle="Crédit patients"
        />
        <Chiffre
          valeur={formatCurrency(c.creditTiers)}
          libelle="Part tiers payant"
          icone={<ShieldCheck className="h-3 w-3" />}
        />
        <Chiffre valeur={c.tickets.length} libelle="Clients servis" />
      </EnTete>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          <Panneau titre="Le tiroir" icone={<Wallet className="h-4 w-4" />} corps>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-muted-foreground">
                  Fond de caisse
                </span>
                <input
                  inputMode="numeric"
                  value={comptage.fond}
                  onChange={(e) => setComptage({ ...comptage, fond: e.target.value })}
                  placeholder="0"
                  className="app-field w-full text-right tabular-nums"
                />
                <Raccourcis
                  libelle="Fond de caisse"
                  actif={comptage.fond}
                  onChoisir={(f) => setComptage({ ...comptage, fond: f })}
                  options={fonds}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-muted-foreground">
                  Espèces comptées
                </span>
                <input
                  inputMode="numeric"
                  value={comptage.compte}
                  onChange={(e) => setComptage({ ...comptage, compte: e.target.value })}
                  placeholder="Compter le tiroir"
                  className="app-field w-full text-right tabular-nums"
                />
              </label>
            </div>
            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Espèces reçues</dt>
                <dd className="font-semibold tabular-nums">{formatCurrency(c.especes)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Le tiroir devrait contenir</dt>
                <dd className="font-bold tabular-nums">{formatCurrency(attendu)}</dd>
              </div>
            </dl>
            {compteSaisi ? (
              <div
                className={`mt-4 flex items-center gap-3 rounded-xl p-3 ${
                  Math.abs(ecart) < 1
                    ? "bg-success-soft t-success"
                    : ecart < 0
                      ? "bg-danger-soft t-danger"
                      : "bg-warning-soft t-warning"
                }`}
              >
                {Math.abs(ecart) < 1 ? (
                  <CircleCheck className="h-5 w-5 shrink-0" />
                ) : (
                  <TriangleAlert className="h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-extrabold">
                    {Math.abs(ecart) < 1
                      ? "Le tiroir tombe juste"
                      : ecart < 0
                        ? `Il manque ${formatCurrency(-ecart)}`
                        : `${formatCurrency(ecart)} de trop`}
                  </p>
                  <p className="text-xs opacity-80">
                    Compté {formatCurrency(compte)} pour {formatCurrency(attendu)} attendus.
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                Comptez les billets du tiroir en fin de journée : l&apos;écart s&apos;affiche ici.
                Le comptage reste sur cet appareil.
              </p>
            )}
          </Panneau>

          <Panneau titre="Encaissé par moyen" icone={<Banknote className="h-4 w-4" />} corps>
            {c.parMoyen.length === 0 ? (
              <Vide>Aucun paiement reçu ce jour.</Vide>
            ) : (
              <ul className="space-y-3">
                {c.parMoyen.map((m) => (
                  <li key={m.methode}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-primary">
                        {ICONES[m.methode] ?? <Banknote className="h-4 w-4" />}
                      </span>
                      <span className="flex-1 font-semibold">{libelleMoyen(m.methode)}</span>
                      <span className="text-xs text-muted-foreground">{m.nombre} paiement(s)</span>
                      <span className="w-28 text-right font-bold tabular-nums">
                        {formatCurrency(m.montant)}
                      </span>
                    </div>
                    <div className="ml-10 mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(3, (m.montant / plusGros) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {c.reglementsAnterieurs > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                Dont {formatCurrency(c.reglementsAnterieurs)} de crédits anciens réglés ce jour.
              </p>
            )}
          </Panneau>
        </div>

        <Panneau
          titre="Les délivrances"
          icone={<ReceiptText className="h-4 w-4" />}
          className="lg:col-span-3"
        >
          {c.tickets.length === 0 ? (
            <Vide>Aucune vente ce jour.</Vide>
          ) : (
            <ul className="ph-liste max-h-[34rem] overflow-y-auto">
              {c.tickets.map((t) => (
                <li
                  key={t.cle}
                  className="ph-ligne"
                  data-ton={t.tiers ? "info" : t.du > 0 ? "warning" : undefined}
                >
                  <span className="w-12 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                    {heure(t.quand)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {t.articles.join(", ")}
                    </span>
                    {(t.client || t.du > 0) && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.client ?? "Patient"}
                        {t.du > 0
                          ? ` · ${formatCurrency(t.du)} ${t.tiers ? "à l'organisme" : "dû"}`
                          : ""}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(t.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panneau>
      </div>

      {releve && (
        <Modal
          open
          onClose={() => setReleve(false)}
          size="md"
          icon={<Printer className="h-4 w-4" />}
          title="Relevé de caisse"
          description={jourLisible(jour, aujourdhui)}
          footer={
            <>
              <button type="button" onClick={() => setReleve(false)} className="app-btn-secondary">
                Fermer
              </button>
              <button type="button" onClick={() => imprimerFeuille(80)} className="app-btn-primary">
                <Printer className="h-4 w-4" />
                Imprimer
              </button>
            </>
          }
        >
          <div className="receipt-viewport flex justify-center overflow-x-auto">
            <div
              className="printable-receipt w-[80mm] bg-white p-[4mm] text-[9.5pt] text-black"
              style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}
            >
              <p className="text-center text-[11pt] font-bold">{storeName}</p>
              <p className="text-center">RELEVÉ DE CAISSE</p>
              <p className="mb-2 text-center">{jour.split("-").reverse().join("/")}</p>
              <LigneReleve libelle="Délivré" valeur={c.vendu} gras />
              <LigneReleve libelle="Clients servis" texte={String(c.tickets.length)} />
              <p className="my-1 border-t border-dashed border-black" />
              {c.parMoyen.map((m) => (
                <LigneReleve key={m.methode} libelle={libelleMoyen(m.methode)} valeur={m.montant} />
              ))}
              <LigneReleve libelle="Total encaissé" valeur={c.recu} gras />
              <p className="my-1 border-t border-dashed border-black" />
              <LigneReleve libelle="Crédit patients" valeur={c.creditPatients} />
              <LigneReleve libelle="Part tiers payant" valeur={c.creditTiers} />
              <p className="my-1 border-t border-dashed border-black" />
              <LigneReleve libelle="Fond de caisse" valeur={fond} />
              <LigneReleve libelle="Tiroir attendu" valeur={attendu} />
              {compteSaisi && (
                <>
                  <LigneReleve libelle="Tiroir compté" valeur={compte} />
                  <LigneReleve libelle="Écart" valeur={ecart} gras />
                </>
              )}
              <p className="mt-4">Signature :</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const LigneReleve: React.FC<{
  libelle: string;
  valeur?: number;
  texte?: string;
  gras?: boolean;
}> = ({ libelle, valeur, texte, gras }) => (
  <div className={`flex justify-between gap-2 ${gras ? "font-bold" : ""}`}>
    <span>{libelle}</span>
    <span>{texte ?? formatCurrency(valeur ?? 0)}</span>
  </div>
);
