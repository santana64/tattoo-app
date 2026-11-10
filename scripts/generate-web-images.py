"""Regenerates the web icons and the social preview card in public/.

Run from the project root after changing the app icon or the tagline:
    python scripts/generate-web-images.py
Requires Pillow (pip install pillow).
"""
import glob

from PIL import Image, ImageDraw, ImageFont

WALL = (11, 10, 9)        # Colors.bgPrimary
PAPER = (244, 239, 230)   # Colors.textPrimary
BRASS = (201, 164, 106)   # Colors.accentWarm
GLOW = (221, 187, 130)    # Colors.accentGlow
MUTED = (168, 160, 148)
RULE = (48, 44, 38)


def font(pattern: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(glob.glob(pattern)[0], size)


def icons() -> None:
    icon = Image.open('assets/images/icon.png').convert('RGBA')
    for name, size in (('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)):
        resized = icon.resize((size, size), Image.LANCZOS)
        canvas = Image.new('RGB', (size, size), WALL)
        canvas.paste(resized, (0, 0), resized)
        canvas.save(f'public/{name}', optimize=True)


def social_card() -> None:
    width, height = 1200, 630
    card = Image.new('RGB', (width, height), WALL)
    draw = ImageDraw.Draw(card)

    # Soft warm light from the top-left corner, like the gallery wall in the app.
    for radius in range(700, 0, -10):
        lift = int(26 * (1 - radius / 700) ** 2)
        colour = (WALL[0] + lift, WALL[1] + int(lift * 0.8), WALL[2] + int(lift * 0.5))
        draw.ellipse([150 - radius, -80 - radius, 150 + radius, -80 + radius], fill=colour)

    serif = 'node_modules/@expo-google-fonts/instrument-serif/400Regular/*.ttf'
    serif_italic = 'node_modules/@expo-google-fonts/instrument-serif/400Regular_Italic/*.ttf'
    sans = 'node_modules/@expo-google-fonts/geist/500Medium/*.ttf'

    draw.text((80, 70), 'Inkr.', font=font(serif, 56), fill=PAPER)
    draw.text((80, 215), 'TATOUEURS  ·  STUDIOS  ·  GUEST SPOTS', font=font(sans, 22), fill=BRASS)
    draw.text((80, 265), 'Trouvez l’artiste', font=font(serif, 104), fill=PAPER)
    draw.text((80, 375), 'qui vous ressemble.', font=font(serif_italic, 104), fill=GLOW)
    draw.line([(80, 540), (1120, 540)], fill=RULE, width=1)
    draw.text(
        (80, 560),
        'Portfolios par style et par ville — confiez votre projet directement à l’artiste.',
        font=font(sans, 24),
        fill=MUTED,
    )
    card.save('public/og-image.png', optimize=True)


if __name__ == '__main__':
    icons()
    social_card()
