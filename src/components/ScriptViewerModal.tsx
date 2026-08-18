import React, { useState } from "react";
import { CODE_APPS_SCRIPT_V3 } from "../data/appsScriptCode";
import { FileCode2, Copy, Download, Check, X, ShieldCheck, Sparkles } from "lucide-react";

interface ScriptViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScriptViewerModal: React.FC<ScriptViewerModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(CODE_APPS_SCRIPT_V3);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const blob = new Blob([CODE_APPS_SCRIPT_V3], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Code_Apps_Script_v3.gs";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-4xl p-6 shadow-2xl text-foreground my-8 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileCode2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                Google Apps Script Refactorisé (Code_Apps_Script_v3.gs)
              </h3>
              <p className="text-xs text-muted-foreground">
                Code complet et optimisé résolvant les 5 demandes (Compatibilité France ;, Prix
                Vente Saisi Libre, Vendeurs, Dépenses Trésorerie & Variantes kapa₁₀₀₀)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Installation Instructions */}
        <div className="bg-muted/80 border border-emerald-500/30 p-4 rounded-xl space-y-2 text-xs">
          <div className="font-bold text-emerald-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Guide d'installation rapide dans Google Sheets :
          </div>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-1">
            <li>
              Ouvrez votre fichier Google Sheets <strong>"balsama auto gestion"</strong>.
            </li>
            <li>
              Allez dans le menu supérieur : <strong>Extensions &gt; Apps Script</strong>.
            </li>
            <li>
              Supprimez l'ancien code présent, puis collez le code ci-dessous (bouton{" "}
              <strong>Copier</strong>).
            </li>
            <li>
              Cliquez sur l'icône de disquette <strong>Enregistrer</strong> (Ctrl+S) et fermez
              l'onglet Apps Script.
            </li>
            <li>
              Rechargez votre feuille Google Sheets : le nouveau menu personnalisé{" "}
              <strong>📦 Stock &amp; Gestion</strong> apparaîtra !
            </li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">
            Fichier : Code_Apps_Script_v3.gs
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-muted hover:bg-accent text-foreground rounded-xl text-xs font-semibold border border-muted-foreground/20 transition-colors"
            >
              <Download className="w-4 h-4 text-sky-400" />
              Télécharger .gs
            </button>

            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                copied
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md"
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copié dans le presse-papier !" : "Copier le Code Complet"}
            </button>
          </div>
        </div>

        {/* Code Box */}
        <div className="relative">
          <pre className="bg-background p-4 rounded-xl border border-border overflow-x-auto text-xs font-mono text-emerald-300/90 h-[380px] leading-relaxed">
            {CODE_APPS_SCRIPT_V3}
          </pre>
        </div>
      </div>
    </div>
  );
};
