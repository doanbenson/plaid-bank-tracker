param(
    [Parameter(Mandatory = $true)]
    [string]$ChecklistPath,
    [switch]$RequirePreCutoverComplete,
    [switch]$RequireRollbackReadinessComplete,
    [switch]$RequireAllComplete
)

if (-not (Test-Path -Path $ChecklistPath)) {
    Write-Error "Checklist file not found: $ChecklistPath"
    exit 1
}

$lines = Get-Content -Path $ChecklistPath
$section = "Unsectioned"
$items = @()

foreach ($line in $lines) {
    if ($line -match "^\s*##\s+(?<name>.+)$") {
        $section = $Matches.name.Trim()
        continue
    }
    if ($line -match "^\s*-\s\[(?<state>[ xX])\]\s(?<text>.+)$") {
        $items += [pscustomobject]@{
            Section = $section
            Complete = ($Matches.state -ne " ")
            Item = $Matches.text.Trim()
        }
    }
}

if ($items.Count -eq 0) {
    Write-Error "No checklist entries found in $ChecklistPath"
    exit 1
}

$grouped = $items | Group-Object Section
foreach ($group in $grouped) {
    $done = ($group.Group | Where-Object { $_.Complete }).Count
    $total = $group.Count
    Write-Host ("[{0}] {1}/{2} complete" -f $group.Name, $done, $total)
}

$overallDone = ($items | Where-Object { $_.Complete }).Count
Write-Host ("[Overall] {0}/{1} complete" -f $overallDone, $items.Count)

function Assert-SectionComplete([string]$SectionName) {
    $sectionItems = $items | Where-Object { $_.Section -eq $SectionName }
    if ($sectionItems.Count -eq 0) {
        Write-Host "Required section missing: $SectionName" -ForegroundColor Red
        return $false
    }
    $incomplete = $sectionItems | Where-Object { -not $_.Complete }
    if ($incomplete.Count -gt 0) {
        Write-Host "Incomplete items in '$SectionName':" -ForegroundColor Red
        foreach ($item in $incomplete) {
            Write-Host (" - {0}" -f $item.Item) -ForegroundColor Red
        }
        return $false
    }
    return $true
}

$ok = $true
if ($RequirePreCutoverComplete) {
    $ok = (Assert-SectionComplete -SectionName "Pre-cutover") -and $ok
}
if ($RequireRollbackReadinessComplete) {
    $ok = (Assert-SectionComplete -SectionName "Rollback readiness") -and $ok
}
if ($RequireAllComplete) {
    $remaining = $items | Where-Object { -not $_.Complete }
    if ($remaining.Count -gt 0) {
        Write-Host "Checklist is not fully complete." -ForegroundColor Red
        $ok = $false
    }
}

if (-not $ok) {
    exit 1
}

Write-Host "Checklist status check passed: $ChecklistPath" -ForegroundColor Green
