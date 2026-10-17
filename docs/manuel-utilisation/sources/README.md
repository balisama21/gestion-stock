# Sources de la documentation

Ces scripts produisent les documents du dossier parent `docs/manuel-utilisation/` :

| Document | Script |
|---|---|
| `Manuel_utilisation_Tantana_Suite.docx` | `build.js` (contenu dans `c1.js`, `c2.js`, `c3.js` ; tables dans `schema.js`, `descriptions.js`, `ajouts-20261016.js`) |
| `schema-relationnel.md` | `mermaid.js` (mêmes tables) |
| `Modele_import_Tantana_Suite.xlsx`, `Modele_import_Kinvest.xlsx` | `modele.js` |
| `Guide_illustre_Tantana_Suite.pdf`, `Guide_illustre_Kinvest.pdf` | `livre/gen.js` (mise en page `livre.css`, cadrages `dims.json`, captures `img/`) |

Les captures sont dans `livre/img` et `livre-k/img` (Kinvest). Les fichiers communs
aux deux dossiers sont identiques : git ne les stocke qu'une fois.

`rendre.ps1` ne produit pas de document. Il rend des pages d'un PDF en PNG pour les
relire.

## Prérequis

- Node.js (testé avec la version 24) et npm.
- Windows, avec Microsoft Word pour mettre à jour la table des matières et
  Microsoft Edge pour imprimer les guides en PDF.
- Les dépendances `docx` et `exceljs`, installées dans ce dossier seulement.
  Le `package.json` d'ici est séparé de celui de l'application. Il ne touche donc ni
  au build ni aux dépendances de l'application :

```powershell
cd docs\manuel-utilisation\sources
npm install
```

Les commandes ci-dessous se lancent depuis ce dossier, dans PowerShell.

## Manuel Word

```powershell
node build.js ..\Manuel_utilisation_Tantana_Suite.docx
```

Le fichier produit contient une table des matières vide. Pour la remplir, on la met
à jour avec Word (le chemin doit être absolu) :

```powershell
$word = New-Object -ComObject Word.Application
$doc = $word.Documents.Open((Resolve-Path ..\Manuel_utilisation_Tantana_Suite.docx).Path)
foreach ($t in $doc.TablesOfContents) { $t.Update() }
$doc.Save(); $doc.Close(); $word.Quit()
```

## Schéma relationnel

```powershell
node mermaid.js ..\schema-relationnel.md
```

## Modèles d'import Excel

```powershell
node modele.js ..\Modele_import_Tantana_Suite.xlsx
$env:MARQUE = "kinvest"; node modele.js ..\Modele_import_Kinvest.xlsx; Remove-Item Env:MARQUE
```

Le test `src/features/import/modeleExcel.test.ts` vérifie que le modèle livré
passe dans l'assistant d'import : lancez `npm test` à la racine après chaque
changement.

## Guides illustrés PDF

`livre/gen.js` écrit `livre/index.html`. Avec `MARQUE=kinvest`, il écrit
`livre-k/index.html`. Ces pages ne sont pas versionnées.

```powershell
node livre/gen.js
$env:MARQUE = "kinvest"; node livre/gen.js; Remove-Item Env:MARQUE
```

On imprime ensuite chaque page en PDF avec Edge sans interface. Lancez Edge avec
`Start-Process -Wait`. Depuis le bash de Git, Edge rend la main tout de suite et ne
produit rien.

```powershell
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$profil = Join-Path $env:TEMP "edge-guide"
foreach ($p in @(@("livre", "Guide_illustre_Tantana_Suite.pdf"), @("livre-k", "Guide_illustre_Kinvest.pdf"))) {
  $html = "file:///" + ((Resolve-Path "$($p[0])\index.html").Path -replace '\\', '/')
  $pdf = Join-Path (Resolve-Path ..).Path $p[1]
  Start-Process -FilePath $edge -Wait -ArgumentList "--headless=new", "--no-pdf-header-footer", "--virtual-time-budget=10000", "--user-data-dir=$profil", "--print-to-pdf=$pdf", $html
}
```

`--user-data-dir` est une précaution : il donne à cette instance d'Edge un profil à
elle, à l'écart de l'Edge que vous avez peut-être ouvert.

## Contrôler un PDF

```powershell
mkdir $env:TEMP\pages -Force
.\rendre.ps1 -Pdf (Resolve-Path ..\Guide_illustre_Kinvest.pdf).Path -Dir $env:TEMP\pages -Pages "1,2,15" -Largeur 900
```

Les pages sont écrites sous les noms `l1.png`, `l2.png`, etc. Les chemins doivent
être absolus.

## Vérifier une régénération

Pour comparer un document régénéré avec celui qui est commité, comparez leur
contenu. Les octets diffèrent forcément : les PDF ont une date de création, les
fichiers xlsx et docx sont des archives zip horodatées, et Word réenregistre le docx.
Le 17 octobre 2026, une régénération depuis ce dossier a donné ceci :

- docx : même texte, paragraphe par paragraphe, table des matières comprise ;
- xlsx : mêmes feuilles et mêmes valeurs, cellule par cellule ;
- PDF : même taille, même texte (`pdftotext -layout`). Seuls 4 à 8 octets diffèrent :
  ceux des dates de création et de modification ;
- `schema-relationnel.md` : identique.
