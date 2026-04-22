param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath,
    [string]$ChecklistPath = ".\ops\cutover-checklist.md",
    [switch]$AllowPlaceholders,
    [switch]$EnforceChecklist
)

$ErrorActionPreference = "Stop"

function Invoke-Step([string]$Name, [scriptblock]$Action) {
    Write-Host "==> $Name" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) {
        Write-Error "$Name failed."
        exit $LASTEXITCODE
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent (Split-Path -Parent $workspaceRoot)
$resolvedConfigPath = if ([System.IO.Path]::IsPathRooted($ConfigPath)) { $ConfigPath } else { Join-Path $workspaceRoot $ConfigPath }
$resolvedChecklistPath = if ([System.IO.Path]::IsPathRooted($ChecklistPath)) { $ChecklistPath } else { Join-Path $workspaceRoot $ChecklistPath }

Push-Location $repoRoot
try {
    Invoke-Step -Name "Build serverless-backend workspace" -Action { npm run build --workspace=serverless-backend }

    Invoke-Step -Name "Validate cutover config required fields" -Action {
        if ($AllowPlaceholders) {
            & "$scriptDir\validate-cutover-config.ps1" -ConfigPath $resolvedConfigPath -AllowPlaceholders
        } else {
            & "$scriptDir\validate-cutover-config.ps1" -ConfigPath $resolvedConfigPath
        }
    }

    Invoke-Step -Name "Validate rollback criteria config sanity" -Action {
        if ($AllowPlaceholders) {
            & "$scriptDir\validate-cutover-rollback.ps1" -ConfigPath $resolvedConfigPath -AllowPlaceholders
        } else {
            & "$scriptDir\validate-cutover-rollback.ps1" -ConfigPath $resolvedConfigPath
        }
    }

    Invoke-Step -Name "Summarize checklist status" -Action {
        if ($EnforceChecklist) {
            & "$scriptDir\get-cutover-checklist-status.ps1" -ChecklistPath $resolvedChecklistPath -RequirePreCutoverComplete -RequireRollbackReadinessComplete
        } else {
            & "$scriptDir\get-cutover-checklist-status.ps1" -ChecklistPath $resolvedChecklistPath
        }
    }
} finally {
    Pop-Location
}

Write-Host "Cutover preflight checks completed." -ForegroundColor Green
