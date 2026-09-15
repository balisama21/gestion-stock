import React from "react";
import { createFileRoute } from "@tanstack/react-router";

/**
 * PAGE DE DIAGNOSTIC TEMPORAIRE — a retirer une fois la barre d'etat
 * reglee.
 *
 * Elle ne lit aucune donnee de la boutique et n'ecrit rien. Elle
 * rapporte seulement ce que le telephone dit de lui-meme : de combien
 * il ecarte le contenu des barres du systeme, dans quel mode
 * d'affichage il execute l'application, et quelle couleur de barre il a
 * retenue. Ces trois reponses decident du correctif, et aucune ne peut
 * se deviner depuis un ordinateur.
 */
function Diagnostic() {
  const [mesures, setMesures] = React.useState<[string, string][]>([]);

  React.useEffect(() => {
    const sonde = document.createElement("div");
    sonde.style.cssText =
      "position:fixed;top:0;left:0;" +
      "padding-top:env(safe-area-inset-top,0px);" +
      "padding-bottom:env(safe-area-inset-bottom,0px);" +
      "padding-left:env(safe-area-inset-left,0px);" +
      "padding-right:env(safe-area-inset-right,0px);" +
      "visibility:hidden;pointer-events:none;";
    document.body.appendChild(sonde);
    const s = getComputedStyle(sonde);
    const modes = ["fullscreen", "standalone", "minimal-ui", "browser"];
    const mode = modes.find((m) => window.matchMedia(`(display-mode: ${m})`).matches) ?? "inconnu";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

    setMesures([
      ["Encoche en haut", s.paddingTop],
      ["Encoche en bas", s.paddingBottom],
      ["Encoche à gauche / droite", `${s.paddingLeft} / ${s.paddingRight}`],
      ["Mode d'affichage", mode],
      ["Couleur de barre posée", meta?.content ?? "(aucune)"],
      ["Thème sombre actif", document.documentElement.classList.contains("dark") ? "oui" : "non"],
      ["Écran", `${window.innerWidth} × ${window.innerHeight}`],
      ["Écran physique", `${window.screen.width} × ${window.screen.height}`],
      ["Navigateur", navigator.userAgent],
    ]);
    sonde.remove();
  }, []);

  return (
    <div style={{ background: "#ffffff", minHeight: "100dvh" }}>
      {/* Bande temoin : si elle se voit DERRIERE l'heure et la batterie,
          la page peint bien sous la barre d'etat. Si elle commence en
          dessous, c'est le systeme qui reserve la place. */}
      <div
        style={{
          height: "env(safe-area-inset-top, 0px)",
          background: "#00794c",
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
        }}
      />
      <div style={{ padding: "1rem", paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }}>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.75rem" }}>
          Diagnostic d’affichage
        </h1>
        <p style={{ fontSize: "0.8rem", color: "#555", marginBottom: "1rem" }}>
          Ouvrez cette page <strong>depuis l’icône installée</strong>, puis envoyez une capture.
        </p>
        <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
          <tbody>
            {mesures.map(([nom, valeur]) => (
              <tr key={nom} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "0.4rem 0.5rem 0.4rem 0", color: "#555" }}>{nom}</td>
                <td
                  style={{
                    padding: "0.4rem 0",
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                    fontWeight: 600,
                  }}
                >
                  {valeur}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/diagnostic-affichage")({ component: Diagnostic });
