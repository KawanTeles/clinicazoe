# Auditoria de UX

Use quando o usuário mandar um print, um .pbix/.pbip ou pedir "melhora meu relatório". Se ele mandou o arquivo, **leia a estrutura antes de opinar** (no PBIP, os visuais estão em `*.Report/definition/pages/*/visuals/*/visual.json` — dá para listar tipo, posição e tamanho de cada visual sem abrir o Desktop).

## Formato do laudo

Não entregue uma lista solta de 20 itens. Entregue assim:

```
## O que está funcionando
(2–3 itens — sempre existe algo; começar só pelo erro faz o usuário fechar o documento)

## Os 3 problemas que mais custam
1. [Problema] — por que dói — correção concreta (com o valor/propriedade exata)
2. …
3. …

## Ajustes menores
(lista curta, uma linha cada)

## O que eu não consigo avaliar daqui
(honestidade: performance, dados, se o público entende os termos)
```

Priorize por **impacto na leitura**, não pela ordem em que você encontrou. Um gráfico de pizza com 12 fatias é pior que uma margem de 14px em vez de 16px, e o usuário só vai corrigir os 3 primeiros itens de qualquer lista.

## Checklist

**Estrutura**
- [ ] Existe um visual herói? Ou tudo tem o mesmo peso (= nada tem peso)?
- [ ] Máximo 4 KPIs na faixa superior
- [ ] Todo KPI mostra um delta (vs período anterior ou vs meta). KPI sem comparação é um número sem sentido
- [ ] Slicers agrupados num lugar só (topo ou painel lateral), nunca espalhados
- [ ] Máximo ~8 visuais por página

**Cor**
- [ ] Um acento só. Cor extra existe para significar algo (bom/ruim), não para enfeitar
- [ ] Nada do azul padrão `#118DFF`
- [ ] Verde/vermelho não são usados como cor de série
- [ ] Contraste do texto secundário ≥ 4.5:1 sobre o fundo do card

**Gráficos**
- [ ] Pizza/rosca só com ≤ 4 categorias
- [ ] Série temporal em linha (não em barra empilhada)
- [ ] Ranking em barra horizontal, ordenado
- [ ] Sem gridlines em tema escuro; rótulo direto no dado
- [ ] Eixo Y começa em zero em gráficos de barra (em linha, não obrigatoriamente)
- [ ] Título descritivo ("Receita mensal — 2025"), não genérico ("Receita")

**Acabamento**
- [ ] Raio de canto idêntico em todos os visuais
- [ ] Sombra consistente (mesma cor, blur e transparência)
- [ ] Fundo dos cards com transparência 12–20% se houver papel de parede
- [ ] Cabeçalho de visual desligado
- [ ] Alinhamento na grade — use Formatar → Alinhar, não o olho

**Realidade**
- [ ] Layout testado na resolução real de uso (Teams corta ~80px de altura)
- [ ] Testado no Service, não só no Desktop (SVG e imagens externas se comportam diferente)
- [ ] Se for compartilhado no celular, existe layout mobile

## Diagnósticos frequentes (e o que dizer)

| Sintoma | Diagnóstico real | Correção |
|---|---|---|
| "Está poluído" | Falta hierarquia, não falta espaço | Escolha um herói, encolha o resto |
| "Não fica bonito como o do LinkedIn" | Falta camada de fundo + transparência | Papel de parede + card a 15% |
| "As cores estão feias" | Cores demais, não cores erradas | Reduza a 1 acento + neutros |
| "Ninguém usa o relatório" | Não é design, é a pergunta errada | Descubra qual decisão a página deveria apoiar |
