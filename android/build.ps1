param(
    [Parameter(Mandatory)][string]$Jdk,
    [Parameter(Mandatory)][string]$BuildTools,
    [Parameter(Mandatory)][string]$AndroidJar,
    [switch]$EssaiBarre
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$out = Join-Path $root ('.android-local/build-' + [guid]::NewGuid())
$classes = Join-Path $out 'classes'
$env:JAVA_HOME = (Resolve-Path $Jdk).Path
$env:PATH = "$env:JAVA_HOME/bin;$env:PATH"
$bt = (Resolve-Path $BuildTools).Path
$platform = (Resolve-Path $AndroidJar).Path
New-Item -ItemType Directory -Path $classes -Force | Out-Null
function Run($tool, [string[]]$arguments) {
    & $tool @arguments
    if ($LASTEXITCODE -ne 0) { throw "Échec de $tool ($LASTEXITCODE)" }
}

$manifest = "$PSScriptRoot/AndroidManifest.xml"
$activity = "$PSScriptRoot/src/TantanaActivity.java"
if ($EssaiBarre) {
    $manifest = "$PSScriptRoot/essai/AndroidManifest.xml"
    $activity = "$PSScriptRoot/essai/EcranTantana.java"
} else {
    $aar = Join-Path $root '.android-local/browser-1.3.0.aar'
    if (!(Test-Path $aar)) {
        Invoke-WebRequest 'https://dl.google.com/dl/android/maven2/androidx/browser/browser/1.3.0/browser-1.3.0.aar' -OutFile $aar
    }
    if ((Get-FileHash $aar).Hash -ne 'E740B1BEEAC82303415D68BEE9D5C1F259716F560A829CA07C7CE97E60850E1B') { throw 'Archive AndroidX incorrecte' }
    # Interfaces Binder officielles du protocole Custom Tabs, sans les composants UI AndroidX.
    Push-Location $out
    try { Run "$Jdk/bin/jar.exe" @('xf',$aar,'classes.jar') } finally { Pop-Location }
    Push-Location $classes
    try { Run "$Jdk/bin/jar.exe" @('xf',"$out/classes.jar",'android/support/customtabs') } finally { Pop-Location }
}
Run "$bt/aapt2.exe" @('compile','--dir',"$PSScriptRoot/res",'-o',"$out/resources.zip")
Run "$bt/aapt2.exe" @('link','-I',$platform,'--manifest',$manifest,'-o',"$out/resources.apk","$out/resources.zip")
Run "$Jdk/bin/javac.exe" @('-encoding','UTF-8','--release','8','-classpath',"$platform;$classes",'-d',$classes,$activity)
Run "$Jdk/bin/jar.exe" @("-J-Djava.io.tmpdir=$out",'cf',"$out/classes.jar",'-C',$classes,'.')
Run "$Jdk/bin/java.exe" @('-cp',"$bt/lib/d8.jar",'com.android.tools.r8.D8','--release','--min-api','26','--lib',$platform,'--output',$out,"$out/classes.jar")
Run "$bt/aapt.exe" @('version')
Push-Location $out
try { Run "$bt/aapt.exe" @('add','resources.apk','classes.dex') } finally { Pop-Location }
$unsigned = Join-Path $root '.android-local/tantana-unsigned.apk'
if ($EssaiBarre) { $unsigned = Join-Path $root '.android-local/tantana-essai-unsigned.apk' }
Run "$bt/zipalign.exe" @('-f','4',"$out/resources.apk",$unsigned)
Write-Output "APK à signer : $unsigned"
