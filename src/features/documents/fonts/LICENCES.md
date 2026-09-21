# Les polices de ce dossier

Trois familles, toutes trois sous **SIL Open Font License 1.1**, qui
autorise explicitement l'utilisation commerciale, la redistribution et
l'hébergement sur son propre domaine. Aucune n'exige de mention visible
dans l'interface ; cette page tient lieu d'attribution.

| Famille        | Fichier                                                        | Auteur                   | Source                                             |
| -------------- | -------------------------------------------------------------- | ------------------------ | -------------------------------------------------- |
| Onest          | `onest-latin.woff2`, `onest-latin-ext.woff2`                   | Kostiantyn Mishchenko    | <https://fonts.google.com/specimen/Onest>          |
| JetBrains Mono | `jetbrains-mono-latin.woff2`, `jetbrains-mono-latin-ext.woff2` | JetBrains                | <https://fonts.google.com/specimen/JetBrains+Mono> |
| Source Serif 4 | `source-serif-4-latin.woff2`, `source-serif-4-latin-ext.woff2` | Frank Grießhammer, Adobe | <https://fonts.google.com/specimen/Source+Serif+4> |

Le texte complet de la licence est disponible sur
<https://openfontlicense.org>.

## Ce que sont ces fichiers exactement

Les sous-ensembles « latin » et « latin-ext » servis par l'API Google
Fonts v2, récupérés le 21 septembre 2026, **sans modification**. Ce
sont des polices **variables** : un seul fichier porte toute la plage
de graisses, ce qui explique qu'il n'y en ait pas un par poids.

## Pour les remplacer ou les mettre à jour

```bash
curl -A "Mozilla/5.0 Chrome/120.0" \
  "https://fonts.googleapis.com/css2?family=Onest:wght@400&display=swap"
```

La feuille renvoyée contient un bloc `@font-face` par sous-ensemble,
chacun précédé d'un commentaire qui le nomme. Ne garder que `latin` et
`latin-ext`, télécharger les `.woff2` qu'ils désignent, et recopier
les `unicode-range` tels quels dans `polices.css` : ce sont eux qui
évitent au navigateur de télécharger le fichier étendu pour une page
qui n'en a pas besoin.

L'en-tête `User-Agent` n'est pas un détail : sans lui, l'API sert du
`ttf` au lieu du `woff2`, trois fois plus lourd.
