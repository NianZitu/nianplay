# NianPlay release - commit + push + GitHub release with the files the auto-updater needs.
#
# Usage (after `npx vite build` + `npx electron-builder --win --publish never`):
#   powershell -ExecutionPolicy Bypass -File release.ps1
#
# Requires the GitHub CLI logged in once: `gh auth login --web` (no token files needed).
#
# Publishes the same layout as the previous releases:
#   body  = release-notes\<version>.md
#   files = latest.yml, NianPlay-Setup-<v>.exe, NianPlay-Setup-<v>.exe.blockmap, NianPlay-<v>-portable.exe
# (release.bat only uploaded the installer - without latest.yml the in-app updater can't see the version.)
# Everything is checked BEFORE committing/pushing, and every step stops the script on failure.
# Keep this file ASCII-only: Windows PowerShell 5.1 reads BOM-less files as ANSI.

# 'Continue' on purpose: in Windows PowerShell 5.1 'Stop' aborts when git writes progress to stderr.
# Each step checks its own exit code and calls Fail.
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
function Fail($msg) { Write-Host "ERROR: $msg"; exit 1 }

$repo    = 'NianZitu/nianplay'
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$tag     = "v$version"
Write-Host "`n=== NianPlay Release | $tag ===`n"

# -- 1. Pre-flight checks ------------------------------------------------------
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Fail 'GitHub CLI (gh) not installed: winget install GitHub.cli' }
gh auth status --hostname github.com *> $null
if ($LASTEXITCODE -ne 0) { Fail 'gh is not logged in: run  gh auth login --web' }

$notesFile = "release-notes\$version.md"
$assets = [ordered]@{
  'latest.yml'                           = 'dist-electron\latest.yml'
  "NianPlay-Setup-$version.exe"          = "dist-electron\NianPlay Setup $version.exe"
  "NianPlay-Setup-$version.exe.blockmap" = "dist-electron\NianPlay Setup $version.exe.blockmap"
  "NianPlay-$version-portable.exe"       = "dist-electron\NianPlay $version.exe"
}
if (-not (Test-Path $notesFile)) { Fail "Release notes not found: $notesFile" }
foreach ($src in $assets.Values) { if (-not (Test-Path $src)) { Fail "Missing build file: $src" } }

$latest = Get-Content 'dist-electron\latest.yml' -Raw
if ($latest -notmatch "(?m)^version:\s*$([regex]::Escape($version))\s*$") { Fail "latest.yml is not for $version - rebuild first" }
if ($latest -notmatch "url:\s*NianPlay-Setup-$([regex]::Escape($version))\.exe") { Fail 'latest.yml url does not match the installer asset name' }

gh release view $tag --repo $repo *> $null
if ($LASTEXITCODE -eq 0) { Fail "Release $tag already exists on GitHub" }
Write-Host '[1/4] Checks OK'

# -- 2. Commit + push ----------------------------------------------------------
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m "Release $version"; if ($LASTEXITCODE -ne 0) { Fail 'git commit failed' } }
git push origin main
if ($LASTEXITCODE -ne 0) { Fail 'git push failed' }
Write-Host '[2/4] Code pushed'

# -- 3. Stage the files under their GitHub names (gh uses the file name) -------
$stage = Join-Path ([IO.Path]::GetTempPath()) "nianplay-release-$version"
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $stage | Out-Null
$files = @()
foreach ($name in $assets.Keys) {
  $dest = Join-Path $stage $name
  Copy-Item $assets[$name] $dest
  $files += $dest
}
Write-Host '[3/4] Files staged'

# -- 4. Create the release with all files (gh uploads and fails as a whole) ----
gh release create $tag @files --repo $repo --target main --title "NianPlay $version" --notes-file $notesFile
if ($LASTEXITCODE -ne 0) { Fail 'gh release create failed - check the release page; a partial draft may need deleting' }
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue

# Verify what GitHub has
$check = gh release view $tag --repo $repo --json assets,url | ConvertFrom-Json
foreach ($name in $assets.Keys) {
  $a = $check.assets | Where-Object { $_.name -eq $name }
  if (-not $a) { Fail "Asset missing on GitHub: $name" }
  Write-Host ("      ok: {0} ({1} MB)" -f $name, [math]::Round($a.size / 1MB, 1))
}
Write-Host "[4/4] Done: $($check.url)`n"
