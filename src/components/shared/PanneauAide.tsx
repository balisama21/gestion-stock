import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { HelpCircle, X } from "lucide-react";
import { ficheAide, LANGUES_AIDE, type LangueAide } from "../../lib/aide";

const CLE_LANGUE = "tantana.aide.langue";

function lireLangue(): LangueAide {
  try {
    const v = localStorage.getItem(CLE_LANGUE);
    return v === "mg" ? "mg" : "fr";
  } catch {
    return "fr";
  }
}

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  /** L'écran affiché : l'aide suit la page. */
  ecran: string;
}

export const PanneauAide: React.FC<Props> = ({ ouvert, onFermer, ecran }) => {
  const [langue, setLangue] = React.useState<LangueAide>(lireLangue);
  const fiche = ficheAide(ecran, langue);
  const langues = LANGUES_AIDE.filter((l) => l.disponible);

  const changerLangue = (l: LangueAide) => {
    setLangue(l);
    try {
      localStorage.setItem(CLE_LANGUE, l);
    } catch {
      /* navigation privée */
    }
  };

  return (
    <Dialog.Root open={ouvert} onOpenChange={(o) => !o && onFermer()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card sm:max-w-md data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
          aria-describedby="aide-resume"
        >
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex min-w-0 gap-3">
              <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Aide
                </p>
                <Dialog.Title className="text-base font-semibold text-foreground">
                  {fiche.titre}
                </Dialog.Title>
              </div>
            </div>
            <Dialog.Close className="app-btn-icon" aria-label="Fermer l'aide">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <p id="aide-resume" className="text-sm leading-relaxed text-foreground">
              {fiche.resume}
            </p>

            {fiche.etapes && fiche.etapes.length > 0 && (
              <section>
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Comment faire
                </h3>
                <ol className="space-y-3">
                  {fiche.etapes.map((e) => (
                    <li key={e.titre} className="border-l-2 border-primary/40 pl-3">
                      <p className="text-sm font-medium text-foreground">{e.titre}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{e.texte}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {fiche.questions && fiche.questions.length > 0 && (
              <section>
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Questions fréquentes
                </h3>
                <div className="divide-y divide-border rounded-xl border border-border">
                  {fiche.questions.map((q) => (
                    <details key={q.q} className="group px-3 py-2.5">
                      <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:hidden">
                        {q.q}
                      </summary>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{q.r}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </div>

          {langues.length > 1 && (
            <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              {langues.map((l) => (
                <button
                  key={l.cle}
                  type="button"
                  aria-pressed={langue === l.cle}
                  onClick={() => changerLangue(l.cle)}
                  className={`app-chip ${langue === l.cle ? "app-chip-active" : ""}`}
                >
                  {l.libelle}
                </button>
              ))}
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
