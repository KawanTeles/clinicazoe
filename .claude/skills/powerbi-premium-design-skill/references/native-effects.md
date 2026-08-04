# Efeitos nativos — vidro, sombra, glow e profundidade sem Figma

Tudo aqui é Power BI puro: tema JSON + formas + papel de parede gerado por script.

## 1. O efeito "vidro" (glassmorphism) em 4 propriedades

O card dos prints não é uma imagem — é um visual com:

```json
"background": [{ "show": true, "color": { "solid": { "color": "#131B2E" } }, "transparency": 15 }],
"border":     [{ "show": true, "color": { "solid": { "color": "#2A3550" } }, "radius": 12 }],
"dropShadow": [{ "show": true, "color": { "solid": { "color": "#000000" } },
                 "position": "Outer", "preset": "Custom", "angle": 90,
                 "shadowDistance": 4, "shadowBlur": 14, "shadowSpread": 6, "transparency": 60 }],
"visualHeader": [{ "show": false }]
```

A transparência do fundo (15%) é o item crítico: é ela que deixa a aurora do papel de parede "vazar" por baixo do card e cria a sensação de vidro. Com 0% de transparência o card fica chapado e o efeito morre, por mais sombra que você coloque.

`visualHeader: show=false` some com os ícones de foco/filtro no hover — eles quebram a borda arredondada.

## 2. Glow

O glow existe no painel **Formatar visual → Efeitos → Brilho** (Desktop) e, no tema, na chave `glow`:

```json
"glow": [{ "show": true, "color": { "solid": { "color": "#22D3EE" } },
           "position": "Outer", "preset": "Custom",
           "transparency": 55, "shadowSpread": 4, "shadowBlur": 12 }]
```

> A chave `glow` foi adicionada depois de várias versões do schema de tema. Se a importação do tema reclamar dessa propriedade, remova-a do JSON e aplique o brilho manualmente em Efeitos → Brilho — o resultado visual é idêntico. Vale testar antes de entregar.

**Nunca coloque glow no `"*": "*"` do tema.** Glow é pontual: KPI herói, ícone de menu ativo, borda do card selecionado. Glow global vira neon de vitrine.

## 3. Aurora de fundo — as manchas de luz

Duas opções, ambas sem Figma:

**(a) Papel de parede gerado por script (recomendado).**
`python scripts/gen_background.py --out fundo.png --accent "#22D3EE" --accent2 "#3B82F6" --size 1920x1080`
Gera um PNG com base `#0B1120`, duas manchas radiais difusas em diagonal e uma vinheta escura nas bordas. Aplique em Exibição → Papel de parede → Imagem → Ajuste: **Ajustar** → Transparência 0%. Depois, plano de fundo da **página**: transparência **100%**.

**(b) Forma + brilho (100% dentro do PBI).**
Insira → Formas → Círculo. Preenchimento = acento, transparência **92%**. Efeitos → Brilho: cor = acento, tamanho 30+, transparência 60. Envie para trás. Dois desses, em cantos opostos, reproduzem a aurora. Vantagem: nenhum arquivo externo. Desvantagem: as formas entram na ordem de camadas e atrapalham a seleção enquanto você monta a página — deixe-as por último e trave-as no Painel de Seleção.

## 4. Rail de navegação (a barra lateral dos prints)

Não é visual, é forma + botões:
- Retângulo 72px de largura, altura total, fill `#0E1626` transparência 20%, raio 0 à esquerda / 24px à direita.
- Botões (Inserir → Botões → Em branco), ícone personalizado, sem preenchimento.
- Estado **selecionado**: preenchimento `#1B2439` + brilho no acento. Configure isso em Formatar botão → aplicar configurações a: **Selecionado**.
- Ação: Indicador de página (Bookmark) ou Navegação de página.

## 5. Camadas — a ordem que funciona

Do fundo para a frente: papel de parede → auroras (formas) → rail → cards de fundo (retângulos, se você quiser agrupar visuais) → visuais → rótulos/ícones sobrepostos. Use o **Painel de Seleção** (Exibição → Painel de Seleção) para nomear e travar. Uma página premium tem 30+ objetos; sem nomear, a manutenção é impossível.

## 6. Anti-padrões

| Sintoma | Causa | Correção |
|---|---|---|
| Cards parecem "colados" num fundo morto | transparência do fundo em 0% | 12–20% |
| Sombra virou mancha cinza suja | transparência < 45% ou blur baixo | blur 14+, transparência 60 |
| Tudo brilha, nada chama atenção | glow no wildcard do tema | glow só no herói |
| Bordas serrilhadas nos cantos | raio grande + header do visual ativo | `visualHeader.show = false` |
| Gráfico com fundo branco no meio do escuro | visual não herdou o tema (custom visual) | no Deneb, `"background": null` e config de cores do próprio spec |
