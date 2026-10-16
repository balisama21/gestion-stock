import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Sparkles, Upload } from "lucide-react";
import { Modal } from "../../components/shared/Modal";
import { supabase } from "../../lib/supabase";
import { telechargerCsv } from "../../lib/exportTableur";
import {
  bilanPreparation,
  clesExistantes,
  devinerCorrespondance,
  empreinte,
  LIBELLES_CIBLE,
  preparerLignes,
  preparerLignesNommees,
  SCHEMAS_IMPORT,
  type CibleImport,
  type Correspondance,
  type LigneImport,
  type Tableau,
} from "./lib/importDonnees";
import { enBase64, lireFichier, MIME_IMAGE, type FichierLu } from "./lib/lectureFichiers";
import { executerImport, type RapportImport } from "./lib/executionImport";
import { deciderActionIA, disponibilite, executerIA } from "../ia/clientIA";
import { useEtatIA } from "../ia/useEtatIA";

interface ImportAssistantProps {
  cible: CibleImport;
  storeId: string | null;
  userId: string | null;
  /** Enregistrements déjà présents, pour la détection des doublons. */
  existants: Record<string, string | number | null | undefined>[];
  /** Appelé une fois l'import terminé (rechargement des données). */
  onTermine: () => void;
  /** Libellé du bouton d'ouverture. */
  libelle?: string;
}

type Etape = "fichier" | "colonnes" | "apercu" | "import" | "rapport";

const STATUTS: Record<LigneImport["statut"], { texte: string; classe: string }> = {
  ok: { texte: "À importer", classe: "app-badge app-badge-success" },
  erreur: { texte: "Erreur", classe: "app-badge app-badge-danger" },
  doublon_fichier: { texte: "Doublon (fichier)", classe: "app-badge app-badge-warning" },
  doublon_existant: { texte: "Déjà enregistré", classe: "app-badge app-badge-neutral" },
};

/**
 * Assistant d'import : fichier → colonnes → aperçu → import → rapport.
 *
 * CSV, Excel et tableaux Word sont lus sur le poste, sans IA. PDF, images
 * et documents Word sans tableau passent par l'extraction IA lorsqu'elle
 * est activée ; sinon l'écran le dit, sans bouton factice. Dans les deux
 * cas, rien n'est écrit avant la confirmation explicite de l'aperçu.
 */
export const ImportAssistant: React.FC<ImportAssistantProps> = ({
  cible,
  storeId,
  userId,
  existants,
  onTermine,
  libelle = "Importer",
}) => {
  const [ouvert, setOuvert] = useState(false);
  const [etape, setEtape] = useState<Etape>("fichier");
  const [erreur, setErreur] = useState<string | null>(null);
  const [lecture, setLecture] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [lu, setLu] = useState<FichierLu | null>(null);
  const [feuille, setFeuille] = useState(0);
  const [correspondance, setCorrespondance] = useState<Correspondance>({});
  const [lignes, setLignes] = useState<LigneImport[]>([]);
  const [avertissementsIA, setAvertissementsIA] = useState<string[]>([]);
  const [actionIA, setActionIA] = useState<string | null>(null);
  const [progres, setProgres] = useState({ faites: 0, total: 0 });
  const [rapport, setRapport] = useState<RapportImport | null>(null);
  const annulation = useRef(false);
  const entree = useRef<HTMLInputElement>(null);
  const { etat } = useEtatIA(ouvert ? storeId : null);
  const iaImport = disponibilite(etat, "import_extraction");

  const schema = SCHEMAS_IMPORT[cible];
  const existantes = useMemo(() => clesExistantes(cible, existants), [cible, existants]);
  const tableau: Tableau | null = lu?.feuilles[feuille]?.tableau ?? null;
  const bilan = bilanPreparation(lignes);
  const sansLectureLocale = lu !== null && lu.feuilles.length === 0;

  const reinitialiser = () => {
    setEtape("fichier");
    setErreur(null);
    setFichier(null);
    setLu(null);
    setFeuille(0);
    setCorrespondance({});
    setLignes([]);
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

  const choisirFeuille = (i: number, l: FichierLu) => {
    setFeuille(i);
    const t = l.feuilles[i]?.tableau;
    if (t) setCorrespondance(devinerCorrespondance(t.entetes, cible));
  };

  const charger = async (f: File) => {
    reinitialiser();
    setFichier(f);
    setLecture(true);
    try {
      const resultat = await lireFichier(f);
      setLu(resultat);
      if (resultat.feuilles.length > 0) {
        choisirFeuille(0, resultat);
        setEtape("colonnes");
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Fichier illisible.");
    } finally {
      setLecture(false);
    }
  };

  const extraireParIA = async () => {
    if (!fichier || !storeId || !lu) return;
    setLecture(true);
    setErreur(null);
    try {
      const ext = fichier.name.toLowerCase().split(".").pop() ?? "";
      const res = await executerIA(storeId, {
        fonctionnalite: "import_extraction",
        cible,
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
      setLignes(preparerLignesNommees(res.lignes, cible, existantes));
      setEtape("apercu");
    } finally {
      setLecture(false);
    }
  };

  const verifier = () => {
    if (!tableau) return;
    const manquant = schema.find((c) => c.obligatoire && correspondance[c.cle] == null);
    if (manquant) {
      setErreur(`Choisissez la colonne « ${manquant.libelle} ».`);
      return;
    }
    setErreur(null);
    setLignes(preparerLignes(tableau, correspondance, cible, existantes));
    setEtape("apercu");
  };

  const importer = async () => {
    if (!storeId || !userId || bilan.aImporter === 0) return;
    setEtape("import");
    annulation.current = false;
    if (actionIA) await deciderActionIA(actionIA, "confirmee");
    try {
      const r = await executerImport(cible, lignes, {
        client: supabase,
        storeId,
        userId,
        empreinte: empreinte(lignes),
        onProgres: (faites, total) => setProgres({ faites, total }),
        annule: () => annulation.current,
      });
      setRapport(r);
      if (actionIA) {
        await deciderActionIA(actionIA, r.erreurs.length && !r.crees ? "echec" : "executee", {
          crees: r.crees,
          ignores: r.ignores,
          erreurs: r.erreurs.length,
        });
      }
      onTermine();
    } catch (e) {
      setRapport({
        crees: 0,
        ignores: 0,
        erreurs: [{ numero: 0, message: e instanceof Error ? e.message : "Import interrompu" }],
      });
    }
    setEtape("rapport");
  };

  const telechargerErreurs = () => {
    const parNumero = new Map(rapport?.erreurs.map((e) => [e.numero, e.message]) ?? []);
    const aSignaler = lignes.filter((l) => l.statut !== "ok" || parNumero.has(l.numero));
    telechargerCsv(
      `rapport-import-${cible}`,
      ["Ligne", "Statut", "Détail", ...schema.map((c) => c.libelle)],
      aSignaler.map((l) => [
        l.numero,
        STATUTS[l.statut].texte,
        parNumero.get(l.numero) ?? l.erreurs.join(" ; "),
        ...schema.map((c) => l.valeurs[c.cle] ?? ""),
      ]),
    );
  };

  const pied = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {etape === "colonnes" && (
        <>
          <button type="button" className="app-btn-secondary" onClick={reinitialiser}>
            Autre fichier
          </button>
          <button type="button" className="app-btn-primary" onClick={verifier}>
            Vérifier les lignes
          </button>
        </>
      )}
      {etape === "apercu" && (
        <>
          <button
            type="button"
            className="app-btn-secondary"
            onClick={() => (lu?.feuilles.length ? setEtape("colonnes") : reinitialiser())}
          >
            Retour
          </button>
          <button
            type="button"
            className="app-btn-primary"
            disabled={bilan.aImporter === 0}
            onClick={() => void importer()}
          >
            Importer {bilan.aImporter} ligne{bilan.aImporter > 1 ? "s" : ""}
          </button>
        </>
      )}
      {etape === "import" && (
        <button
          type="button"
          className="app-btn-secondary"
          onClick={() => (annulation.current = true)}
        >
          Arrêter après le lot en cours
        </button>
      )}
      {etape === "rapport" && (
        <>
          {rapport?.erreurs.length ||
          bilan.erreurs ||
          bilan.doublonsFichier ||
          bilan.doublonsExistants ? (
            <button type="button" className="app-btn-secondary" onClick={telechargerErreurs}>
              Télécharger le rapport
            </button>
          ) : null}
          <button type="button" className="app-btn-primary" onClick={fermer}>
            Terminer
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="app-btn-secondary w-full sm:w-auto"
        onClick={() => setOuvert(true)}
        disabled={!storeId}
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
        title={`Importer des ${LIBELLES_CIBLE[cible]}`}
        description="CSV, Excel ou Word. PDF et images avec l'IA, si elle est activée."
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
                  Champs reconnus : {schema.map((c) => c.libelle).join(", ")}
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
                    <button
                      type="button"
                      className="app-btn-primary"
                      disabled={lecture}
                      onClick={() => void extraireParIA()}
                    >
                      <Sparkles className="w-4 h-4" />
                      {lecture ? "Extraction en cours…" : "Extraire les lignes avec l'IA"}
                    </button>
                  ) : (
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {iaImport.raison?.replace(/\.$/, "")}. Convertissez le document en Excel ou
                      CSV pour l'importer dès maintenant.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {etape === "colonnes" && lu && tableau && (
            <div className="space-y-4">
              {lu.feuilles.length > 1 && (
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Feuille
                  </span>
                  <select
                    className="app-field"
                    value={feuille}
                    onChange={(e) => choisirFeuille(Number(e.target.value), lu)}
                  >
                    {lu.feuilles.map((f, i) => (
                      <option key={f.nom} value={i}>
                        {f.nom} ({f.tableau.lignes.length} lignes)
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="text-sm text-muted-foreground">
                {tableau.lignes.length} ligne{tableau.lignes.length > 1 ? "s" : ""} trouvée
                {tableau.lignes.length > 1 ? "s" : ""}. Vérifiez la colonne utilisée pour chaque
                champ.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {schema.map((champ) => (
                  <label key={champ.cle} className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      {champ.libelle}
                      {champ.obligatoire ? " *" : ""}
                    </span>
                    <select
                      className="app-field"
                      value={correspondance[champ.cle] ?? ""}
                      onChange={(e) =>
                        setCorrespondance((c) => ({
                          ...c,
                          [champ.cle]: e.target.value === "" ? null : Number(e.target.value),
                        }))
                      }
                    >
                      <option value="">— Ignorer —</option>
                      {tableau.entetes.map((t, i) => (
                        <option key={i} value={i}>
                          {t}
                          {tableau.lignes[0]?.[i] != null
                            ? ` (ex. ${String(tableau.lignes[0][i]).slice(0, 24)})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          {etape === "apercu" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="app-badge app-badge-success">{bilan.aImporter} à importer</span>
                {bilan.erreurs > 0 && (
                  <span className="app-badge app-badge-danger">{bilan.erreurs} en erreur</span>
                )}
                {bilan.doublonsFichier > 0 && (
                  <span className="app-badge app-badge-warning">
                    {bilan.doublonsFichier} doublon(s) dans le fichier
                  </span>
                )}
                {bilan.doublonsExistants > 0 && (
                  <span className="app-badge app-badge-neutral">
                    {bilan.doublonsExistants} déjà enregistré(s)
                  </span>
                )}
              </div>
              {actionIA !== null || avertissementsIA.length > 0 ? (
                <div className="rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-xs">
                  <p className="font-semibold">
                    Lignes extraites par l'IA : vérifiez-les avant d'importer.
                  </p>
                  {avertissementsIA.map((a, i) => (
                    <p key={i}>• {a}</p>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Les lignes en erreur et les doublons ne seront pas importés.
              </p>
              <div className="max-h-[50vh] overflow-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Ligne</th>
                      <th className="px-2 py-1.5 text-left">Statut</th>
                      {schema.map((c) => (
                        <th key={c.cle} className="px-2 py-1.5 text-left whitespace-nowrap">
                          {c.libelle}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.slice(0, 300).map((l) => (
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
              {lignes.length > 300 && (
                <p className="text-xs text-muted-foreground">
                  Aperçu limité aux 300 premières lignes ; toutes seront traitées.
                </p>
              )}
            </div>
          )}

          {etape === "import" && (
            <div className="space-y-2 py-6 text-center text-sm">
              <p>
                Import en cours… {progres.faites} / {progres.total || bilan.aImporter}
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

          {etape === "rapport" && rapport && (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5 t-success" />
                {rapport.crees} {LIBELLES_CIBLE[cible]} importé{rapport.crees > 1 ? "s" : ""}.
              </p>
              {rapport.ignores > 0 && (
                <p>{rapport.ignores} ligne(s) ignorée(s) : erreurs de saisie ou doublons.</p>
              )}
              {rapport.erreurs.length > 0 && (
                <div className="rounded-xl border border-danger-border bg-danger-soft px-3 py-2 text-xs t-danger">
                  <p className="font-semibold">
                    {rapport.erreurs.length} ligne(s) refusée(s) à l'enregistrement :
                  </p>
                  {rapport.erreurs.slice(0, 20).map((e, i) => (
                    <p key={i}>
                      Ligne {e.numero} : {e.message}
                    </p>
                  ))}
                </div>
              )}
              {cible === "produits" && (
                <p className="text-xs text-muted-foreground">
                  Relancer le même fichier ne recrée pas les produits déjà importés.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
