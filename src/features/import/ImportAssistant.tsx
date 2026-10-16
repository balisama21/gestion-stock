import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileUp,
  History,
  Sparkles,
  Upload,
} from "lucide-react";
import { Modal } from "../../components/shared/Modal";
import { supabase } from "../../lib/supabase";
import { telechargerCsv } from "../../lib/exportTableur";
import {
  bilanPreparation,
  clesExistantes,
  detecterNature,
  devinerCorrespondance,
  empreinte,
  LIBELLES_CIBLE,
  MODULES_CIBLE,
  preparerLignes,
  preparerLignesNommees,
  SCHEMAS_IMPORT,
  type CibleImport,
  type Correspondance,
  type Detection,
  type LigneImport,
  type NatureDonnees,
  type Tableau,
} from "./lib/importDonnees";
import { enBase64, lireFichier, MIME_IMAGE, type FichierLu } from "./lib/lectureFichiers";
import {
  cleProduit,
  cloreJournal,
  executerImport,
  listerImports,
  OPTIONS_PAR_DEFAUT,
  ouvrirJournal,
  type Existants,
  type ImportJournalise,
  type LotImport,
  type OptionsImport,
  type RapportImport,
} from "./lib/executionImport";
import { deciderActionIA, disponibilite, executerIA } from "../ia/clientIA";
import { useEtatIA } from "../ia/useEtatIA";

export interface ExistantsImport extends Existants {
  clients: {
    id: string;
    nom: string;
    prenom?: string | null;
    email?: string | null;
    telephone?: string | null;
  }[];
  achats: { date: string; designation: string; quantite: number; prix_achat: number }[];
}

interface ImportAssistantProps {
  storeId: string | null;
  userId: string | null;
  /** Ce que l'utilisateur a le droit de créer (permissions du membre). */
  ciblesAutorisees: CibleImport[];
  /** L'écran d'où l'on importe : proposé en premier quand il faut choisir. */
  cibleDeLaPage: CibleImport;
  existants: ExistantsImport;
  /** Appelé après l'import : recharge les données des modules touchés. */
  onTermine: (modules: CibleImport[]) => void;
  /** Ouvre un module depuis le bilan. */
  onOuvrirModule?: (onglet: string) => void;
  libelle?: string;
}

type Etape = "fichier" | "analyse" | "apercu" | "import" | "rapport";
type Choix = CibleImport | "ignorer" | null;

interface Feuille {
  source: string;
  tableau: Tableau | null;
  /** Lignes déjà nommées par champ (extraction IA). */
  lignesIA?: Record<string, string | number | null>[];
  detection: Detection;
  choix: Choix;
  correspondance: Correspondance;
}

const LIBELLE_NATURE: Record<NatureDonnees, string> = {
  produits: "Produits",
  clients: "Clients",
  fournisseurs: "Fournisseurs",
  achats: "Achats",
  ventes: "Ventes",
};

const STATUTS: Record<LigneImport["statut"], { texte: string; classe: string }> = {
  ok: { texte: "Nouveau", classe: "app-badge app-badge-success" },
  erreur: { texte: "Rejeté", classe: "app-badge app-badge-danger" },
  doublon_fichier: { texte: "Doublon (fichier)", classe: "app-badge app-badge-warning" },
  doublon_existant: { texte: "Existe déjà", classe: "app-badge app-badge-neutral" },
};

const STATUTS_JOURNAL: Record<string, string> = {
  en_cours: "en cours ou interrompu",
  termine: "terminé",
  partiel: "terminé avec des rejets",
  echec: "échec",
  interrompu: "arrêté",
};

/**
 * Assistant d'import : un fichier → les bons modules.
 *
 *   1. Fichier : CSV, Excel (toutes les feuilles), tableaux Word lus sur le
 *      poste ; PDF et images par l'IA quand elle est activée.
 *   2. Analyse : chaque tableau reçoit une destination détectée (produits,
 *      clients, fournisseurs, achats) et ses colonnes sont rapprochées des
 *      champs. Au moindre doute, l'écran demande au lieu de deviner ; des
 *      ventes passées sont reconnues et refusées.
 *   3. Aperçu : nouveaux, existants, doublons, rejets — et ce qu'on fait des
 *      existants (ignorer ou mettre à jour), avec confirmation explicite de
 *      ce qui touche au stock ou à la trésorerie.
 *   4. Import réel par les fonctions métier, puis bilan par module, gardé
 *      dans l'historique des imports.
 */
export const ImportAssistant: React.FC<ImportAssistantProps> = ({
  storeId,
  userId,
  ciblesAutorisees,
  cibleDeLaPage,
  existants,
  onTermine,
  onOuvrirModule,
  libelle = "Importer",
}) => {
  const [ouvert, setOuvert] = useState(false);
  const [etape, setEtape] = useState<Etape>("fichier");
  const [erreur, setErreur] = useState<string | null>(null);
  const [lecture, setLecture] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [lu, setLu] = useState<FichierLu | null>(null);
  const [feuilles, setFeuilles] = useState<Feuille[]>([]);
  const [lots, setLots] = useState<LotImport[]>([]);
  const [achatsConfirmes, setAchatsConfirmes] = useState(false);
  const [cibleIA, setCibleIA] = useState<CibleImport | "">("");
  const [avertissementsIA, setAvertissementsIA] = useState<string[]>([]);
  const [actionIA, setActionIA] = useState<string | null>(null);
  const [progres, setProgres] = useState({ faites: 0, total: 0 });
  const [rapport, setRapport] = useState<RapportImport | null>(null);
  const [journal, setJournal] = useState<ImportJournalise[]>([]);
  const [journalOuvert, setJournalOuvert] = useState<string | null>(null);
  const annulation = useRef(false);
  const entree = useRef<HTMLInputElement>(null);
  const { etat } = useEtatIA(ouvert ? storeId : null);
  const iaImport = disponibilite(etat, "import_extraction");

  // Choix proposés : la page d'abord, puis le reste de ce qui est permis.
  const choixPossibles = useMemo(
    () => [
      ...ciblesAutorisees.filter((c) => c === cibleDeLaPage),
      ...ciblesAutorisees.filter((c) => c !== cibleDeLaPage),
    ],
    [ciblesAutorisees, cibleDeLaPage],
  );

  const cles = useMemo(
    () => ({
      produits: clesExistantes(
        "produits",
        existants.produits.map((p) => ({
          id: p.id,
          designation: p.designation,
          variante: p.variante,
        })),
      ),
      clients: clesExistantes("clients", existants.clients),
      fournisseurs: clesExistantes("fournisseurs", existants.fournisseurs),
      achats: clesExistantes("achats", existants.achats),
    }),
    [existants],
  );

  useEffect(() => {
    if (ouvert && storeId && etape === "fichier")
      void listerImports(supabase, storeId).then(setJournal);
  }, [ouvert, storeId, etape]);

  const reinitialiser = () => {
    setEtape("fichier");
    setErreur(null);
    setFichier(null);
    setLu(null);
    setFeuilles([]);
    setLots([]);
    setAchatsConfirmes(false);
    setCibleIA("");
    setAvertissementsIA([]);
    setActionIA(null);
    setRapport(null);
    setProgres({ faites: 0, total: 0 });
  };

  const fermer = () => {
    if (etape === "import") return;
    // Une extraction IA abandonnée avant l'import est journalisée comme rejetée.
    if (actionIA && !rapport) void deciderActionIA(actionIA, "rejetee");
    setOuvert(false);
    reinitialiser();
  };

  /** Choix initial : la détection si elle est sûre et permise, sinon rien. */
  const choixInitial = (d: Detection): Choix => {
    if (d.nature === "ventes") return "ignorer";
    if (d.nature && ciblesAutorisees.includes(d.nature)) return d.nature;
    return null;
  };

  const charger = async (f: File) => {
    reinitialiser();
    setFichier(f);
    setLecture(true);
    try {
      const resultat = await lireFichier(f);
      setLu(resultat);
      const lisibles = resultat.feuilles.filter(
        (x) => x.tableau.entetes.length > 0 && x.tableau.lignes.length > 0,
      );
      if (lisibles.length > 0) {
        setFeuilles(
          lisibles.map((x) => {
            const detection = detecterNature(x.tableau.entetes, [x.nom, f.name]);
            const choix = choixInitial(detection);
            return {
              source: x.nom,
              tableau: x.tableau,
              detection,
              choix,
              correspondance:
                choix && choix !== "ignorer" ? devinerCorrespondance(x.tableau.entetes, choix) : {},
            };
          }),
        );
        setEtape("analyse");
      } else if (resultat.feuilles.length > 0) {
        setErreur("Le fichier ne contient aucune ligne de données.");
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Fichier illisible.");
    } finally {
      setLecture(false);
    }
  };

  const changerChoix = (i: number, choix: Choix) =>
    setFeuilles((fs) =>
      fs.map((f, j) =>
        j !== i
          ? f
          : {
              ...f,
              choix,
              correspondance:
                choix && choix !== "ignorer" && f.tableau
                  ? devinerCorrespondance(f.tableau.entetes, choix)
                  : {},
            },
      ),
    );

  const changerColonne = (i: number, champ: string, col: number | null) =>
    setFeuilles((fs) =>
      fs.map((f, j) =>
        j !== i ? f : { ...f, correspondance: { ...f.correspondance, [champ]: col } },
      ),
    );

  const extraireParIA = async () => {
    if (!fichier || !storeId || !lu || !cibleIA) return;
    setLecture(true);
    setErreur(null);
    try {
      const ext = fichier.name.toLowerCase().split(".").pop() ?? "";
      const res = await executerIA(storeId, {
        fonctionnalite: "import_extraction",
        cible: cibleIA,
        ...(lu.nature === "word"
          ? { texte: lu.texte ?? "" }
          : {
              fichier: {
                mime: lu.nature === "pdf" ? "application/pdf" : (MIME_IMAGE[ext] ?? fichier.type),
                base64: await enBase64(fichier),
                nom: fichier.name,
              },
            }),
      });
      if (!res.ok) {
        setErreur(res.message);
        return;
      }
      if (res.fonctionnalite !== "import_extraction") return;
      setActionIA(res.action_id);
      setAvertissementsIA(res.avertissements);
      const feuille: Feuille = {
        source: fichier.name,
        tableau: null,
        lignesIA: res.lignes,
        detection: {
          nature: cibleIA,
          ambigu: false,
          candidats: [],
          raison: "Type choisi avant l'extraction.",
        },
        choix: cibleIA,
        correspondance: {},
      };
      setFeuilles([feuille]);
      preparer([feuille]);
    } finally {
      setLecture(false);
    }
  };

  /** Problème bloquant d'une feuille, ou null. */
  const blocage = (f: Feuille): string | null => {
    if (f.choix === null) return "Choisissez la destination de ce tableau.";
    if (f.choix === "ignorer" || !f.tableau) return null;
    const manquant = SCHEMAS_IMPORT[f.choix].find(
      (c) => c.obligatoire && f.correspondance[c.cle] == null,
    );
    return manquant ? `Choisissez la colonne « ${manquant.libelle} ».` : null;
  };

  const preparer = (source: Feuille[] = feuilles) => {
    const bloquee = source.find((f) => blocage(f));
    if (bloquee) {
      setErreur(`${bloquee.source} : ${blocage(bloquee)}`);
      return;
    }
    const retenues = source.filter(
      (f): f is Feuille & { choix: CibleImport } => !!f.choix && f.choix !== "ignorer",
    );
    if (retenues.length === 0) {
      setErreur("Aucun tableau à importer.");
      return;
    }
    setErreur(null);
    setLots(
      retenues.map((f) => ({
        cible: f.choix,
        source: f.source,
        lignes: f.tableau
          ? preparerLignes(f.tableau, f.correspondance, f.choix, cles[f.choix])
          : preparerLignesNommees(f.lignesIA ?? [], f.choix, cles[f.choix]),
        options: { ...OPTIONS_PAR_DEFAUT },
      })),
    );
    setAchatsConfirmes(false);
    setEtape("apercu");
  };

  const changerOptions = (i: number, o: Partial<OptionsImport>) =>
    setLots((ls) => ls.map((l, j) => (j === i ? { ...l, options: { ...l.options, ...o } } : l)));

  const aImporter = (lot: LotImport) =>
    lot.lignes.filter(
      (l) =>
        l.statut === "ok" ||
        (l.statut === "doublon_existant" &&
          lot.options.doublons === "mettre_a_jour" &&
          lot.cible !== "achats"),
    ).length;
  const totalAImporter = lots.reduce((t, l) => t + aImporter(l), 0);
  const contientAchats = lots.some((l) => l.cible === "achats" && aImporter(l) > 0);

  const importer = async () => {
    if (!storeId || !userId || totalAImporter === 0) return;
    if (contientAchats && !achatsConfirmes) return;
    setEtape("import");
    annulation.current = false;
    if (actionIA) await deciderActionIA(actionIA, "confirmee");
    const nomFichier = fichier?.name ?? "import";
    const journalId = await ouvrirJournal(
      supabase,
      storeId,
      userId,
      nomFichier,
      actionIA ? "ia" : "fichier",
    );
    let r: RapportImport;
    try {
      r = await executerImport(lots, {
        client: supabase,
        storeId,
        userId,
        empreinte: empreinte(lots.flatMap((l) => l.lignes)),
        nomFichier,
        existants,
        onProgres: (faites, total) => setProgres({ faites, total }),
        annule: () => annulation.current,
      });
    } catch (e) {
      r = {
        bilans: [],
        erreurs: [
          {
            module: lots[0].cible,
            source: nomFichier,
            ligne: 0,
            message: e instanceof Error ? e.message : "Import interrompu",
          },
        ],
        interrompu: true,
      };
    }
    if (journalId) await cloreJournal(supabase, journalId, r);
    if (actionIA) {
      const faits = r.bilans.reduce((t, b) => t + b.ajoutes + b.mis_a_jour, 0);
      await deciderActionIA(actionIA, faits === 0 ? "echec" : "executee", {
        bilan: r.bilans,
        rejets: r.erreurs.length,
      });
    }
    setRapport(r);
    onTermine([...new Set([...lots.map((l) => l.cible), ...r.bilans.map((b) => b.module)])]);
    setEtape("rapport");
  };

  const telechargerRapport = () => {
    if (!rapport) return;
    telechargerCsv(
      `rapport-import-${new Date().toISOString().slice(0, 10)}`,
      ["Module", "Tableau", "Ligne", "Détail"],
      rapport.erreurs.map((e) => [
        MODULES_CIBLE[e.module].libelle,
        e.source,
        e.ligne || "",
        e.message,
      ]),
    );
  };

  const pied = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {etape === "analyse" && (
        <>
          <button type="button" className="app-btn-secondary" onClick={reinitialiser}>
            Autre fichier
          </button>
          <button type="button" className="app-btn-primary" onClick={() => preparer()}>
            Vérifier les lignes
          </button>
        </>
      )}
      {etape === "apercu" && (
        <>
          <button
            type="button"
            className="app-btn-secondary"
            onClick={() =>
              feuilles.some((f) => f.tableau) ? setEtape("analyse") : reinitialiser()
            }
          >
            Retour
          </button>
          <button
            type="button"
            className="app-btn-primary"
            disabled={totalAImporter === 0 || (contientAchats && !achatsConfirmes)}
            onClick={() => void importer()}
          >
            Confirmer l'import ({totalAImporter} ligne{totalAImporter > 1 ? "s" : ""})
          </button>
        </>
      )}
      {etape === "import" && (
        <button
          type="button"
          className="app-btn-secondary"
          onClick={() => (annulation.current = true)}
        >
          Arrêter après la ligne en cours
        </button>
      )}
      {etape === "rapport" && (
        <>
          {rapport && rapport.erreurs.length > 0 && (
            <button type="button" className="app-btn-secondary" onClick={telechargerRapport}>
              Télécharger les rejets
            </button>
          )}
          <button type="button" className="app-btn-primary" onClick={fermer}>
            Terminer
          </button>
        </>
      )}
    </div>
  );

  const sansLectureLocale = lu !== null && lu.feuilles.length === 0;

  return (
    <>
      <button
        type="button"
        className="app-btn-secondary w-full sm:w-auto"
        onClick={() => setOuvert(true)}
        disabled={!storeId || ciblesAutorisees.length === 0}
      >
        <Upload className="w-4 h-4" />
        {libelle}
      </button>

      <Modal
        open={ouvert}
        onClose={fermer}
        dismissible={etape !== "import"}
        size="3xl"
        icon={<FileUp className="w-5 h-5" />}
        title="Importer des données"
        description="Le contenu est reconnu et enregistré dans les bons modules, après votre confirmation."
        footer={etape === "fichier" ? undefined : pied}
      >
        <div className="space-y-4">
          {erreur && (
            <p
              role="alert"
              className="rounded-xl border border-danger-border bg-danger-soft px-3 py-2 text-sm t-danger"
            >
              {erreur}
            </p>
          )}

          {/* ── 1. Fichier ── */}
          {etape === "fichier" && (
            <div className="space-y-4">
              <input
                ref={entree}
                type="file"
                className="hidden"
                accept=".csv,.txt,.tsv,.xlsx,.xls,.ods,.docx,.pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void charger(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => entree.current?.click()}
                disabled={lecture}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-10 text-sm text-muted-foreground hover:bg-muted"
              >
                <Upload className="h-6 w-6" />
                {lecture ? "Lecture du fichier…" : "Choisir un fichier"}
                <span className="text-xs">
                  Excel, CSV ou Word. Destinations possibles :{" "}
                  {choixPossibles.map((c) => MODULES_CIBLE[c].libelle).join(", ")}.
                </span>
              </button>

              {sansLectureLocale && fichier && (
                <div className="app-card space-y-3 p-4">
                  <p className="text-sm">
                    <strong>{fichier.name}</strong> :{" "}
                    {lu?.nature === "word"
                      ? "ce document ne contient aucun tableau lisible directement."
                      : "ce format ne peut pas être lu sans IA."}
                  </p>
                  {iaImport.disponible ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="block flex-1 text-sm">
                        <span className="mb-1 block text-xs font-medium text-muted-foreground">
                          Que contient ce document ?
                        </span>
                        <select
                          className="app-field"
                          value={cibleIA}
                          onChange={(e) => setCibleIA(e.target.value as CibleImport | "")}
                        >
                          <option value="">— Choisir —</option>
                          {choixPossibles.map((c) => (
                            <option key={c} value={c}>
                              {MODULES_CIBLE[c].libelle}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="app-btn-primary"
                        disabled={lecture || !cibleIA}
                        onClick={() => void extraireParIA()}
                      >
                        <Sparkles className="w-4 h-4" />
                        {lecture ? "Extraction en cours…" : "Extraire avec l'IA"}
                      </button>
                    </div>
                  ) : (
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {iaImport.raison?.replace(/\.$/, "")}. Convertissez le document en Excel ou
                      CSV pour l'importer dès maintenant.
                    </p>
                  )}
                </div>
              )}

              {journal.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <History className="h-3.5 w-3.5" /> Imports récents
                  </p>
                  <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                    {journal.map((j) => (
                      <li key={j.id} className="px-3 py-2">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 text-left"
                          onClick={() => setJournalOuvert(journalOuvert === j.id ? null : j.id)}
                        >
                          <span className="truncate">
                            {new Date(j.cree_le).toLocaleString("fr-FR")} — {j.nom_fichier}
                          </span>
                          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                            {STATUTS_JOURNAL[j.statut] ?? j.statut}
                            <ChevronDown className="h-3.5 w-3.5" />
                          </span>
                        </button>
                        {journalOuvert === j.id && (
                          <div className="mt-2 space-y-1 text-xs">
                            {j.bilan.map((b) => (
                              <p key={b.module}>
                                {MODULES_CIBLE[b.module]?.libelle ?? b.module} : {b.ajoutes}{" "}
                                ajouté(s), {b.mis_a_jour} mis à jour, {b.ignores} ignoré(s),{" "}
                                {b.rejetes} rejeté(s)
                              </p>
                            ))}
                            {j.erreurs.slice(0, 10).map((e, i) => (
                              <p key={i} className="t-danger">
                                {e.source} ligne {e.ligne} : {e.message}
                              </p>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── 2. Analyse : destination et colonnes de chaque tableau ── */}
          {etape === "analyse" && (
            <div className="space-y-4">
              {feuilles.map((f, i) => {
                const nature = f.detection.nature;
                const nonPermis =
                  nature && nature !== "ventes" && !ciblesAutorisees.includes(nature);
                const probleme = blocage(f);
                return (
                  <section key={f.source + i} className="app-card space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">
                        {f.source}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({f.tableau?.lignes.length ?? 0} lignes, {f.tableau?.entetes.length ?? 0}{" "}
                          colonnes)
                        </span>
                      </h3>
                      {nature === "ventes" ? (
                        <span className="app-badge app-badge-warning">Ventes détectées</span>
                      ) : nature ? (
                        <span className="app-badge app-badge-success">
                          Détecté : {LIBELLE_NATURE[nature]}
                        </span>
                      ) : (
                        <span className="app-badge app-badge-warning">À préciser</span>
                      )}
                    </div>

                    {nature === "ventes" && (
                      <p className="text-xs text-muted-foreground">
                        Ce tableau ressemble à des ventes passées. Elles ne sont pas importées : les
                        enregistrer ferait sortir du stock et entrer de l'argent aujourd'hui pour
                        des opérations anciennes.
                      </p>
                    )}
                    {!nature && <p className="text-xs t-warning">{f.detection.raison}</p>}
                    {nonPermis && (
                      <p className="text-xs t-warning">
                        Vous n'avez pas le droit d'ajouter des{" "}
                        {LIBELLES_CIBLE[nature as CibleImport]}.
                      </p>
                    )}

                    <label className="block text-sm">
                      <span className="mb-1 block text-xs font-medium text-muted-foreground">
                        Destination
                      </span>
                      <select
                        className="app-field"
                        value={f.choix ?? ""}
                        onChange={(e) =>
                          changerChoix(i, e.target.value === "" ? null : (e.target.value as Choix))
                        }
                      >
                        <option value="">— Choisir —</option>
                        {choixPossibles.map((c) => (
                          <option key={c} value={c}>
                            {MODULES_CIBLE[c].libelle}
                          </option>
                        ))}
                        <option value="ignorer">Ne pas importer ce tableau</option>
                      </select>
                    </label>

                    {f.choix && f.choix !== "ignorer" && f.tableau && (
                      <details open={!!probleme || f.detection.ambigu || !nature}>
                        <summary className="cursor-pointer text-xs font-medium">
                          Colonnes reconnues (
                          {
                            SCHEMAS_IMPORT[f.choix].filter((c) => f.correspondance[c.cle] != null)
                              .length
                          }
                          /{SCHEMAS_IMPORT[f.choix].length})
                        </summary>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {SCHEMAS_IMPORT[f.choix].map((champ) => (
                            <label key={champ.cle} className="block text-sm">
                              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                                {champ.libelle}
                                {champ.obligatoire ? " *" : ""}
                              </span>
                              <select
                                className="app-field"
                                value={f.correspondance[champ.cle] ?? ""}
                                onChange={(e) =>
                                  changerColonne(
                                    i,
                                    champ.cle,
                                    e.target.value === "" ? null : Number(e.target.value),
                                  )
                                }
                              >
                                <option value="">— Ignorer —</option>
                                {f.tableau!.entetes.map((t, c) => (
                                  <option key={c} value={c}>
                                    {t}
                                    {f.tableau!.lignes[0]?.[c] != null
                                      ? ` (ex. ${String(f.tableau!.lignes[0][c]).slice(0, 24)})`
                                      : ""}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                      </details>
                    )}
                    {probleme && <p className="text-xs t-danger">{probleme}</p>}
                  </section>
                );
              })}
            </div>
          )}

          {/* ── 3. Aperçu et options ── */}
          {etape === "apercu" && (
            <div className="space-y-4">
              {avertissementsIA.length > 0 || actionIA ? (
                <div className="rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-xs">
                  <p className="font-semibold">
                    Lignes extraites par l'IA : vérifiez-les avant d'importer.
                  </p>
                  {avertissementsIA.map((a, i) => (
                    <p key={i}>• {a}</p>
                  ))}
                </div>
              ) : null}

              {lots.map((lot, i) => {
                const b = bilanPreparation(lot.lignes);
                const schema = SCHEMAS_IMPORT[lot.cible];
                const colonneStock =
                  lot.cible === "produits" &&
                  lot.lignes.some((l) => l.valeurs.stock_initial !== null);
                const citeFournisseurs =
                  (lot.cible === "produits" || lot.cible === "achats") &&
                  lot.lignes.some((l) => l.valeurs.fournisseur);
                const nouveauxProduits =
                  lot.cible === "achats"
                    ? new Set(
                        lot.lignes
                          .filter((l) => l.statut === "ok")
                          .map((l) => cleProduit(l.valeurs.designation, l.valeurs.variante))
                          .filter(
                            (k) =>
                              !existants.produits.some(
                                (p) => cleProduit(p.designation, p.variante) === k,
                              ),
                          ),
                      ).size
                    : 0;
                return (
                  <section key={lot.source + i} className="app-card space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">
                        {lot.source} <ArrowRight className="inline h-4 w-4" />{" "}
                        {MODULES_CIBLE[lot.cible].libelle}
                      </h3>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <span className="app-badge app-badge-success">
                          {b.aImporter} nouveau(x)
                        </span>
                        {b.doublonsExistants > 0 && (
                          <span className="app-badge app-badge-neutral">
                            {b.doublonsExistants} existant(s)
                          </span>
                        )}
                        {b.doublonsFichier > 0 && (
                          <span className="app-badge app-badge-warning">
                            {b.doublonsFichier} doublon(s)
                          </span>
                        )}
                        {b.erreurs > 0 && (
                          <span className="app-badge app-badge-danger">{b.erreurs} rejeté(s)</span>
                        )}
                      </div>
                    </div>

                    {b.doublonsExistants > 0 && lot.cible !== "achats" && (
                      <fieldset className="space-y-1 text-sm">
                        <legend className="text-xs font-medium text-muted-foreground">
                          Lignes qui existent déjà dans {MODULES_CIBLE[lot.cible].libelle}
                        </legend>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={lot.options.doublons === "ignorer"}
                            onChange={() => changerOptions(i, { doublons: "ignorer" })}
                          />
                          Les ignorer
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={lot.options.doublons === "mettre_a_jour"}
                            onChange={() => changerOptions(i, { doublons: "mettre_a_jour" })}
                          />
                          Les mettre à jour avec les valeurs du fichier (une case vide ne change
                          rien)
                        </label>
                      </fieldset>
                    )}
                    {b.doublonsExistants > 0 && lot.cible === "achats" && (
                      <p className="text-xs text-muted-foreground">
                        {b.doublonsExistants} achat(s) identique(s) déjà enregistré(s) seront
                        ignorés.
                      </p>
                    )}

                    {colonneStock &&
                      lot.options.doublons === "mettre_a_jour" &&
                      b.doublonsExistants > 0 && (
                        <label className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={lot.options.alignerStock}
                            onChange={(e) => changerOptions(i, { alignerStock: e.target.checked })}
                          />
                          <span>
                            Aligner le stock des produits existants sur les quantités du fichier
                            <span className="block text-xs text-muted-foreground">
                              Un ajustement d'inventaire est enregistré pour chaque écart, comme à
                              l'écran.
                            </span>
                          </span>
                        </label>
                      )}
                    {citeFournisseurs && (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={lot.options.creerFournisseurs}
                          onChange={(e) =>
                            changerOptions(i, { creerFournisseurs: e.target.checked })
                          }
                        />
                        Créer aussi les fournisseurs cités qui n'existent pas encore
                      </label>
                    )}
                    {lot.cible === "produits" && b.aImporter > 0 && colonneStock && (
                      <p className="text-xs text-muted-foreground">
                        La quantité devient le stock initial de chaque nouveau produit (mouvement de
                        stock « stock initial »).
                      </p>
                    )}
                    {lot.cible === "achats" && b.aImporter > 0 && (
                      <p className="rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-xs">
                        Chaque achat ajoute sa quantité au stock
                        {nouveauxProduits > 0
                          ? ` (${nouveauxProduits} produit(s) seront créés)`
                          : ""}{" "}
                        et, sans « montant payé », est enregistré comme réglé comptant : la
                        trésorerie diminue d'autant.
                      </p>
                    )}

                    <div className="max-h-[40vh] overflow-auto rounded-xl border border-border">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted">
                          <tr>
                            <th className="px-2 py-1.5 text-left">Ligne</th>
                            <th className="px-2 py-1.5 text-left">Statut</th>
                            {schema.map((c) => (
                              <th key={c.cle} className="whitespace-nowrap px-2 py-1.5 text-left">
                                {c.libelle}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {lot.lignes.slice(0, 200).map((l) => (
                            <tr key={l.numero} className="border-t border-border align-top">
                              <td className="px-2 py-1.5">{l.numero}</td>
                              <td className="px-2 py-1.5">
                                <span className={STATUTS[l.statut].classe}>
                                  {STATUTS[l.statut].texte}
                                </span>
                                {l.erreurs.length > 0 && (
                                  <div className="mt-1 t-danger">{l.erreurs.join(" ; ")}</div>
                                )}
                              </td>
                              {schema.map((c) => (
                                <td key={c.cle} className="px-2 py-1.5">
                                  {l.valeurs[c.cle] ?? ""}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {lot.lignes.length > 200 && (
                      <p className="text-xs text-muted-foreground">
                        Aperçu limité aux 200 premières lignes ; toutes seront traitées.
                      </p>
                    )}
                  </section>
                );
              })}

              {contientAchats && (
                <label className="flex items-start gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={achatsConfirmes}
                    onChange={(e) => setAchatsConfirmes(e.target.checked)}
                  />
                  Je confirme que ces achats ont réellement eu lieu et peuvent modifier le stock et
                  la trésorerie.
                </label>
              )}
            </div>
          )}

          {/* ── 4. Import ── */}
          {etape === "import" && (
            <div className="space-y-2 py-6 text-center text-sm">
              <p>
                Enregistrement en cours… {progres.faites} / {progres.total || totalAImporter}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${progres.total ? Math.round((progres.faites / progres.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* ── 5. Bilan ── */}
          {etape === "rapport" && rapport && (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                {rapport.interrompu ? (
                  <AlertTriangle className="h-5 w-5 t-warning" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 t-success" />
                )}
                {rapport.interrompu ? "Import arrêté avant la fin." : "Import terminé."}
              </p>
              <div className="overflow-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left">Module</th>
                      <th className="px-3 py-2 text-right">Ajoutés</th>
                      <th className="px-3 py-2 text-right">Mis à jour</th>
                      <th className="px-3 py-2 text-right">Ignorés</th>
                      <th className="px-3 py-2 text-right">Rejetés</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rapport.bilans.map((b) => (
                      <tr key={b.module} className="border-t border-border">
                        <td className="px-3 py-2">{MODULES_CIBLE[b.module].libelle}</td>
                        <td className="px-3 py-2 text-right">{b.ajoutes}</td>
                        <td className="px-3 py-2 text-right">{b.mis_a_jour}</td>
                        <td className="px-3 py-2 text-right">{b.ignores}</td>
                        <td className="px-3 py-2 text-right">{b.rejetes}</td>
                        <td className="px-3 py-2 text-right">
                          {onOuvrirModule && b.ajoutes + b.mis_a_jour > 0 && (
                            <button
                              type="button"
                              className="text-xs font-semibold t-success underline"
                              onClick={() => {
                                fermer();
                                onOuvrirModule(MODULES_CIBLE[b.module].onglet);
                              }}
                            >
                              Ouvrir
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rapport.erreurs.length > 0 && (
                <div className="rounded-xl border border-danger-border bg-danger-soft px-3 py-2 text-xs t-danger">
                  {rapport.erreurs.slice(0, 15).map((e, i) => (
                    <p key={i}>
                      {e.source}
                      {e.ligne ? ` ligne ${e.ligne}` : ""} : {e.message}
                    </p>
                  ))}
                  {rapport.erreurs.length > 15 && (
                    <p>… et {rapport.erreurs.length - 15} autre(s).</p>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Ce bilan est conservé dans les imports récents. Relancer le même fichier ne recrée
                pas ce qui a déjà été importé.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
