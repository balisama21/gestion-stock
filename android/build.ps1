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
$activity = "$PSScriptRoot/src/EcranTantana.java"
if ($EssaiBarre) { $manifest = "$PSScriptRoot/essai/AndroidManifest.xml" }
Run "$bt/aapt2.exe" @('compile','--dir',"$PSScriptRoot/res",'-o',"$out/resources.zip")
Run "$bt/aapt2.exe" @('link','-I',$platform,'--manifest',$manifest,'-o',"$out/resources.apk","$out/resources.zip")
Run "$Jdk/bin/javac.exe" @('-encoding','UTF-8','--release','8','-classpath',"$platform;$classes",'-d',$classes,$activity,"$PSScriptRoot/src/RappelsAndroid.java")
Run "$Jdk/bin/jar.exe" @("-J-Djava.io.tmpdir=$out",'cf',"$out/classes.jar",'-C',$classes,'.')
Run "$Jdk/bin/java.exe" @('-cp',"$bt/lib/d8.jar",'com.android.tools.r8.D8','--release','--min-api','26','--lib',$platform,'--output',$out,"$out/classes.jar")
Run "$bt/aapt.exe" @('version')
Push-Location $out
try { Run "$bt/aapt.exe" @('add','resources.apk','classes.dex') } finally { Pop-Location }
$unsigned = Join-Path $root '.android-local/tantana-unsigned.apk'
if ($EssaiBarre) { $unsigned = Join-Path $root '.android-local/tantana-essai-unsigned.apk' }
Run "$bt/zipalign.exe" @('-f','4',"$out/resources.apk",$unsigned)
Write-Output "APK à signer : $unsigned"
