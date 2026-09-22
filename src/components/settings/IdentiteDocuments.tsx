import React from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { SettingsBlock, SettingsRow, SettingsToggle } from "./primitives";
import type { StoreSettings } from "../../types";
import type {
  CompteMobileMoney,
  ContactBoutique,
  IdentifiantLegal,
  IdentiteBoutique,
} from "../../features/documents/lib/identite";

/**
 * PARAMÈTRES → DOCUMENTS → IDENTITÉ DE LA BOUTIQUE
 *
 * Le point commun de tous les documents : ce qui est saisi ici part
 * sur la facture, le devis, le reçu et le bon de commande, sans
 * qu'aucun d'eux n'en garde sa propre copie.
 *
 * ── CE QUE CET ÉCRAN NE DEMANDE PAS ────────────────────────────────
 *
 * Le nom, l'adresse, le téléphone, l'e-mail, le NIF/STAT et le logo
 * sont déjà réglés dans « Ma boutique ». Les redemander ici en ferait
 * deux vérités, et la facture finirait par contredire l'en-tête de
 * l'application. L'écran les rappelle, en lecture seule, pour qu'on
 * voie ce qui s'imprimera déjà sans rien saisir.
 *
 * ── TOUT EST FACULTATIF ────────────────────────────────────────────
 *
 * Une boutique qui ne remplit rien garde exactement les documents
 * d'aujourd'hui. Chaque champ rempli ajoute une ligne ; aucun champ
 * vide ne laisse de trace, ni ligne blanche, ni intitulé orphelin.
 */

interface Props {
  identite: IdentiteBoutique;
  onChange: (identite: IdentiteBoutique) => void;
  settings?: StoreSettings;
}

/** Une clé de liste, unique et stable. Jamais imprimée. */
const nouvelleCle = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `k${Date.now()}${Math.random().toString(16).slice(2)}`;

const remplacer = <T,>(liste: T[], i: number, patch: Partial<T>): T[] =>
  liste.map((x, j) => (i === j ? { ...x, ...patch } : x));

const retirer = <T,>(liste: T[], i: number): T[] => liste.filter((_, j) => j !== i);

/** Monte ou descend une entrée d'un rang. Aux extrémités, rien ne bouge. */
const deplacer = <T,>(liste: T[], i: number, pas: number): T[] => {
  const cible = i + pas;
  if (cible < 0 || cible >= liste.length) return liste;
  const suite = [...liste];
  [suite[i], suite[cible]] = [suite[cible], suite[i]];
  return suite;
};

/**
 * L'ossature d'une ligne répétable : le contenu, et les gestes.
 *
 * Les flèches n'apparaissent que sur les listes dont l'ordre compte —
 * celui des contacts décide de l'ordre d'impression, celui des
 * comptes de paiement aussi.
 */
const LigneRepetable: React.FC<{
  titre: string;
  ordonnable?: boolean;
  premier?: boolean;
  dernier?: boolean;
  onMonter?: () => void;
  onDescendre?: () => void;
  onRetirer: () => void;
  children: React.ReactNode;
}> = ({ titre, ordonnable, premier, dernier, onMonter, onDescendre, onRetirer, children }) => (
  <div className="rounded-xl border border-border bg-card p-3">
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
      <div className="flex shrink-0 flex-col items-center sm:flex-row">
        {ordonnable && (
          <>
            <button
              type="button"
              onClick={onMonter}
              disabled={premier}
              className="app-btn-icon h-9 w-9 disabled:opacity-30"
              aria-label={`Monter ${titre}`}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDescendre}
              disabled={dernier}
              className="app-btn-icon h-9 w-9 disabled:opacity-30"
              aria-label={`Descendre ${titre}`}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onRetirer}
          className="app-btn-icon h-9 w-9"
          aria-label={`Retirer ${titre}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
);

const BoutonAjouter: React.FC<{ libelle: string; onClick: () => void }> = ({
  libelle,
  onClick,
}) => (
  <button type="button" onClick={onClick} className="app-btn-secondary">
    <Plus className="h-4 w-4" />
    {libelle}
  </button>
);

/** Le titre d'un groupe de champs, et la phrase qui dit à quoi il sert. */
const Groupe: React.FC<{ titre: string; note: string; children: React.ReactNode }> = ({
  titre,
  note,
  children,
}) => (
  <SettingsBlock>
    <p className="text-sm font-semibold text-foreground">{titre}</p>
    <p className="mb-3 mt-0.5 text-xs leading-relaxed text-muted-foreground">{note}</p>
    <div className="space-y-2">{children}</div>
  </SettingsBlock>
);

export const IdentiteDocuments: React.FC<Props> = ({ identite, onChange, settings }) => {
  const changer = (patch: Partial<IdentiteBoutique>) => onChange({ ...identite, ...patch });
  const changerReseaux = (patch: Partial<IdentiteBoutique["reseaux"]>) =>
    changer({ reseaux: { ...identite.reseaux, ...patch } });
  const changerPaiement = (patch: Partial<IdentiteBoutique["paiement"]>) =>
    changer({ paiement: { ...identite.paiement, ...patch } });

  const contacts = identite.contacts;
  const comptes = identite.paiement.mobileMoney;
  const identifiants = identite.identifiants;

  const majContacts = (liste: ContactBoutique[]) => changer({ contacts: liste });
  const majComptes = (liste: CompteMobileMoney[]) => changerPaiement({ mobileMoney: liste });
  const majIdentifiants = (liste: IdentifiantLegal[]) => changer({ identifiants: liste });

  /* Ce qui s'imprime déjà, sans rien saisir ici. */
  const deja = [settings?.address, settings?.phone, settings?.email, settings?.nifStat]
    .map((v) => (v ?? "").trim())
    .filter(Boolean);

  return (
    <>
      <SettingsBlock>
        <p className="text-sm font-semibold text-foreground">Déjà repris de « Ma boutique »</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {deja.length > 0
            ? `${settings?.storeName ?? "La boutique"} · ${deja.join(" · ")}`
            : "Rien n'est encore renseigné : complétez « Ma boutique » pour que vos documents portent votre adresse et votre téléphone."}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Le nom, le logo, l&apos;adresse, le téléphone, l&apos;e-mail et le NIF/STAT se règlent
          là-bas, une seule fois. Ce qui suit s&apos;y ajoute.
        </p>
      </SettingsBlock>

      <Groupe
        titre="Contacts à afficher"
        note="Une ligne par personne à joindre. Décochée, elle reste enregistrée mais ne s'imprime pas ; les flèches décident de l'ordre sur le document."
      >
        {contacts.map((c, i) => (
          <LigneRepetable
            key={c.id}
            titre={c.nom || "ce contact"}
            ordonnable
            premier={i === 0}
            dernier={i === contacts.length - 1}
            onMonter={() => majContacts(deplacer(contacts, i, -1))}
            onDescendre={() => majContacts(deplacer(contacts, i, 1))}
            onRetirer={() => majContacts(retirer(contacts, i))}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={c.nom}
                onChange={(e) => majContacts(remplacer(contacts, i, { nom: e.target.value }))}
                className="app-field"
                placeholder="Nom"
                aria-label="Nom du contact"
              />
              <input
                type="text"
                value={c.mention}
                onChange={(e) => majContacts(remplacer(contacts, i, { mention: e.target.value }))}
                className="app-field"
                placeholder="Rôle ou mention"
                aria-label="Rôle ou mention"
              />
              <input
                type="tel"
                value={c.telephone}
                onChange={(e) => majContacts(remplacer(contacts, i, { telephone: e.target.value }))}
                className="app-field"
                placeholder="Téléphone"
                aria-label="Téléphone du contact"
              />
              <input
                type="text"
                value={c.lieu}
                onChange={(e) => majContacts(remplacer(contacts, i, { lieu: e.target.value }))}
                className="app-field"
                placeholder="Lieu (facultatif)"
                aria-label="Lieu du contact"
              />
            </div>
            <SettingsToggle
              checked={c.surDocuments}
              onChange={(v) => majContacts(remplacer(contacts, i, { surDocuments: v }))}
              label="Afficher sur les documents"
            />
          </LigneRepetable>
        ))}
        <BoutonAjouter
          libelle="Ajouter un contact"
          onClick={() =>
            majContacts([
              ...contacts,
              {
                id: nouvelleCle(),
                nom: "",
                mention: "",
                telephone: "",
                lieu: "",
                surDocuments: true,
              },
            ])
          }
        />
      </Groupe>

      <SettingsRow
        label="Site web"
        htmlFor="identite-site"
        hint="Il s'ajoute à l'en-tête, à la suite des contacts."
      >
        <input
          id="identite-site"
          type="text"
          value={identite.siteWeb}
          onChange={(e) => changer({ siteWeb: e.target.value })}
          className="app-field"
          placeholder="maboutique.mg"
        />
      </SettingsRow>

      <SettingsRow label="Facebook" htmlFor="identite-facebook">
        <input
          id="identite-facebook"
          type="text"
          value={identite.reseaux.facebook}
          onChange={(e) => changerReseaux({ facebook: e.target.value })}
          className="app-field"
          placeholder="Laissé vide, rien ne s'affiche"
        />
      </SettingsRow>

      <SettingsRow label="WhatsApp" htmlFor="identite-whatsapp">
        <input
          id="identite-whatsapp"
          type="text"
          value={identite.reseaux.whatsapp}
          onChange={(e) => changerReseaux({ whatsapp: e.target.value })}
          className="app-field"
          placeholder="Laissé vide, rien ne s'affiche"
        />
      </SettingsRow>

      <SettingsRow label="Instagram" htmlFor="identite-instagram">
        <input
          id="identite-instagram"
          type="text"
          value={identite.reseaux.instagram}
          onChange={(e) => changerReseaux({ instagram: e.target.value })}
          className="app-field"
          placeholder="Laissé vide, rien ne s'affiche"
        />
      </SettingsRow>

      <Groupe
        titre="Coordonnées de paiement"
        note="Elles s'impriment en bas des factures, des devis et des bons de commande — pas sur un reçu, qui constate un paiement déjà fait."
      >
        {comptes.map((m, i) => (
          <LigneRepetable
            key={m.id}
            titre={m.operateur || "ce compte"}
            ordonnable
            premier={i === 0}
            dernier={i === comptes.length - 1}
            onMonter={() => majComptes(deplacer(comptes, i, -1))}
            onDescendre={() => majComptes(deplacer(comptes, i, 1))}
            onRetirer={() => majComptes(retirer(comptes, i))}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={m.operateur}
                onChange={(e) => majComptes(remplacer(comptes, i, { operateur: e.target.value }))}
                className="app-field"
                placeholder="Opérateur (MVola, Orange Money…)"
                aria-label="Opérateur"
              />
              <input
                type="tel"
                value={m.numero}
                onChange={(e) => majComptes(remplacer(comptes, i, { numero: e.target.value }))}
                className="app-field"
                placeholder="Numéro"
                aria-label="Numéro du compte"
              />
            </div>
          </LigneRepetable>
        ))}
        <BoutonAjouter
          libelle="Ajouter un compte mobile"
          onClick={() => majComptes([...comptes, { id: nouvelleCle(), operateur: "", numero: "" }])}
        />
      </Groupe>

      <SettingsRow label="Banque" htmlFor="identite-banque">
        <input
          id="identite-banque"
          type="text"
          value={identite.paiement.banque}
          onChange={(e) => changerPaiement({ banque: e.target.value })}
          className="app-field"
          placeholder="BNI, BOA, BFV…"
        />
      </SettingsRow>

      <SettingsRow
        label="RIB ou numéro de compte"
        htmlFor="identite-rib"
        hint="Il s'imprime à la suite du nom de la banque."
        stacked
      >
        <input
          id="identite-rib"
          type="text"
          value={identite.paiement.rib}
          onChange={(e) => changerPaiement({ rib: e.target.value })}
          className="app-field"
        />
      </SettingsRow>

      <Groupe
        titre="Autres identifiants légaux"
        note="Le NIF et le STAT viennent de « Ma boutique ». Ici s'ajoutent les numéros propres à votre métier : RCS, licence, agrément."
      >
        {identifiants.map((x, i) => (
          <LigneRepetable
            key={x.id}
            titre={x.libelle || "cet identifiant"}
            onRetirer={() => majIdentifiants(retirer(identifiants, i))}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={x.libelle}
                onChange={(e) =>
                  majIdentifiants(remplacer(identifiants, i, { libelle: e.target.value }))
                }
                className="app-field"
                placeholder="Libellé (RCS, Licence…)"
                aria-label="Libellé de l'identifiant"
              />
              <input
                type="text"
                value={x.valeur}
                onChange={(e) =>
                  majIdentifiants(remplacer(identifiants, i, { valeur: e.target.value }))
                }
                className="app-field"
                placeholder="Numéro"
                aria-label="Valeur de l'identifiant"
              />
            </div>
          </LigneRepetable>
        ))}
        <BoutonAjouter
          libelle="Ajouter un identifiant"
          onClick={() =>
            majIdentifiants([...identifiants, { id: nouvelleCle(), libelle: "", valeur: "" }])
          }
        />
      </Groupe>
    </>
  );
};
