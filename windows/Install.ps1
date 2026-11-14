[CmdletBinding()]
param(
  [ValidatePattern('^[A-Za-z0-9_-]{1,32}$')][string]$Instance = 'Pocket',
  [ValidateRange(1024,65535)][int]$Port = 4177,
  [string]$HermesHome = $env:HERMES_HOME, [string]$Python, [string]$Bootstrap,
  [string]$Profile, [string]$Origin, [Security.SecureString]$Password
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This installer supports Windows.' }
if (!$env:LOCALAPPDATA) { throw 'Windows user profile unavailable.' }
$project = Split-Path $PSScriptRoot
$state = Join-Path $env:LOCALAPPDATA "PocketCompanion\$Instance"
$task = "Pocket Companion - $Instance"
$url = "http://127.0.0.1:$Port"
if ($Origin) {
  $uri = [uri]$Origin
  if (!$uri.IsAbsoluteUri -or $uri.Scheme -ne 'https' -or $uri.UserInfo -or $uri.Query -or $uri.Fragment -or $uri.AbsolutePath -ne '/') {throw 'Specify the exact private HTTPS origin.'}
  $Origin = $uri.GetLeftPart([UriPartial]::Authority)
}
if (Test-Path -LiteralPath $state) {throw 'This instance already has settings. See INSTALL.md for recovery or choose another instance.'}
if (Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue) {throw 'That sign-in task already exists.'}
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$Port)
try {$listener.Start()} catch {throw "Port $Port is unavailable. Re-run with -Port and an unused number."} finally {$listener.Stop()}
$nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1
$node = & $nodeCommand.Source -p "require('node:fs').realpathSync(process.execPath)"
$npm = (Get-Command npm.cmd -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
if ([version](& $node -p 'process.versions.node') -lt [version]'22.12.0') {throw 'Install Node.js 22.12 or newer, then reopen PowerShell.'}
if (!$HermesHome) {$HermesHome = Join-Path $env:LOCALAPPDATA 'hermes'}
$HermesHome = (Resolve-Path -LiteralPath $HermesHome).Path
if (!$Bootstrap) {$Bootstrap = Join-Path $HermesHome 'hermes-agent\ui-tui\scripts\gateway_bootstrap.py'}
$Bootstrap = (Get-Item -LiteralPath $Bootstrap).FullName
if (!$Python) {
  $options = @(Join-Path $HermesHome 'hermes-agent\venv\Scripts\python.exe')
  $options += @(Get-ChildItem -Path (Join-Path $HermesHome 'tools\python-*\python.exe') -File -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | ForEach-Object FullName)
  $Python = $options | Where-Object {Test-Path -LiteralPath $_ -PathType Leaf} | Select-Object -First 1
}
if (!$Python) {throw 'Specify the Python executable used by Hermes with -Python.'}
$Python = (Get-Item -LiteralPath $Python).FullName
Write-Host "Pocket Companion setup | Windows"
Write-Host "Installing locked dependencies in this checkout. Startup runs as your Windows user."
Push-Location -LiteralPath $project
$created = $false
$registered = $false
try {
  & $npm ci --include=dev --no-audit --no-fund
  if ($LASTEXITCODE) {throw 'Dependency installation failed.'}
  & $npm run build
  if ($LASTEXITCODE) {throw 'Build failed.'}
  $env:HERMES_HOME=$HermesHome
  $env:HERMES_PYTHON=$Python
  $env:HERMES_BOOTSTRAP=$Bootstrap
  $env:COMPANION_PREFERRED_PROFILE=$Profile
  $activeProfile = & $node --import tsx windows/probe.ts
  if ($LASTEXITCODE -or !$activeProfile) {throw 'Hermes connection check failed.'}
  Write-Host 'Hermes connection verified. Create your Pocket password (16 or more characters).'
  if (!$Password) {
    $Password = Read-Host 'New Pocket password' -AsSecureString
    $again = Read-Host 'Confirm Pocket password' -AsSecureString
    if ([Net.NetworkCredential]::new('',$Password).Password -cne [Net.NetworkCredential]::new('',$again).Password) {throw 'Passwords differ. Run setup again.'}
    $again.Dispose()
  }
  [void](New-Item -ItemType Directory -Path (Split-Path $state) -Force)
  [void](New-Item -ItemType Directory -Path $state)
  $created=$true
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $acl = Get-Acl -LiteralPath $state
  $acl.SetAccessRuleProtection($true,$false)
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
  Set-Acl -LiteralPath $state -AclObject $acl
  $settingsFile = Join-Path $state 'settings.json'
  $verifier = Join-Path $state 'password.verifier'
  $OutputEncoding = [Text.UTF8Encoding]::new($false)
  [Net.NetworkCredential]::new('',$Password).Password | & $node --import tsx windows/credential.ts $verifier
  if ($LASTEXITCODE) {throw 'Password setup failed.'}
  @{hermesHome=$HermesHome;python=$Python;bootstrap=$Bootstrap;port=$Port;profile=[string]$activeProfile;origin=$Origin} | ConvertTo-Json | Set-Content -LiteralPath $settingsFile -Encoding UTF8
  $action = New-ScheduledTaskAction -Execute $node -WorkingDirectory $project -Argument ('--import tsx windows/launch.ts "'+$settingsFile+'"')
  $user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
  $policy = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Settings $policy -Principal $principal | Out-Null
  $registered=$true
  Start-ScheduledTask -TaskName $task
  $ready=$false
  foreach ($attempt in 1..25) {
    try {
      $me=Invoke-RestMethod "$url/api/me" -TimeoutSec 2
      if ($me.authenticated -eq $false -and (Get-ScheduledTask -TaskName $task).State -eq 'Running') {$ready=$true;break}
    } catch {}
    Start-Sleep -Seconds 1
  }
  if (!$ready) {throw 'Pocket did not start on the chosen port.'}
  Write-Host "Open $url and sign in. For phone access, follow INSTALL.md."
  if ($Origin) {Write-Host "Configured private origin: $Origin (requires a matching private proxy route)."}
} catch {
  if ($registered) {Stop-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue; Unregister-ScheduledTask -TaskName $task -Confirm:$false}
  if ($created) {
    foreach ($name in 'settings.json','password.verifier') {
      $file=Join-Path $state $name
      if (Test-Path -LiteralPath $file) {Remove-Item -LiteralPath $file}
    }
    [IO.Directory]::Delete($state)
  }
  throw
} finally {Pop-Location}
