import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, "src");

const replacements = [
  // Backgrounds
  { regex: /\bbg-slate-950\b/g, replacement: "bg-background" },
  { regex: /\bbg-slate-900\b/g, replacement: "bg-card" },
  { regex: /\bbg-slate-800\b/g, replacement: "bg-muted" },
  { regex: /\bbg-slate-700\b/g, replacement: "bg-accent" },

  // Background opacities
  { regex: /\bbg-slate-900\/90\b/g, replacement: "bg-card\/90" },
  { regex: /\bbg-slate-900\/95\b/g, replacement: "bg-card\/95" },
  { regex: /\bbg-slate-800\/80\b/g, replacement: "bg-muted\/80" },
  { regex: /\bbg-slate-800\/60\b/g, replacement: "bg-muted\/60" },
  { regex: /\bbg-slate-800\/50\b/g, replacement: "bg-muted\/50" },
  { regex: /\bbg-slate-800\/40\b/g, replacement: "bg-muted\/40" },
  { regex: /\bbg-slate-800\/30\b/g, replacement: "bg-muted\/30" },

  // Borders
  { regex: /\bborder-slate-800\b/g, replacement: "border-border" },
  { regex: /\bborder-slate-700\b/g, replacement: "border-muted-foreground\/20" },
  { regex: /\bborder-slate-800\/80\b/g, replacement: "border-border\/80" },
  { regex: /\bborder-slate-800\/60\b/g, replacement: "border-border\/60" },

  // Text
  { regex: /\btext-slate-100\b/g, replacement: "text-foreground" },
  { regex: /\btext-slate-200\b/g, replacement: "text-foreground" },
  { regex: /\btext-slate-300\b/g, replacement: "text-muted-foreground" },
  { regex: /\btext-slate-400\b/g, replacement: "text-muted-foreground" },
  { regex: /\btext-slate-500\b/g, replacement: "text-muted-foreground" },

  // Hover Backgrounds
  { regex: /\bhover:bg-slate-900\b/g, replacement: "hover:bg-card" },
  { regex: /\bhover:bg-slate-800\b/g, replacement: "hover:bg-muted" },
  { regex: /\bhover:bg-slate-800\/50\b/g, replacement: "hover:bg-muted\/50" },
  { regex: /\bhover:bg-slate-800\/30\b/g, replacement: "hover:bg-muted\/30" },
  { regex: /\bhover:bg-slate-700\b/g, replacement: "hover:bg-accent" },

  // Hover Text
  { regex: /\bhover:text-slate-200\b/g, replacement: "hover:text-foreground" },
  { regex: /\bhover:text-white\b/g, replacement: "hover:text-foreground" },

  // Divide
  { regex: /\bdivide-slate-800\b/g, replacement: "divide-border" },
  { regex: /\bdivide-slate-800\/60\b/g, replacement: "divide-border\/60" },
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith(".tsx") || fullPath.endsWith(".ts")) {
      let content = fs.readFileSync(fullPath, "utf8");
      let originalContent = content;

      for (const { regex, replacement } of replacements) {
        content = content.replace(regex, replacement);
      }

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, "utf8");
        console.log(`Updated ${path.relative(__dirname, fullPath)}`);
      }
    }
  }
}

processDirectory(srcDir);
console.log("Done refactoring theme classes!");
