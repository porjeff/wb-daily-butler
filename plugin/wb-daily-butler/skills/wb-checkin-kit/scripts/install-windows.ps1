# Install scheduled tasks on Windows: run WorkBuddy check-in at 09:00 and 18:00 daily.
# Usage: powershell -ExecutionPolicy Bypass -File install-windows.ps1 [-WorkDir <path>]
param(
    [string]$WorkDir = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw "Node.js not found. Install Node.js 18+ from https://nodejs.org first." }

$script = Join-Path $WorkDir 'run_all.mjs'
if (-not (Test-Path $script)) { throw "run_all.mjs not found in $WorkDir" }

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory $WorkDir
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

$triggers = @(
    (New-ScheduledTaskTrigger -Daily -At '09:00'),
    (New-ScheduledTaskTrigger -Daily -At '18:00')
)

Register-ScheduledTask -TaskName 'WorkBuddyDailyCheckin' `
    -Action $action -Trigger $triggers -Settings $settings `
    -Description 'WorkBuddy daily check-in and buddy cat travel' -Force | Out-Null

Write-Host "Installed: task 'WorkBuddyDailyCheckin' (09:00 / 18:00)"
Write-Host "Node:   $node"
Write-Host "Script: $script"
Write-Host "Run now to test:  schtasks /Run /TN WorkBuddyDailyCheckin"
Write-Host "Check result:     $WorkDir\log\"
