---
name: validar-kpi
description: Valida uma ou mais medidas de KPI (KPI01..KPI21) contra os dados após editá-las via MCP — confere o literal Tipo, a direção da cor e os valores reais. Use após alterar Atual/Target/Budget/Cor/HTML de um KPI, ou quando um card estiver com a cor "errada".
---

# Validar KPI

Skill aditivo para pegar os dois bugs silenciosos mais comuns deste projeto:
1. O literal `Tipo` da medida não bate com a coluna `Tipo` do SharePoint → medida retorna vazio.
2. A direção da faixa de cor (`Cor KPI##`) está invertida → card verde que deveria ser amarelo/vermelho (ou o contrário).

## Como validar

Recebe um ou mais KPIs (ex.: `KPI16` ou "Full Service DM"). Se nenhum for dado, valide todos os 21.

1. **Conectar** ao modelo vivo: `connection_operations` → `ListLocalInstances` → `Connect`. O Power BI Desktop precisa estar aberto.
2. **Ler as medidas** do KPI via `measure_operations` `Get`: `Atual KPI##`, `Target KPI##`, `Budget KPI##`, `Cor KPI##`.
3. **Conferir o literal `Tipo`**: extraia o `_t = "..."` das medidas Atual/Target/Budget e confirme que é idêntico entre elas. Rode um DAX para verificar que existe na base:
   `EVALUATE FILTER(VALUES('KPI_Budget'[Tipo]), 'KPI_Budget'[Tipo] = "<literal>")` — se vier vazio, o literal está errado (typo ou sufixo de unidade divergente).
4. **Conferir a direção da cor**: leia a expressão de `Cor KPI##`.
   - *Maior é melhor* (15): `>= 1 → #44C088` verde, `>= 0.9 → #F4B942` amarelo, senão `#ED7373` vermelho.
   - *Menor é melhor* (6 — KPI06, 07, 10, 13, 19, 21): thresholds invertem (`<= 1` verde, `<= 1.1` amarelo).
   Decida a direção pela semântica do KPI e alerte se a expressão não corresponder.
5. **Conferir a guarda de dado ausente**: a medida tem que começar com `IF(ISBLANK(_a) || ISBLANK(_t) || _t = 0, "#ED7373", ...)`. Se estiver usando `DIVIDE(_a, _t, 1)` sem guarda, **é bug**: meta 0/vazia devolve `1`, que passa em `>= 1` e em `<= 1` → o card fica verde sem ter meta. Confirme também nos dados se `Target` do último `Período` não está zerado — se estiver, o card deve estar vermelho pela guarda, e o problema real é preenchimento na planilha.
6. **Rodar os valores reais** via `dax_query_operations` `Execute`:
   `EVALUATE { ("KPI##", [Atual KPI##], [Target KPI##], DIVIDE([Atual KPI##],[Target KPI##]), [Cor KPI##]) }`
   Confirme que a razão cai na faixa da cor retornada e que a cor faz sentido para o valor.

> ⚠️ **O dado muda embaixo de você.** O modelo é atualizado do SharePoint durante a sessão: um KPI que dava vermelho às 13:33 apareceu verde às 13:47 porque o `Target` chegou zerado no refresh. Consulte sempre o estado atual antes de concluir, e desconfie se sua leitura não bate com o que o usuário está vendo na tela — provavelmente ele está com dado mais novo, não errado.

## Reportar

Para cada KPI: literal `Tipo` (OK/errado), direção da cor (OK/invertida), guarda presente (sim/não), e a linha Atual/Target/razão/cor. Sinalize qualquer inconsistência com o valor esperado. Não altere nada — só valida; correções são tarefa separada e vão via MCP.
