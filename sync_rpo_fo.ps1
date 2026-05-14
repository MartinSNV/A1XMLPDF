# =============================================================
# sync_rpo_fo.ps1
# Synchronizácia RPO FO databázy z ekosystem.slovensko.digital
# Spúšťa sa automaticky cez Windows Task Scheduler
# =============================================================

# --- KONFIGURÁCIA ---
$COCKROACH_URL = $env:RPO_DATABASE_URL
$PSQL = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$WORK_DIR = "D:\Projekty\CLAUDE\A1XMLPDF"
$STATE_FILE = "$WORK_DIR\rpo_sync_state.json"
$LOG_FILE = "$WORK_DIR\rpo_sync.log"
$API_BASE = "https://datahub.ekosystem.slovensko.digital/api/data/rpo2/organizations/sync"

# Limit requestov za minútu (max 60, používame 50 pre istotu)
$RATE_LIMIT = 50
$REQUEST_COUNT = 0
$MINUTE_START = Get-Date

# --- FUNKCIE ---

function Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "$ts $msg"
    Write-Host $line
    Add-Content -Path $LOG_FILE -Value $line
}

function LoadState() {
    if (Test-Path $STATE_FILE) {
        $state = Get-Content $STATE_FILE | ConvertFrom-Json
        return $state
    }
    # Prvý beh - syncni posledných 7 dní
    return @{
        last_sync_at = (Get-Date).AddDays(-7).ToString("yyyy-MM-ddTHH:mm:ss.ffffffZ")
    }
}

function SaveState($since) {
    @{ last_sync_at = $since } | ConvertTo-Json | Set-Content $STATE_FILE
}

function RateLimit() {
    $script:REQUEST_COUNT++
    if ($script:REQUEST_COUNT -ge $RATE_LIMIT) {
        $elapsed = (Get-Date) - $script:MINUTE_START
        if ($elapsed.TotalSeconds -lt 60) {
            $wait = 60 - $elapsed.TotalSeconds
            Log "Rate limit: čakám $([math]::Round($wait))s..."
            Start-Sleep -Seconds $wait
        }
        $script:REQUEST_COUNT = 0
        $script:MINUTE_START = Get-Date
    }
}

function IsFyzickaOsoba($org) {
    # Fyzická osoba má legal_form_code začínajúci na 1xx (živnostník)
    $legalForms = $org.data.legalForms
    if (-not $legalForms) { return $false }
    foreach ($lf in $legalForms) {
        $code = $lf.value.code
        if ($code -match "^1\d\d$") { return $true }
    }
    return $false
}

function ExtractIco($org) {
    $identifiers = $org.data.identifiers
    if (-not $identifiers) { return $null }
    foreach ($id in $identifiers) {
        if ($id.value -match "^\d{8}$") { return $id.value }
    }
    return $null
}

function UpsertToCockroach($ico, $legalFormCode, $isFO, $isInactive, $dataJson) {
    # Escapuj JSON pre psql
    $escaped = $dataJson -replace "'", "''"
    
    $sql = @"
INSERT INTO defaultdb.rpo_fo (ico, legal_form_code, is_fyzicka_osoba, is_inactive, data)
VALUES ('$ico', '$legalFormCode', $isFO, $isInactive, '$escaped'::jsonb)
ON CONFLICT ON CONSTRAINT rpo_fo_ico_unique DO UPDATE SET
  legal_form_code = EXCLUDED.legal_form_code,
  is_fyzicka_osoba = EXCLUDED.is_fyzicka_osoba,
  is_inactive = EXCLUDED.is_inactive,
  data = EXCLUDED.data;
"@
    
    $tmpFile = "$WORK_DIR\tmp_upsert.sql"
    $sql | Set-Content $tmpFile -Encoding UTF8
    & $PSQL $COCKROACH_URL -f $tmpFile | Out-Null
    Remove-Item $tmpFile -ErrorAction SilentlyContinue
}

# --- HLAVNÁ LOGIKA ---

Log "=== Začiatok RPO FO synchronizácie ==="

# Načítaj stav poslednej synchronizácie
$state = LoadState
$since = $state.last_sync_at
Log "Synchronizujem od: $since"

# Pridaj UNIQUE constraint na ico ak ešte neexistuje
$constraintSql = "ALTER TABLE defaultdb.rpo_fo ADD CONSTRAINT IF NOT EXISTS rpo_fo_ico_unique UNIQUE (ico);"
& $PSQL $COCKROACH_URL -c $constraintSql 2>$null

$nextUrl = $API_BASE + "?since=" + $since.Replace(":", "%3A").Replace("+", "%2B")	
$totalProcessed = 0
$totalUpserted = 0
$newSince = $since

while ($nextUrl) {
    RateLimit
    
    try {
        $response = Invoke-WebRequest -Uri $nextUrl -UseBasicParsing
        $data = $response.Content | ConvertFrom-Json
    }
    catch {
        Log "CHYBA pri volaní API: $_"
        break
    }
    
    # Získaj URL na ďalšiu stránku z Link hlavičky
    $nextUrl = $null
    $linkHeader = $response.Headers["Link"]
    if ($linkHeader -match '<([^>]+)>;\s*rel=[''"]next[''"]') {
        $nextUrl = $matches[1]
    }
    
    # Spracuj záznamy
    $records = $data
    if ($data.PSObject.Properties["data"]) { $records = $data.data }
    
    foreach ($org in $records) {
        $totalProcessed++
        
        # Aktualizuj since na najnovší updated_at
        if ($org.updated_at -gt $newSince) {
            $newSince = $org.updated_at
        }
        
        # Skontroluj či je FO
        $isFO = IsFyzickaOsoba $org
        if (-not $isFO) { continue }
        
        $ico = ExtractIco $org
        if (-not $ico) { continue }
        
        # Zisti legal_form_code
        $legalFormCode = ""
        if ($org.data.legalForms -and $org.data.legalForms.Count -gt 0) {
            $legalFormCode = $org.data.legalForms[0].value.code
        }
        
        # Zisti či je neaktívny (má termination dátum)
        $isInactive = $false
        if ($org.data.termination) { $isInactive = $true }
        
        # Serializuj celý data objekt
        $dataJson = $org.data | ConvertTo-Json -Depth 20 -Compress
        
        # Upsert do CockroachDB
        UpsertToCockroach $ico $legalFormCode $isFO.ToString().ToLower() $isInactive.ToString().ToLower() $dataJson
        $totalUpserted++
        
        if ($totalUpserted % 100 -eq 0) {
            Log "Spracovaných: $totalProcessed, upsertnutých FO: $totalUpserted"
        }
    }
    
    Log "Stránka spracovaná. Celkom: $totalProcessed záznamov, $totalUpserted FO upsertnutých."
}

# Ulož nový stav
SaveState $newSince
Log "Nový sync timestamp: $newSince"
Log "=== Synchronizácia dokončená. Spracovaných: $totalProcessed, upsertnutých: $totalUpserted ==="
