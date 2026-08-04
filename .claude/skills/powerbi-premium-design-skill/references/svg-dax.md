# Medidas SVG em DAX

Para o que vive **dentro de uma célula** de tabela/matriz — onde o Deneb não alcança: barra de progresso, sparkline, pílula de status, anel de percentual, avatar redondo.

## Como funciona

1. Crie a medida retornando uma string SVG embutida num data URI.
2. Vá em **Modelagem → Categoria de Dados → URL da Imagem**.
3. Arraste a medida para uma coluna da tabela/matriz. Ajuste a altura da linha e a largura da coluna.

Padrão do wrapper (use sempre este; o `xmlns` é obrigatório e o `preserveAspectRatio` evita distorção):

```dax
VAR SvgPrefix = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20' preserveAspectRatio='xMidYMid meet'>"
VAR SvgSuffix = "</svg>"
```

Use **aspas simples** dentro do SVG (as duplas quebram a string DAX) e **não** use `#` direto em cores — `#` no data URI pode ser interpretado como âncora. Duas saídas: escapar como `%23`, ou usar `rgb(34,211,238)`. Prefira `rgb()`, é mais legível e nunca falha.

---

## 1. Barra de progresso (atingimento de meta)

```dax
Barra Meta =
VAR Pct     = MIN( DIVIDE( [Realizado], [Meta] ), 1.25 )
VAR Largura = Pct * 80          -- 80px = 100% da meta; sobra espaço para o estouro
VAR Cor     =
    SWITCH( TRUE(),
        Pct >= 1,   "rgb(52,211,153)",
        Pct >= 0.9, "rgb(251,191,36)",
                    "rgb(241,96,126)" )
VAR Svg =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20'>" &
        "<rect x='0' y='7' width='80' height='6' rx='3' fill='rgb(27,36,57)'/>" &
        "<rect x='0' y='7' width='" & Largura & "' height='6' rx='3' fill='" & Cor & "'/>" &
        "<line x1='80' y1='4' x2='80' y2='16' stroke='rgb(143,160,191)' stroke-width='1'/>" &
        "<text x='100' y='14' font-size='9' font-family='Segoe UI' fill='rgb(203,213,225)' text-anchor='end'>" &
            FORMAT( Pct, "0%" ) & "</text>" &
    "</svg>"
RETURN Svg
```

A linha vertical em x=80 é a meta. Sem ela, uma barra a 95% e outra a 105% parecem a mesma coisa.

---

## 2. Pílula de status

```dax
Pílula Status =
VAR Pct   = DIVIDE( [Realizado], [Meta] )
VAR Txt   = SWITCH( TRUE(), Pct >= 1, "ACIMA", Pct >= 0.9, "NA META", "ABAIXO" )
VAR Fundo = SWITCH( TRUE(), Pct >= 1, "rgb(14,59,51)",  Pct >= 0.9, "rgb(61,49,19)",  "rgb(61,23,37)" )
VAR Cor   = SWITCH( TRUE(), Pct >= 1, "rgb(52,211,153)", Pct >= 0.9, "rgb(251,191,36)", "rgb(241,96,126)" )
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 24'>" &
        "<rect x='2' y='4' width='86' height='16' rx='8' fill='" & Fundo & "'/>" &
        "<text x='45' y='15.5' font-size='9' font-weight='600' letter-spacing='0.6' " &
            "font-family='Segoe UI' fill='" & Cor & "' text-anchor='middle'>" & Txt & "</text>" &
    "</svg>"
```

---

## 3. Sparkline

Precisa concatenar os pontos. O padrão é `CONCATENATEX` sobre a dimensão de tempo, normalizando para a viewBox:

```dax
Sparkline =
VAR Meses   = VALUES( dCalendario[MesNum] )
VAR Serie   = ADDCOLUMNS( Meses, "@v", CALCULATE( [Receita] ) )
VAR Min     = MINX( Serie, [@v] )
VAR Max     = MAXX( Serie, [@v] )
VAR N       = COUNTROWS( Serie )
VAR Pontos  =
    CONCATENATEX(
        ADDCOLUMNS(
            Serie,
            "@x", DIVIDE( [MesNum] - 1, N - 1 ) * 100,
            "@y", 20 - DIVIDE( [@v] - Min, Max - Min ) * 18
        ),
        [@x] & "," & [@y],
        " ",
        [MesNum], ASC
    )
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20'>" &
        "<polyline points='" & Pontos & "' fill='none' stroke='rgb(34,211,238)' " &
            "stroke-width='1.5' stroke-linejoin='round' stroke-linecap='round'/>" &
    "</svg>"
```

Para o **degradê embaixo da sparkline** (mesmo efeito do Deneb, dentro da tabela): adicione um `<defs>` com `linearGradient` e um `<polygon>` fechando a série até a base:

```
"<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>" &
  "<stop offset='0%' stop-color='rgb(34,211,238)' stop-opacity='0.5'/>" &
  "<stop offset='100%' stop-color='rgb(34,211,238)' stop-opacity='0'/>" &
"</linearGradient></defs>" &
"<polygon points='0,20 " & Pontos & " 100,20' fill='url(%23g)'/>"
```

Note o `url(%23g)` — aqui o `#` **precisa** virar `%23`, senão o navegador do Service não resolve a referência ao gradiente e a área some (a linha continua aparecendo, o que torna o bug bem difícil de perceber).

---

## 4. Avatar redondo

O que o Deneb não faz. `clipPath` recorta a foto em círculo:

```dax
Avatar =
VAR Url = SELECTEDVALUE( dVendedor[FotoURL] )
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 48 48'>" &
        "<defs><clipPath id='c'><circle cx='24' cy='24' r='22'/></clipPath></defs>" &
        "<circle cx='24' cy='24' r='23' fill='none' stroke='rgb(34,211,238)' stroke-width='2'/>" &
        "<image href='" & Url & "' x='2' y='2' width='44' height='44' clip-path='url(%23c)' preserveAspectRatio='xMidYMid slice'/>" &
    "</svg>"
```

Cuidado: `<image href>` com URL externa **não renderiza** em alguns contextos do Power BI Service (política de conteúdo). Se sumir, converta a foto para base64 e embuta (`href='data:image/png;base64,...'`) — funciona sempre, mas o modelo engorda. Teste no Service, não só no Desktop.

---

## Limites que você deve avisar ao usuário

- SVG measure **não é interativo**: não tem tooltip nem cross-filter.
- Não escala com o zoom do usuário como um visual nativo; defina viewBox e deixe a coluna larga o suficiente.
- Strings SVG muito longas (sparkline com 365 pontos) pesam no render da tabela. Agregue por mês/semana.
- Se aparecer o ícone de imagem quebrada: 99% das vezes é aspas duplas dentro do SVG, `#` não escapado, ou a categoria de dados não está como URL da Imagem.
