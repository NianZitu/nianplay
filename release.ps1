# NianPlay release - commit + push + GitHub release with the files the auto-updater needs.
#
# Usage (after `npx vite build` + `npx electron-builder --win --publish never`):
#   powershell -ExecutionPolicy Bypass -File release.ps1
#
# Publishes the same layout as the previous releases:
#   body  = release-notes\<version>.md
#   files = latest.yml, NianPlay-Setup-<v>.exe, NianPlay-Setup-<v>.exe.blockmap, NianPlay-<v>-portable.exe
# (release.bat only uploaded the installer - without latest.yml the in-app updater can't see the version.)
# Everything is checked BEFORE committing/pushing. The token comes from .release-token (git-ignored)
# and is never printed.

# 'Continue' on purpose: in Windows PowerShell 5.1 'Stop' aborts when git writes progress to stderr.
# Every step checks its own result and throws on failure.
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot

$owner = 'NianZitu'
$repo  = 'nianplay'
$curl  = "$env:SystemRoot\System32\curl.exe"

$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$tag     = "v$version"
Write-Host "`n=== NianPlay Release | $tag ===`n"

# -- 1. Pre-flight checks ----------------------------------------------------
$notesFile = "release-notes\$version.md"
$assets = [ordered]@{
  'latest.yml'                            = 'dist-electron\latest.yml'
  "NianPlay-Setup-$version.exe"           = "dist-electron\NianPlay Setup $version.exe"
  "NianPlay-Setup-$version.exe.blockmap"  = "dist-electron\NianPlay Setup $version.exe.blockmap"
  "NianPlay-$version-portable.exe"        = "dist-electron\NianPlay $version.exe"
}
if (-not (Test-Path .release-token)) { throw '.release-token not found' }
if (-not (Test-Path $notesFile))     { throw "Release notes not found: $notesFile" }
foreach ($src in $assets.Values) { if (-not (Test-Path $src)) { throw "Missing build file: $src" } }

$latest = Get-Content 'dist-electron\latest.yml' -Raw
if ($latest -notmatch "(?m)^version:\s*$([regex]::Escape($version))\s*$") { throw "latest.yml is not for $version - rebuild first" }
if ($latest -notmatch "url:\s*NianPlay-Setup-$([regex]::Escape($version))\.exe") { throw 'latest.yml url does not match the installer asset name' }

$token = (Get-Content .release-token -Raw).Trim()
$headers = @{ Authorization = "token $token"; 'User-Agent' = 'nianplay-release'; Accept = 'application/vnd.github+json' }

# Tag must not exist yet
$existing = $null
try { $existing = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repo/releases/tags/$tag" -Headers $headers } catch {}
if ($existing) { throw "Release $tag already exists on GitHub" }
Write-Host '[1/4] Checks OK'

# -- 2. Commit + push ---------------------------------------------------------
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m "Release $version"; if ($LASTEXITCODE -ne 0) { throw 'git commit failed' } }
git push origin main
if ($LASTEXITCODE -ne 0) { throw 'git push failed' }
Write-Host '[2/4] Code pushed'

# -- 3. Create the release ----------------------------------------------------
$body = @{
  tag_name         = $tag
  target_commitish = 'main'
  name             = "NianPlay $version"
  body             = (Get-Content $notesFile -Raw -Encoding UTF8)
  draft            = $false
  prerelease       = $false
} | ConvertTo-Json -Compress
$release = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$owner/$repo/releases" `
  -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
Write-Host "[3/4] Release created (id $($release.id))"

# -- 4. Upload files ----------------------------------------------------------
# Auth header goes through a temp file (curl -H @file) so the token never shows in the process list
$authFile = [IO.Path]::GetTempFileName()
try {
  [IO.File]::WriteAllText($authFile, "Authorization: token $token`n")
  foreach ($name in $assets.Keys) {
    $src = $assets[$name]
    $type = if ($name -like '*.yml') { 'text/yaml' } else { 'application/octet-stream' }
    Write-Host "      uploading $name ..."
    $out = & $curl -sS --fail-with-body -X POST -H "@$authFile" -H "Content-Type: $type" -H 'User-Agent: nianplay-release' `
      --data-binary "@$src" "https://uploads.github.com/repos/$owner/$repo/releases/$($release.id)/assets?name=$name"
    if ($LASTEXITCODE -ne 0) { throw "Upload failed for $name : $out" }
    $asset = $out | ConvertFrom-Json
    Write-Host "      ok: $($asset.browser_download_url) ($([math]::Round($asset.size / 1MB, 1)) MB)"
  }
} finally {
  Remove-Item $authFile -Force -ErrorAction SilentlyContinue
}
Write-Host "[4/4] Done: $($release.html_url)`n"
