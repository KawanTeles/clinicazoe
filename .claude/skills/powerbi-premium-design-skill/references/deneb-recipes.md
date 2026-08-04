# Receitas Deneb (Vega-Lite v5)

Quatro specs prontas, no Dark Premium. Todas assumem:
- Visual **Deneb** (AppSource, certificado) → Provider **Vega-Lite**.
- O campo de dados chama-se `dataset` (padrão do Deneb). **Os nomes das colunas na spec precisam ser exatamente os nomes dos campos que você arrastou** para o data role "Values". Se o usuário tiver medidas com outros nomes, renomeie na spec — não peça pra ele renomear a medida.
- `"background": null` — sem isso o gráfico vem com fundo branco e destrói o tema.
- Em Deneb → **Settings → Interactivity**, ligue Tooltips e Cross-filtering se quiser interação; para destacar a seleção, use `"opacity": {"condition": {"test": "datum.__selected__ !== 'off'", "value": 1}, "value": 0.35}`.

Bloco `config` comum a todas (cole em toda spec):

```json
"config": {
  "background": null,
  "view": { "stroke": null },
  "font": "Segoe UI",
  "axis": {
    "grid": false, "domain": false, "ticks": false, "title": null,
    "labelColor": "#5C6C8A", "labelFontSize": 10, "labelFont": "Segoe UI", "labelPadding": 6
  },
  "text": { "font": "Segoe UI", "fontSize": 10 },
  "legend": { "disable": true }
}
```

---

## 1. Linha com degradê + rótulos de melhor/pior mês

Reproduz o "Faturamento ao longo do tempo" do print. Campos: `Mes` (texto ou data), `Faturamento`.

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "background": null,
  "padding": { "left": 4, "top": 40, "right": 12, "bottom": 4 },
  "data": { "name": "dataset" },
  "transform": [
    { "joinaggregate": [
        { "op": "max", "field": "Faturamento", "as": "vMax" },
        { "op": "min", "field": "Faturamento", "as": "vMin" } ] },
    { "calculate": "datum.Faturamento === datum.vMax ? 'melhor' : (datum.Faturamento === datum.vMin ? 'pior' : null)", "as": "extremo" }
  ],
  "layer": [
    {
      "mark": {
        "type": "area",
        "interpolate": "monotone",
        "line": { "color": "#22D3EE", "strokeWidth": 3, "strokeCap": "round" },
        "color": {
          "gradient": "linear", "x1": 1, "y1": 1, "x2": 1, "y2": 0,
          "stops": [
            { "offset": 0.0, "color": "rgba(34,211,238,0.00)" },
            { "offset": 0.55, "color": "rgba(34,211,238,0.18)" },
            { "offset": 1.0, "color": "rgba(34,211,238,0.55)" }
          ]
        }
      },
      "encoding": {
        "x": { "field": "Mes", "type": "ordinal", "axis": { "labelAngle": 0 } },
        "y": { "field": "Faturamento", "type": "quantitative", "axis": null,
               "scale": { "zero": true, "nice": false } }
      }
    },
    {
      "mark": { "type": "text", "dy": -12, "fontSize": 9, "color": "#8FA0BF" },
      "encoding": {
        "x": { "field": "Mes", "type": "ordinal" },
        "y": { "field": "Faturamento", "type": "quantitative" },
        "text": { "field": "Faturamento", "type": "quantitative", "format": ".3~s" }
      }
    },
    {
      "transform": [ { "filter": "datum.extremo === 'melhor'" } ],
      "mark": { "type": "text", "dy": -46, "fontSize": 26, "fontWeight": 300, "color": "#22D3EE" },
      "encoding": {
        "x": { "field": "Mes", "type": "ordinal" },
        "y": { "field": "Faturamento", "type": "quantitative" },
        "text": { "field": "Faturamento", "type": "quantitative", "format": ".3~s" }
      }
    },
    {
      "transform": [ { "filter": "datum.extremo === 'pior'" } ],
      "mark": { "type": "text", "dy": -46, "fontSize": 26, "fontWeight": 300, "color": "#F1607E" },
      "encoding": {
        "x": { "field": "Mes", "type": "ordinal" },
        "y": { "field": "Faturamento", "type": "quantitative" },
        "text": { "field": "Faturamento", "type": "quantitative", "format": ".3~s" }
      }
    }
  ],
  "config": { "…cole o config comum aqui…" }
}
```

O degradê é a chave: `"color"` do mark `area` recebe um objeto `gradient`, com `y1:1 → y2:0` (de baixo para cima) e o último stop em ~55% de opacidade. Opacidade zero embaixo faz a área "dissolver" no card em vez de terminar numa linha reta — é isso que dá o ar de brilho.

Para o glow da linha: duplique o layer da área com `"mark": {"type":"line","strokeWidth":10,"opacity":0.15,"color":"#22D3EE","interpolate":"monotone"}` **antes** do layer principal. Uma linha grossa e translúcida por baixo = halo.

---

## 2. Pareto vertical (barras horizontais + curva acumulada + classes ABC)

Reproduz o "Pareto Produtos". Campos: `Produto`, `Faturamento`.

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "background": null,
  "width": 420,
  "data": { "name": "dataset" },
  "transform": [
    { "window": [ { "op": "sum", "field": "Faturamento", "as": "acumulado" },
                  { "op": "rank", "as": "rank" } ],
      "sort": [ { "field": "Faturamento", "order": "descending" } ] },
    { "joinaggregate": [ { "op": "sum", "field": "Faturamento", "as": "total" } ] },
    { "calculate": "datum.acumulado / datum.total", "as": "pctAcum" },
    { "calculate": "datum.pctAcum <= 0.8 ? 'A' : (datum.pctAcum <= 0.95 ? 'B' : 'C')", "as": "classe" },
    { "calculate": "datum.Produto + '  |  R$ ' + format(datum.Faturamento/1e6, ',.2f') + ' Mi'", "as": "rotulo" }
  ],
  "encoding": {
    "y": { "field": "Produto", "type": "nominal",
           "sort": { "field": "rank", "op": "min", "order": "ascending" },
           "axis": null }
  },
  "layer": [
    { "mark": { "type": "text", "align": "left", "dy": -14, "dx": 0, "fontSize": 10, "color": "#CBD5E1" },
      "encoding": { "x": { "value": 0 }, "text": { "field": "rotulo" } } },

    { "mark": { "type": "bar", "height": 10, "cornerRadius": 5 },
      "encoding": {
        "x": { "field": "Faturamento", "type": "quantitative", "axis": null,
               "scale": { "nice": false } },
        "color": {
          "field": "classe", "type": "nominal",
          "scale": { "domain": ["A", "B", "C"], "range": ["#22D3EE", "#475C7F", "#33415C"] },
          "legend": null
        }
      } },

    { "mark": { "type": "line", "strokeWidth": 1.5, "color": "#E2E8F0", "point": false },
      "encoding": {
        "x": { "field": "pctAcum", "type": "quantitative", "axis": null, "scale": { "domain": [0, 1] } },
        "order": { "field": "rank" }
      } },

    { "mark": { "type": "point", "filled": true, "size": 45, "color": "#0B1120",
                "stroke": "#E2E8F0", "strokeWidth": 1.5 },
      "encoding": { "x": { "field": "pctAcum", "type": "quantitative", "scale": { "domain": [0, 1] } } } },

    { "mark": { "type": "text", "dx": 14, "fontSize": 9, "fontWeight": "bold", "color": "#F2F6FF" },
      "encoding": {
        "x": { "field": "pctAcum", "type": "quantitative", "scale": { "domain": [0, 1] } },
        "text": { "field": "pctAcum", "type": "quantitative", "format": ".1%" }
      } }
  ],
  "resolve": { "scale": { "x": "independent", "color": "independent" } },
  "config": { "…cole o config comum aqui…" }
}
```

Pontos de atenção:
- `resolve.scale.x = "independent"` é obrigatório — as barras estão em R$ e a curva em %; sem isso o Vega-Lite unifica a escala e a curva (que vai de 0 a 1) vira um risco colado na origem.
- A ordenação do eixo Y usa o campo `rank` calculado no `window`, não `{"op":"sum"}` no `Faturamento` — com escalas independentes o Vega-Lite descarta silenciosamente o sort por agregação e as barras saem em ordem alfabética.
- As classes A/B/C saem da **curva acumulada**, não de uma coluna do modelo. Se o usuário já tiver uma coluna `Classe` no modelo, remova o `calculate` e use o campo dele — mas confira se a regra bate (80/95 é a convenção).
- Para o Pareto **horizontal** clássico (colunas + curva em cima), troque os papéis de `x`/`y` e mantenha o `resolve` no `y`.

---

## 3. Donut segmentado com foto do vendedor

Campos: `Vendedor`, `Valor`, `Foto` (coluna com URL da imagem, categoria de dados **URL da Imagem** no modelo).

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "background": null,
  "width": 300, "height": 300,
  "data": { "name": "dataset" },
  "transform": [
    { "window": [ { "op": "sum", "field": "Valor", "as": "acum" } ],
      "sort": [ { "field": "Valor", "order": "descending" } ] },
    { "joinaggregate": [ { "op": "sum", "field": "Valor", "as": "total" } ] },
    { "calculate": "2 * PI * (datum.acum - datum.Valor) / datum.total", "as": "a0" },
    { "calculate": "2 * PI * datum.acum / datum.total", "as": "a1" },
    { "calculate": "(datum.a0 + datum.a1) / 2", "as": "aMid" },
    { "calculate": "150 + 148 * sin(datum.aMid)", "as": "px" },
    { "calculate": "150 + 148 * cos(datum.aMid)", "as": "py" },
    { "calculate": "150 + 176 * sin(datum.aMid)", "as": "tx" },
    { "calculate": "150 + 176 * cos(datum.aMid)", "as": "ty" },
    { "calculate": "datum.Valor / datum.total", "as": "pct" }
  ],
  "layer": [
    { "mark": { "type": "arc", "innerRadius": 92, "outerRadius": 110,
                "cornerRadius": 8, "padAngle": 0.035 },
      "encoding": {
        "theta":  { "field": "a0", "type": "quantitative", "scale": null },
        "theta2": { "field": "a1" },
        "color": { "field": "Valor", "type": "quantitative",
                   "scale": { "range": ["#0E4F5C", "#22D3EE"] }, "legend": null }
      } },
    { "mark": { "type": "image", "width": 44, "height": 44 },
      "encoding": {
        "x": { "field": "px", "type": "quantitative", "scale": { "domain": [0, 300] }, "axis": null },
        "y": { "field": "py", "type": "quantitative", "scale": { "domain": [0, 300] }, "axis": null },
        "url": { "field": "Foto", "type": "nominal" }
      } },
    { "mark": { "type": "text", "fontSize": 11, "fontWeight": "bold", "color": "#F2F6FF", "dy": 34 },
      "encoding": {
        "x": { "field": "tx", "type": "quantitative", "scale": { "domain": [0, 300] } },
        "y": { "field": "ty", "type": "quantitative", "scale": { "domain": [0, 300] } },
        "text": { "field": "pct", "type": "quantitative", "format": ".1%" }
      } }
  ],
  "resolve": { "scale": { "x": "shared", "y": "shared" } },
  "config": { "…cole o config comum aqui…" }
}
```

Como funciona: o `arc` fica centrado sozinho (150,150 num canvas 300×300); as fotos e os rótulos são posicionados **em coordenadas calculadas** a partir do ângulo médio de cada fatia (`sin`/`cos`). Por isso os dois usam a mesma escala 0–300 — é o que faz a foto pousar exatamente sobre o arco dela.

Limitação honesta: o mark `image` do Vega **não recorta em círculo**. As fotos precisam já estar redondas com fundo transparente (PNG). Se as fotos vierem quadradas, ou você as trata na origem, ou usa uma medida SVG com `clipPath` (ver `svg-dax.md`) e desiste do donut Deneb.

`cornerRadius: 8` + `padAngle: 0.035` são o que criam aquele visual de "segmentos flutuantes" em vez de uma rosca contínua.

---

## 4. Bullet de meta (o "76% · Meta 100%")

Campo: `Atingimento` (medida entre 0 e ~1,3). Dataset de **uma linha**.

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "background": null,
  "width": 380, "height": 90,
  "data": { "name": "dataset" },
  "layer": [
    { "mark": { "type": "bar", "height": 14, "cornerRadius": 7, "color": "#1B2439" },
      "encoding": { "x": { "value": 0 }, "x2": { "value": 380 }, "y": { "value": 70 } } },

    { "mark": { "type": "bar", "height": 14, "cornerRadius": 7 },
      "encoding": {
        "x": { "field": "Atingimento", "type": "quantitative",
               "scale": { "domain": [0, 1.3], "range": [0, 380] }, "axis": null },
        "y": { "value": 70 },
        "color": {
          "condition": [
            { "test": "datum.Atingimento >= 1",   "value": "#34D399" },
            { "test": "datum.Atingimento >= 0.9", "value": "#FBBF24" }
          ],
          "value": "#F1607E"
        }
      } },

    { "mark": { "type": "rule", "color": "#F2F6FF", "strokeWidth": 2 },
      "encoding": {
        "x": { "datum": 1, "type": "quantitative", "scale": { "domain": [0, 1.3], "range": [0, 380] } },
        "y": { "value": 56 }, "y2": { "value": 84 }
      } },

    { "mark": { "type": "point", "shape": "triangle-down", "filled": true,
                "size": 220, "color": "#CBD5E1" },
      "encoding": {
        "x": { "field": "Atingimento", "type": "quantitative", "scale": { "domain": [0, 1.3], "range": [0, 380] } },
        "y": { "value": 48 }
      } },

    { "mark": { "type": "text", "fontSize": 34, "fontWeight": 300, "color": "#F2F6FF", "align": "center" },
      "encoding": {
        "x": { "field": "Atingimento", "type": "quantitative", "scale": { "domain": [0, 1.3], "range": [0, 380] } },
        "y": { "value": 18 },
        "text": { "field": "Atingimento", "type": "quantitative", "format": ".0%" }
      } }
  ],
  "config": { "…cole o config comum aqui…" }
}
```

A `rule` branca na posição 1 é a meta. Trava o `domain` em `[0, 1.3]` — deixar o Vega escolher o domínio faz a meta "andar" de página em página, e a comparação visual entre relatórios morre.

---

## Checklist antes de entregar uma spec

- [ ] `"background": null` presente
- [ ] Nomes de campo batem com as medidas/colunas reais do usuário
- [ ] `config` comum colado (senão vêm eixos brancos e gridlines)
- [ ] Nenhuma escala com domínio automático em métrica comparável entre páginas
- [ ] `resolve.scale` declarado em todo gráfico com duas unidades
- [ ] Testado com 1 categoria e com 20 categorias (specs quebram bonito nos extremos)
