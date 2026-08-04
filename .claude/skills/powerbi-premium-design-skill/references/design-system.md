# Design System — Dark Premium

Tokens do tema. Tudo aqui já está codificado em `assets/tema-dark-premium.json`; esta página existe para você saber *por que* cada valor é o que é, e para poder trocar de acento sem quebrar o conjunto.

## Cores estruturais

| Token | Hex | Onde |
|---|---|---|
| `bg/deep` | `#0B1120` | Papel de parede (wallpaper) |
| `bg/aurora-a` | acento @ 18% | Mancha de luz superior-esquerda |
| `bg/aurora-b` | acento-2 @ 12% | Mancha inferior-direita |
| `surface/card` | `#131B2E` | Fundo dos cards (com transparência 15%) |
| `surface/raised` | `#1B2439` | Rail de navegação, slicers, hover |
| `border/hair` | `#2A3550` | Borda 1px de todo card |
| `text/primary` | `#F2F6FF` | Valor de KPI, números da tabela |
| `text/secondary` | `#8FA0BF` | Título de visual, rótulo de eixo, legenda |
| `text/muted` | `#5C6C8A` | Subtítulo, nota de rodapé |

Contraste: `text/secondary` sobre `surface/card` dá ~4.6:1 (passa AA para texto normal). Não desça de `#8FA0BF` para rótulos — abaixo disso vira decoração ilegível em projetor.

## Acento (escolha UM)

| Nome | Principal | Claro (glow/gradiente) | Uso |
|---|---|---|---|
| **Cyan** (padrão) | `#22D3EE` | `#67E8F9` | Analítico, tech, o print "Performance" |
| **Ember** | `#F2681F` | `#FF9457` | Vendas, urgência, o print "Pareto" |
| **Violet** | `#8B5CF6` | `#C4B5FD` | Executivo, marca premium |
| **Lime** | `#A3E635` | `#D9F99D` | Operações, indústria |

O acento-2 (para o degradê da aurora e a segunda série) é sempre o **vizinho frio** do acento: cyan→`#3B82F6`, ember→`#F0B429`, violet→`#22D3EE`, lime→`#22D3EE`.

## Semântica (nunca use o acento para isso)

| Estado | Cor | Fundo da pílula |
|---|---|---|
| Positivo / acima da meta | `#34D399` | `#0E3B33` |
| Neutro / na meta | `#FBBF24` | `#3D3113` |
| Negativo / abaixo | `#F1607E` | `#3D1725` |

Motivo de separar: se verde/vermelho também são cores de série, o leitor perde a leitura de "bom/ruim" em meio segundo — que é justamente o único trabalho dessas cores.

## Escala neutra para séries sem significado

`#64748B` → `#94A3B8` → `#CBD5E1`. Use quando a categoria não tem hierarquia (ex.: fatias C do Pareto). No print do Pareto, note: só as barras da classe A recebem cor. O resto é cinza. **Isso é o design**, não uma economia.

## Tipografia

Família: **Segoe UI** (sempre disponível). Se a marca exigir outra, use `DIN`, `Inter` ou `Poppins` — mas confirme que a fonte está instalada em *todas* as máquinas, senão o Service faz fallback e o layout quebra.

| Elemento | Tamanho | Peso | Cor |
|---|---|---|---|
| Título da página | 28px | Light (300) | `#F2F6FF` |
| Subtítulo da página | 13px | Regular | `#5C6C8A` |
| Título de visual | 11px | Semibold | `#8FA0BF` |
| Valor de KPI herói | 36–44px | Light | acento |
| Valor de KPI normal | 24px | Semibold | `#F2F6FF` |
| Rótulo de KPI | 10px | Regular, caixa alta, +0.5px tracking | `#5C6C8A` |
| Rótulo de dado no gráfico | 10px | Semibold | `#F2F6FF` |
| Eixo | 10px | Regular | `#5C6C8A` |
| Tabela — dado | 11px | Regular | `#CBD5E1` |
| Tabela — cabeçalho | 10px | Semibold, caixa alta | `#5C6C8A` |

Detalhe que faz diferença: número grande em peso **Light**, não Bold. Bold em 40px vira bloco. Light em 40px vira arquitetura — é o que os dois prints fazem.

## Espaçamento

Escala de 4: `4 · 8 · 12 · 16 · 24 · 32`. Padding interno de card: 16px. Gap entre cards: 12px. Margem da página: 24px. Nada fora dessa escala.

## Raio e efeitos

- Raio: **12px** em cards, 8px em slicers, 999px em pílulas.
- Sombra: preta, blur 14, spread 6, transparência **60%**, posição externa. Nunca abaixo de 50% — a sombra é para separar do fundo, não para ser vista.
- Glow: só no elemento herói. Cor = acento, transparência 55%, tamanho 10.
