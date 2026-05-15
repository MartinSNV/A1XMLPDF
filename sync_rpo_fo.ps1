# =============================================================
# sync_rpo_fo.ps1
# Synchronizácia RPO FO databázy z ekosystem.slovensko.digital
# Optimalizované: batch upserty (100 záznamov naraz)
# =============================================================

# --- KONFIGURÁCIA ---
$COCKROACH_URL = $env:RPO_DATABASE_URL
$env:PGPASSWORD = "4MqOGjEp-W8cIFhp782_nw"
$PSQL = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$WORK_DIR = "D:\Projekty\CLAUDE\A1XMLPDF"
$STATE_FILE = "$WORK_DIR\rpo_sync_state.json"
$LOG_FILE = "$WORK_DIR\rpo_sync.log"
$API_BASE = "https://datahub.ekosystem.slovensko.digital/api/data/rpo2/organizations/sync"
$BATCH_SIZE = 500
$RATE_LIMIT = 50

$REQUEST_COUNT = 0
$MINUTE_START = Get-Date

function Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "$ts $msg"
    Write-Host $line
    Add-Content -Path $LOG_FILE -Value $line
}

function LoadState() {
    if (Test-Path $STATE_FILE) {
        return Get-Content $STATE_FILE | ConvertFrom-Json
    }
    return @{ last_sync_at = (Get-Date).AddDays(-7).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.ffffffZ") }
}

function SaveState($since) {
    @{ last_sync_at = $since } | ConvertTo-Json | Set-Content $STATE_FILE
}

function RateLimit() {
    $script:REQUEST_COUNT++
    if ($script:REQUEST_COUNT -ge $RATE_LIMIT) {
        $elapsed = ((Get-Date) - $script:MINUTE_START).TotalSeconds
        if ($elapsed -lt 60) {
            $wait = [math]::Ceiling(60 - $elapsed)
            Log "Rate limit: cakam ${wait}s..."
            Start-Sleep -Seconds $wait
        }
        $script:REQUEST_COUNT = 0
        $script:MINUTE_START = Get-Date
    }
}

function IsFyzickaOsoba($org) {
    $legalForms = $org.data.legalForms
    if (-not $legalForms) { return $false }
    foreach ($lf in $legalForms) {
        $code = $lf.value.code
        if ($code -match "^1\d\d$") { return $true }
    }
    return $false
}

function ExtractIco($org) {
    foreach ($id in $org.data.identifiers) {
        if ($id.value -match "^\d{8}$") { return $id.value }
    }
    return $null
}

function BatchUpsert($batch) {
    if ($batch.Count -eq 0) { return }

    $values = @()
    foreach ($item in $batch) {
        $ico = $item.ico
        $lfc = $item.lfc -replace "'", "''"
        $isFo = $item.isFo
        $isInactive = $item.isInactive
        $dataEscaped = $item.dataJson -replace "'", "''"
        $values += "('$ico', '$lfc', $isFo, $isInactive, '$dataEscaped'::jsonb)"
    }

    $sql = @"
INSERT INTO defaultdb.rpo_fo (ico, legal_form_code, is_fyzicka_osoba, is_inactive, data)
VALUES $($values -join ', ')
ON CONFLICT ON CONSTRAINT rpo_fo_ico_unique DO UPDATE SET
  legal_form_code = EXCLUDED.legal_form_code,
  is_fyzicka_osoba = EXCLUDED.is_fyzicka_osoba,
  is_inactive = EXCLUDED.is_inactive,
  data = EXCLUDED.data;
"@

    $tmpFile = "$env:TEMP\rpo_batch_$([System.Guid]::NewGuid().ToString('N')).sql"
    [System.IO.File]::WriteAllText($tmpFile, $sql, [System.Text.Encoding]::UTF8)

    try {
        & $PSQL $COCKROACH_URL -f $tmpFile 2>&1 | Out-Null
    } finally {
        Remove-Item $tmpFile -ErrorAction SilentlyContinue
    }
}

# --- HLAVNÁ LOGIKA ---
Log "=== Zaciatok RPO FO synchronizacie ==="

$state = LoadState
$since = $state.last_sync_at
Log "Synchronizujem od: $since"

$sinceEncoded = [Uri]::EscapeDataString($since)
$nextUrl = "${API_BASE}?since=${sinceEncoded}"

$totalProcessed = 0
$totalUpserted = 0
$newSince = $since
$batch = [System.Collections.Generic.List[object]]::new()

while ($nextUrl) {
    RateLimit

    try {
        $response = Invoke-WebRequest -Uri $nextUrl -UseBasicParsing
        $records = $response.Content | ConvertFrom-Json
    } catch {
        Log "CHYBA API: $_"
        break
    }

    # Ďalšia stránka z Link hlavičky
    $nextUrl = $null
    $linkHeader = $response.Headers["Link"]
    if ($linkHeader -match '<([^>]+)>;\s*rel=[''"]next[''"]') {
        $nextUrl = $matches[1]
    }

    if ($records.PSObject.Properties["data"]) { $records = $records.data }

    foreach ($org in $records) {
        $totalProcessed++

        if ($org.updated_at -gt $newSince) { $newSince = $org.updated_at }

        if (-not (IsFyzickaOsoba $org)) { continue }

        $ico = ExtractIco $org
        if (-not $ico) { continue }

        $lfc = ""
        if ($org.data.legalForms -and $org.data.legalForms.Count -gt 0) {
            $lfc = $org.data.legalForms[0].value.code
        }

        $isInactive = if ($org.data.termination) { "true" } else { "false" }
        $dataJson = $org.data | ConvertTo-Json -Depth 20 -Compress

        $batch.Add(@{
            ico = $ico
            lfc = $lfc
            isFo = "true"
            isInactive = $isInactive
            dataJson = $dataJson
        })

        if ($batch.Count -ge $BATCH_SIZE) {
            BatchUpsert $batch
            $totalUpserted += $batch.Count
            Log "Spracovanych: $totalProcessed, upsertnutych FO: $totalUpserted"
            $batch.Clear()
        }
    }

    Log "Stranka hotova. Celkom: $totalProcessed, FO: $totalUpserted"
}

# Posledný batch
if ($batch.Count -gt 0) {
    BatchUpsert $batch
    $totalUpserted += $batch.Count
    Log "Posledny batch: $($batch.Count) zaznamov"
}

SaveState $newSince
Log "Novy sync timestamp: $newSince"
Log "=== Hotovo. Spracovanych: $totalProcessed, upsertnutych: $totalUpserted ==="
