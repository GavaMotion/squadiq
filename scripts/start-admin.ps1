# SquadIQ Admin — self-healing launcher
# Opens the localhost admin dashboard. If it's already running, just opens the
# browser. If it's down, frees a stuck port, ensures dependencies, starts the
# server, waits for it to bind, then opens the browser.
# Run via the Desktop shortcut, or: powershell -ExecutionPolicy Bypass -File start-admin.ps1

$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms

$Port   = 8787
$Url    = "http://localhost:$Port/"
$AppDir = Split-Path -Parent $PSScriptRoot   # scripts\ -> app root
Set-Location $AppDir

function Test-Admin {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        return ($r.StatusCode -eq 200)
    } catch { return $false }
}

# Is the running server the code that's on disk? It serves admin.html from
# disk every request, so the page can be newer than the process behind it --
# which shows up as a route 404 on a button that plainly exists.
function Test-Current {
    try {
        $src = Get-Item (Join-Path $AppDir 'scripts\admin-server.mjs')
        $disk = [Math]::Floor(([DateTimeOffset]$src.LastWriteTimeUtc).ToUnixTimeMilliseconds())
        $r = Invoke-WebRequest -Uri "$Url`api/version" -UseBasicParsing -TimeoutSec 3
        $running = [Math]::Floor(($r.Content | ConvertFrom-Json).mtime)
        return ([Math]::Abs($running - $disk) -lt 1000)
    } catch { return $false }   # no /api/version at all => definitely old
}

# 1) Already healthy AND running the current code -> just open it.
if (Test-Admin) {
    if (Test-Current) {
        Start-Process $Url
        exit 0
    }
    Write-Host 'Admin server is running older code - restarting it...'
    $stale = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($l in $stale) { Stop-Process -Id $l.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500
}

# 2) Port occupied but not answering (stuck/crashed server) -> free it.
$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
foreach ($l in $listeners) {
    Stop-Process -Id $l.OwningProcess -Force -ErrorAction SilentlyContinue
}
if ($listeners) { Start-Sleep -Milliseconds 500 }

# 3) First-run safety: make sure dependencies + config exist.
if (-not (Test-Path (Join-Path $AppDir 'node_modules'))) {
    Write-Host 'Installing dependencies (first run, one-time)...'
    cmd /c 'npm install'
}
if (-not (Test-Path (Join-Path $AppDir '.env'))) {
    [System.Windows.Forms.MessageBox]::Show(
        "Can't start SquadIQ Admin: .env is missing.`n`nIt needs VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        'SquadIQ Admin') | Out-Null
    exit 1
}

# 4) Start the admin server in its own minimized window (stays running).
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','title SquadIQ Admin Server && npm run admin' `
    -WorkingDirectory $AppDir -WindowStyle Minimized

# 5) Wait for it to bind (up to ~20s), then open the browser.
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 700
    if (Test-Admin) {
        Start-Process $Url
        exit 0
    }
}

# 6) Didn't come up in time — surface the server window so the user can see why.
[System.Windows.Forms.MessageBox]::Show(
    "SquadIQ Admin didn't respond on $Url within 20s.`n`nCheck the 'SquadIQ Admin Server' window for the error (usually a bad/expired SUPABASE_SERVICE_ROLE_KEY).",
    'SquadIQ Admin') | Out-Null
exit 1
