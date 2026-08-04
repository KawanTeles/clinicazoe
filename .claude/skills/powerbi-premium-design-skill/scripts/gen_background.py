#!/usr/bin/env python3
"""
Gera o papel de parede (wallpaper) do tema Dark Premium: base grafite,
duas manchas de luz difusas (aurora) na diagonal e vinheta nas bordas.

Substitui o Figma. Sem dependência além de Pillow + numpy.

    pip install pillow numpy
    python gen_background.py --out fundo.png --accent "#22D3EE" --accent2 "#3B82F6"

Opções úteis:
    --size 1280x720        resolução do canvas (padrão 1920x1080)
    --base "#0B1120"       cor de fundo
    --intensity 0.22       força das auroras (0.10 discreto ... 0.35 forte)
    --rail 72              desenha o trilho de navegação à esquerda (0 = não desenhar)
"""

import argparse
import numpy as np
from PIL import Image, ImageFilter


def hex_to_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)


def radial(w, h, cx, cy, radius):
    """Máscara radial suave (falloff quadrático) centrada em cx,cy (0-1)."""
    yy, xx = np.mgrid[0:h, 0:w]
    dx = (xx - cx * w) / (radius * w)
    dy = (yy - cy * h) / (radius * w)   # radius em fração da largura: mantém o círculo redondo
    d = np.sqrt(dx ** 2 + dy ** 2)
    m = np.clip(1.0 - d, 0.0, 1.0)
    return m ** 2


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="fundo.png")
    p.add_argument("--size", default="1920x1080")
    p.add_argument("--base", default="#0B1120")
    p.add_argument("--accent", default="#22D3EE")
    p.add_argument("--accent2", default="#3B82F6")
    p.add_argument("--intensity", type=float, default=0.22)
    p.add_argument("--rail", type=int, default=0)
    p.add_argument("--noise", type=float, default=2.5, help="grão sutil; evita banding em telas grandes")
    a = p.parse_args()

    w, h = (int(v) for v in a.size.lower().split("x"))
    base = hex_to_rgb(a.base)
    c1 = hex_to_rgb(a.accent)
    c2 = hex_to_rgb(a.accent2)

    img = np.zeros((h, w, 3), dtype=float) + base

    # Aurora A: superior-esquerda. Aurora B: inferior-direita. A diagonal cria o
    # eixo de leitura do olho; manchas simétricas achatam a página.
    m1 = radial(w, h, 0.18, 0.12, 0.55)[..., None]
    m2 = radial(w, h, 0.88, 0.85, 0.60)[..., None]
    img = img + m1 * (c1 - base) * a.intensity
    img = img + m2 * (c2 - base) * (a.intensity * 0.75)

    # Vinheta: escurece as bordas para "empurrar" o conteúdo pra frente.
    vig = 1.0 - radial(w, h, 0.5, 0.5, 1.15)
    img = img * (1.0 - 0.35 * vig[..., None])

    if a.noise > 0:
        rng = np.random.default_rng(7)
        img = img + rng.normal(0, a.noise, (h, w, 1))

    img = np.clip(img, 0, 255).astype(np.uint8)
    out = Image.fromarray(img).filter(ImageFilter.GaussianBlur(radius=1.2))

    if a.rail > 0:
        # trilho lateral levemente mais claro que a base
        rail = np.array(out)
        rail[:, :a.rail] = np.clip(rail[:, :a.rail] * 1.18 + 6, 0, 255)
        out = Image.fromarray(rail.astype(np.uint8))

    out.save(a.out, "PNG", optimize=True)
    print(f"gerado: {a.out}  ({w}x{h})")
    print("Aplicar: Exibição > Papel de parede > Imagem > Ajuste: Ajustar > Transparência 0%")
    print("Depois:  Plano de fundo da página > Transparência 100%")


if __name__ == "__main__":
    main()
