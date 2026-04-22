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

$requiredPaths = @(
    "environment",
    "routing.legacyTarget",
    "routing.serverlessTarget",
    "aws.region",
    "aws.stepFunctionArn",
    "aws.dynamoTableName",
    "rollback.owner"
)

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

$failed = $false

foreach ($path in $requiredPaths) {
    $value = Get-JsonValue -Object $json -Path $path
    if ([string]::IsNullOrWhiteSpace([string]$value)) {
        Write-Host "Missing required value: $path" -ForegroundColor Red
        $failed = $true
    }
}

if (-not $AllowPlaceholders) {
    $content = Get-Content -Path $ConfigPath -Raw
    if ($content -match "PLACEHOLDER|YYYY-MM-DD|ACCOUNT_ID|STATE_MACHINE_NAME|team-or-user|on-call-team") {
        Write-Host "Config still contains placeholder values. Replace placeholders before cutover." -ForegroundColor Red
        $failed = $true
    }
}

if ($failed) {
    exit 1
}

Write-Host "Cutover config validation passed: $ConfigPath" -ForegroundColor Green
