@echo off
setlocal
powershell.exe -NoProfile -File "%~dp0windows\Install.ps1" %*
if errorlevel 1 echo Setup stopped. Read the message above or see INSTALL.md.
pause
