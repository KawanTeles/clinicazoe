# PostToolUse(Write|Edit): mantem a documentacao/skills em sincronia.
#  - .claude/skills/**  -> espelha o arquivo em .agents/skills/** (copia literal, deterministica)
#  - CLAUDE.md          -> injeta lembrete para revisar GEMINI.md (edicao semantica, exige julgamento)
#
# stdin e lido como UTF-8 explicitamente: os caminhos deste projeto contem acento
# ("Area de Trabalho") e o code page padrao do console os corrompe, fazendo a copia
# falhar silenciosamente.

try {
    $reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), [System.Text.Encoding]::UTF8)
    $raw = $reader.ReadToEnd()
    $reader.Close()
    $j = $raw | ConvertFrom-Json
    $f = $j.tool_input.file_path
} catch { exit 0 }
if (-not $f) { exit 0 }

# --- Caso 1: skill alterado -> espelhar para .agents/ ---
if ($f -match '[\\/]\.claude[\\/]skills[\\/]') {
    $dest = $f -replace '([\\/])\.claude([\\/])skills([\\/])', '$1.agents$2skills$3'
    $skill = Split-Path -Leaf (Split-Path -Parent $dest)
    try {
        if (-not (Test-Path -LiteralPath $f)) { exit 0 }   # arquivo deletado, nada a espelhar
        $destDir = Split-Path -Parent $dest
        if (-not (Test-Path -LiteralPath $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force -ErrorAction Stop | Out-Null
        }
        Copy-Item -LiteralPath $f -Destination $dest -Force -ErrorAction Stop

        # Confirmar que chegou de verdade, e identico. Nao reportar sucesso sem verificar.
        $srcHash = (Get-FileHash -LiteralPath $f -Algorithm MD5 -ErrorAction Stop).Hash
        $dstHash = (Get-FileHash -LiteralPath $dest -Algorithm MD5 -ErrorAction Stop).Hash
        if ($srcHash -ne $dstHash) { throw "hash divergente apos copia" }

        @{ systemMessage = "[sync] skill '$skill' espelhado em .agents/skills/ (verificado)" } |
            ConvertTo-Json -Compress | Write-Output
    } catch {
        @{ systemMessage = "[sync] FALHOU ao espelhar '$skill' para .agents/: $($_.Exception.Message)" } |
            ConvertTo-Json -Compress | Write-Output
    }
    exit 0
}

# --- Caso 2: CLAUDE.md alterado -> lembrar do GEMINI.md ---
if ((Split-Path -Leaf $f) -eq 'CLAUDE.md') {
    $msg = 'Voce acabou de editar o CLAUDE.md. O GEMINI.md cobre o mesmo projeto (spec em pt-BR: caminhos, tabela de KPIs, layout, regras). Verifique se esta mudanca tambem vale la e atualize se for o caso. Nao copie o arquivo: eles tem estrutura e idioma diferentes; a edicao e semantica. Se nao se aplicar, siga em frente sem alterar.'
    @{
        hookSpecificOutput = @{
            hookEventName     = 'PostToolUse'
            additionalContext = $msg
        }
    } | ConvertTo-Json -Compress -Depth 5 | Write-Output
    exit 0
}

exit 0
