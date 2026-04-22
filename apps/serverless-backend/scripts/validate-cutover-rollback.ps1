param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath,
    [switch]$AllowPlaceholders
)

if (-not (Test-Path -Path $ConfigPath)) {
    Write-Error "Config file not found: $ConfigPath"
    exit 1
}

try {
    $json = Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json
} catch {
    Write-Error "Invalid JSON in $ConfigPath"
    exit 1
}

function Get-JsonValue([object]$Object, [string]$Path) {
    $current = $Object
    foreach ($segment in $Path.Split(".")) {
        if ($null -eq $current) { return $null }
        $prop = $current.PSObject.Properties[$segment]
        if ($null -eq $prop) { return $null }
        $current = $prop.Value
    }
    return $current
}

function Is-Placeholder([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return $true }
    return $Value -match "PLACEHOLDER|YYYY-MM-DD|ACCOUNT_ID|STATE_MACHINE_NAME|team-or-user|on-call-team"
}

function Get-IntValue([object]$Value) {
    $parsed = 0L
    if ([long]::TryParse([string]$Value, [ref]$parsed)) {
        return $parsed
    }
    return $null
}

function Get-DoubleValue([object]$Value) {
    $parsed = 0.0
    if ([double]::TryParse([string]$Value, [ref]$parsed)) {
        return $parsed
    }
    return $null
}

$failed = $false

$startIso = [string](Get-JsonValue -Object $json -Path "changeWindow.startIso")
$endIso = [string](Get-JsonValue -Object $json -Path "changeWindow.endIso")
if (-not ($AllowPlaceholders -and (Is-Placeholder $startIso -or Is-Placeholder $endIso))) {
    $start = $null
    $end = $null
    $startOk = [datetimeoffset]::TryParse($startIso, [ref]$start)
    $endOk = [datetimeoffset]::TryParse($endIso, [ref]$end)
    if (-not $startOk -or -not $endOk) {
        Write-Host "changeWindow.startIso/endIso must be valid ISO timestamps." -ForegroundColor Red
        $failed = $true
    } elseif ($end -le $start) {
        Write-Host "changeWindow.endIso must be after changeWindow.startIso." -ForegroundColor Red
        $failed = $true
    }
}

$canary = Get-JsonValue -Object $json -Path "routing.canaryPercentages"
if ($null -eq $canary -or $canary.Count -eq 0) {
    Write-Host "routing.canaryPercentages must contain at least one step." -ForegroundColor Red
    $failed = $true
} else {
    $prev = -1
    foreach ($step in $canary) {
        $parsedStep = Get-IntValue -Value $step
        if ($null -eq $parsedStep) {
            Write-Host "routing.canaryPercentages must contain integer values only." -ForegroundColor Red
            $failed = $true
            break
        }
        if ($parsedStep -lt 1 -or $parsedStep -gt 100) {
            Write-Host "routing.canaryPercentages values must be in range 1..100." -ForegroundColor Red
            $failed = $true
        }
        if ($parsedStep -le $prev) {
            Write-Host "routing.canaryPercentages must be strictly increasing." -ForegroundColor Red
            $failed = $true
        }
        $prev = $parsedStep
    }
    $finalCanary = Get-IntValue -Value $canary[-1]
    if ($null -eq $finalCanary -or $finalCanary -ne 100) {
        Write-Host "routing.canaryPercentages must end at 100." -ForegroundColor Red
        $failed = $true
    }
}

$holdMinutes = Get-JsonValue -Object $json -Path "routing.holdMinutesPerStep"
$parsedHoldMinutes = Get-IntValue -Value $holdMinutes
if ($null -eq $parsedHoldMinutes -or $parsedHoldMinutes -lt 5 -or $parsedHoldMinutes -gt 180) {
    Write-Host "routing.holdMinutesPerStep must be an integer in range 5..180." -ForegroundColor Red
    $failed = $true
}

$errorRate = Get-JsonValue -Object $json -Path "rollback.triggerErrorRatePercent"
$parsedErrorRate = Get-DoubleValue -Value $errorRate
if ($null -eq $parsedErrorRate -or $parsedErrorRate -le 0 -or $parsedErrorRate -gt 100) {
    Write-Host "rollback.triggerErrorRatePercent must be a number in range (0,100]." -ForegroundColor Red
    $failed = $true
}

$latency = Get-JsonValue -Object $json -Path "rollback.triggerP99LatencyMs"
$parsedLatency = Get-IntValue -Value $latency
if ($null -eq $parsedLatency -or $parsedLatency -lt 100 -or $parsedLatency -gt 60000) {
    Write-Host "rollback.triggerP99LatencyMs must be an integer in range 100..60000." -ForegroundColor Red
    $failed = $true
}

$mismatch = Get-JsonValue -Object $json -Path "rollback.maxReconciliationMismatchCount"
$parsedMismatch = Get-IntValue -Value $mismatch
if ($null -eq $parsedMismatch -or $parsedMismatch -lt 0) {
    Write-Host "rollback.maxReconciliationMismatchCount must be a non-negative integer." -ForegroundColor Red
    $failed = $true
}

$alarmPaths = @(
    "alarmThresholds.failedExecutionsMaxPer5Min",
    "alarmThresholds.compensationRequiredMaxPer5Min",
    "alarmThresholds.webhookValidationFailuresMaxPer5Min"
)
foreach ($path in $alarmPaths) {
    $value = Get-JsonValue -Object $json -Path $path
    $parsedAlarm = Get-IntValue -Value $value
    if ($null -eq $parsedAlarm -or $parsedAlarm -lt 0) {
        Write-Host "$path must be a non-negative integer." -ForegroundColor Red
        $failed = $true
    }
}

if ($failed) {
    exit 1
}

Write-Host "Rollback criteria/config sanity validation passed: $ConfigPath" -ForegroundColor Green
