---
name: powerbi-premium-design-skill
description: Design de relatórios Power BI com acabamento premium (estilo dark, glow, sombras, cards de vidro, gráficos customizados com Deneb/Vega-Lite e SVG em DAX). Use SEMPRE que o usuário falar em Power BI + design, tema, layout, paleta, JSON de tema, "deixar bonito", dashboard executivo, KPI card, Pareto, gráfico com degradê, gauge de meta, donut com imagens, sparkline, auditoria de UX de relatório, ou pedir para reproduzir um visual de referência (print/screenshot) num relatório. Use também quando o usuário pedir só um gráfico ("qual gráfico uso para X?") ou só um tema, e quando mencionar Deneb, Vega-Lite, SVG measure, HTML Content ou visual customizado. Não use para modelagem, Power Query, performance ou DAX de negócio (só DAX de apresentação).
---

# Power BI Premium Design

Objetivo: produzir relatórios com acabamento de estúdio **sem Figma** — todo o visual sai de
(1) efeitos nativos do Power BI (sombra, glow, cantos arredondados, transparência),
(2) **Deneb** (Vega-Lite) para os gráficos que o PBI não faz nativamente,
(3) **medidas SVG em DAX** para micro-elementos dentro de tabelas/matrizes,
(4) um **plano de fundo gerado por script**, não desenhado à mão.

O design system padrão é **Dark Premium** (`references/design-system.md`). Só saia dele se o usuário pedir.

---

## Fluxo de trabalho

1. **Entenda o alvo.** Se o usuário mandou print de referência, descreva em voz alta o que compõe aquele visual (fundo, cards, acento, tipo de gráfico) antes de produzir — isso evita copiar a cor e perder a estrutura.
2. **Escolha as peças** com a árvore de decisão abaixo.
3. **Sempre entregue o tema JSON** (`assets/tema-dark-premium.json`), adaptado se necessário. É a base de tudo; sem ele os efeitos ficam manuais e inconsistentes.
4. **Gere o plano de fundo** com `scripts/gen_background.py` se a página precisar de profundidade/aurora.
5. **Entregue as specs Deneb** e/ou **medidas SVG** dos gráficos pedidos, prontas para colar.
6. **Feche com o passo-a-passo de aplicação** (importar tema → papel de parede → colar spec no Deneb). O usuário precisa saber onde clicar.

Não pergunte "que tipo de saída você quer?" antes de começar — infira do pedido e entregue. Pergunte só se faltar algo que muda o resultado (ex.: nome das medidas, se o ambiente bloqueia visual customizado).

---

## Árvore de decisão: nativo, Deneb ou SVG?

| O que você quer | Como fazer | Por quê |
|---|---|---|
| Card, borda, canto redondo, sombra, glow | **Nativo** (tema JSON) | O PBI faz bem; Deneb aqui é overkill |
| Linha/área com **degradê** e brilho | **Deneb** | Nativo só faz preenchimento chapado |
| **Pareto** (barras + curva acumulada, vertical ou horizontal) | **Deneb** | O combo nativo não faz barras horizontais + linha |
| **Donut com fotos** nas fatias | **Deneb** (arcos + mark image) | Nativo não posiciona imagem no arco |
| **Gauge / bullet de meta** com marcador | **Deneb** | O gauge nativo é feio e não segue o tema |
| Barra de progresso, sparkline, pílula de status **dentro de tabela/matriz** | **SVG em DAX** | Deneb não vive dentro de uma célula |
| Ranking simples, tendência simples, matriz | **Nativo** | Mais rápido, mais leve, filtra melhor |

Regra de ouro: **nativo sempre que empatar.** Deneb é lindo mas cada spec é código que alguém vai ter que manter. Use Deneb onde ele muda o jogo, não onde ele só troca a fonte do rótulo.

---

## Anatomia do "premium" — o que realmente cria a estética dos prints

Não é a cor. É a **camada**. Da mais funda para a mais alta:

1. **Papel de parede (wallpaper)** — grafite/navy quase preto (`#0B1120`), com manchas de luz difusa (aurora) na diagonal. Gerado por script, não pintado.
2. **Fundo da página** — mesma cor, transparência 100% (deixa o wallpaper aparecer).
3. **Cards** — retângulo com fill `#131B2E` a ~12–20% de transparência, borda `1px #2A3550`, raio 12px, sombra externa preta difusa. É o efeito "vidro fosco" (glassmorphism) sem plugin.
4. **Glow de acento** — só nos elementos que importam: o KPI herói, a linha do gráfico principal, o ícone ativo do menu. Glow em tudo = nada brilha.
5. **Dados** — 1 cor de acento + neutros. Cor só significa alguma coisa quando é escassa.

Erros que matam o efeito, nessa ordem:
- Card com fundo 100% opaco em cima de wallpaper escuro → vira um retângulo morto.
- Sombra preta forte (transparência < 40%) → mancha suja em vez de profundidade.
- Mais de 2 cores de acento → o olho não sabe onde pousar.
- Gridlines visíveis → em fundo escuro, gridline é ruído puro. Elimine, use rótulo direto no dado.
- Título de visual com 14px+ bold branco → compete com o dado. Título é 11–12px, cinza médio.

---

## Layout

Canvas **1280 × 720** (Teams/SharePoint) ou **1920 × 1080** (TV/embed). Nunca "ajustar à página" com layout desenhado para outra resolução.

Grade: margem externa 24px · rail lateral de navegação 72px · gap entre cards 12px.

**Dashboard executivo:**
```
┌──┬──────────────────────────────────────────────────┐
│  │  Título (28px) + subtítulo   ·   slicers à direita│ 88px
│ r├──────────┬──────────┬──────────┬──────────────────┤
│ a│  KPI     │  KPI     │  KPI     │  KPI             │ 96px  (máx 4)
│ i├──────────┴──────────┴──────────┼──────────────────┤
│ l│  Gráfico principal (Deneb)      │  Donut / ranking │ 260px
│  ├─────────────────────────────────┼──────────────────┤
│  │  Tabela com SVG (barras/pílulas)│  Gauge de meta   │ 220px
└──┴─────────────────────────────────┴──────────────────┘
```
Regra: **um herói por página.** O gráfico principal ocupa ~40% da área útil; o resto é contexto. Página sem hierarquia parece planilha bonita, não dashboard.

---

## Arquivos de referência — leia sob demanda

| Arquivo | Leia quando |
|---|---|
| `references/design-system.md` | Sempre. Cores, tipografia, espaçamento, tokens. |
| `references/native-effects.md` | For gerar/editar tema JSON, sombra, glow, vidro, fundo. |
| `references/deneb-recipes.md` | For fazer Pareto, linha com degradê, donut com fotos, gauge. Specs prontas. |
| `references/svg-dax.md` | For colocar sparkline, barra de progresso ou pílula dentro de tabela/matriz. |
| `references/ux-audit.md` | For auditar um relatório existente. Checklist + formato do laudo. |

| Asset / script | Uso |
|---|---|
| `assets/tema-dark-premium.json` | Tema base. Entregue sempre, adaptando cores se a marca exigir. |
| `scripts/gen_background.py` | Gera o PNG de fundo (aurora + vinheta). `python gen_background.py --out fundo.png --accent "#00C2D1"` |

---

## Como entregar

Termine **sempre** com o passo-a-passo, nessa ordem, porque a ordem importa (o tema não aplica papel de parede sozinho):

1. Exibição → Temas → Procurar temas → `tema-dark-premium.json`
2. Exibição → Painel de formatação → Papel de parede → Imagem → `fundo.png` → Ajuste: **Ajustar**
3. Plano de fundo da página → Transparência **100%**
4. Deneb: instale do AppSource → cole a spec → Fornecedor: **Vega-Lite** → mapeie os campos do dataset
5. Medidas SVG: crie a medida → categoria de dados **URL da Imagem** → arraste para a coluna da tabela

Se o usuário estiver começando um relatório do zero, ofereça também o formato **PBIP** (pasta, versionável em Git) — o tema e as specs viram arquivos rastreáveis.
