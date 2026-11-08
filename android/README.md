# Tantana pour Android

L’APK distribué par le site se trouve dans `public/telechargements/tantana.apk`. La version 1.5 affiche le SaaS dans la fenêtre Android validée sur téléphone. Le lien Google officiel revient sur /android/connexion.html. Pour les installations précédemment nommées Tantana Essai, compiler aussi avec -EssaiBarre et signer le résultat sous telechargements/tantana-essai.apk. Cette édition garde son identifiant et son lien de retour historiques.

## Préparer une mise à jour

Augmenter `versionCode` dans `AndroidManifest.xml` et conserver le nom de paquet `com.tantanasuite.app`. Depuis la racine du dépôt, exécuter sous PowerShell avec un JDK 17, les Android Build Tools 35 et la plateforme Android 35.

```powershell
./android/build.ps1 -Jdk $env:JAVA_HOME -BuildTools "$env:ANDROID_HOME/build-tools/35.0.0" -AndroidJar "$env:ANDROID_HOME/platforms/android-35/android.jar"
```

Il produit `.android-local/tantana-unsigned.apk`. Utiliser la clé d’origine pour chaque nouvelle version. Sur le poste de la première compilation, le magasin PKCS12 et son mot de passe protégé par Windows se trouvent dans `%USERPROFILE%\.android\tantana-signing`. Pour une sauvegarde transférable, conserver une copie sécurisée du magasin et sauvegarder son mot de passe dans un gestionnaire de secrets. Le fichier DPAPI dépend du profil Windows qui l’a créé.

```powershell
$signature = Join-Path $env:USERPROFILE '.android/tantana-signing'
$secret = Get-Content "$signature/mot-de-passe.dpapi" | ConvertTo-SecureString
$env:TANTANA_KS_PASS = [Net.NetworkCredential]::new('', $secret).Password
$signer = "$env:ANDROID_HOME/build-tools/35.0.0/apksigner.bat"
try {
    & $signer sign --ks "$signature/tantana.p12" --ks-key-alias tantana --ks-pass env:TANTANA_KS_PASS --v4-signing-enabled false --out public/telechargements/tantana.apk .android-local/tantana-unsigned.apk
    if ($LASTEXITCODE -ne 0) { throw 'Échec de signature' }
    & $signer verify --verbose --print-certs public/telechargements/tantana.apk
    if ($LASTEXITCODE -ne 0) { throw 'Échec de vérification' }
} finally {
    Remove-Item Env:TANTANA_KS_PASS
}
```

L’empreinte SHA-256 du premier certificat est `f91e26b1078cedb881d032ae42ec80c17ba47f7f0828aa86836d5b22cb6f2ee0`. Déployer le site et l’APK ensemble pour activer le téléchargement depuis la bannière Android.

Après la signature des deux APK dans public/telechargements, exécuter
`./android/versions.ps1 -BuildTools .android-local/tools/android-15` puis publier
les deux fichiers et versions.json ensemble. Incrémenter le versionCode de chaque
nouvelle édition. Les applications installées vérifient le catalogue au premier
plan et comparent son empreinte SHA-256 avant de proposer le fichier à Android.
