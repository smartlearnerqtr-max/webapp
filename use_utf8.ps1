$ErrorActionPreference = "Stop"

chcp 65001 | Out-Null

[Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()

$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONLEGACYWINDOWSSTDIO = "0"

Write-Host "UTF-8 mode is on for this PowerShell session."
Write-Host "Python: PYTHONUTF8=$env:PYTHONUTF8, PYTHONIOENCODING=$env:PYTHONIOENCODING"
Write-Host "Run: python encoding_patch.py --db --apply  # patch known local DB rows"
