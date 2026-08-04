# PreToolUse(Write|Edit) guard: warns when editing TMDL/PBIR files directly
# while Power BI Desktop is open (it locks/overwrites those files).
$ErrorActionPreference = 'SilentlyContinue'
try {
    $raw = [Console]::In.ReadToEnd()
    $j = $raw | ConvertFrom-Json
    $f = $j.tool_input.file_path
} catch { exit 0 }

if (-not $f) { exit 0 }
if ($f -notmatch '\.(tmdl|pbir|json)$') { exit 0 }
if ($f -notmatch '[\\/]Dashboard[\\/]') { exit 0 }

$pbi = Get-Process -Name 'PBIDesktop' -ErrorAction SilentlyContinue
if (-not $pbi) { exit 0 }

$reason = 'Power BI Desktop esta ABERTO. Editar arquivos TMDL/PBIR direto pode travar ou sobrescrever o arquivo. Feche o Desktop antes de editar direto, ou faca a alteracao via MCP (powerbi-modeling-mcp).'
$out = @{
    hookSpecificOutput = @{
        hookEventName            = 'PreToolUse'
        permissionDecision       = 'ask'
        permissionDecisionReason = $reason
    }
} | ConvertTo-Json -Compress -Depth 5
Write-Output $out
exit 0
