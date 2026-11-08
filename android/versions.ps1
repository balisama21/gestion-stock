param([Parameter(Mandatory)][string]$BuildTools)
$ErrorActionPreference = 'Stop'
$directory = Join-Path (Split-Path $PSScriptRoot) 'public/telechargements'
$versions = [ordered]@{}
foreach ($edition in 'tantana', 'tantana-essai') {
    $apk = Join-Path $directory "$edition.apk"
    $info = & "$BuildTools/aapt.exe" dump badging $apk
    if ($LASTEXITCODE -ne 0 -or $info[0] -notmatch "^package: name='([^']+)' versionCode='([0-9]+)' versionName='([^']+)'") {
        throw "Version Android illisible dans $edition.apk"
    }
    $versions[$Matches[1]] = [ordered]@{
        code = [int]$Matches[2]
        version = $Matches[3]
        sha256 = (Get-FileHash $apk -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}
[IO.File]::WriteAllText((Join-Path $directory 'versions.json'), ($versions | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
