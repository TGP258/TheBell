"""Generate splash images from the rendered logo.

Icons themselves come from `scripts/logo.py` + `scripts/render_icons.mjs`;
this script only composes the launch screens so the brand stays consistent.

Run from the project root:
    python scripts/generate_assets.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"
LOGO_PATH = ROOT / "resources" / "logo.png"

BG = (244, 244, 247)
INK = (19, 19, 22)
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"


def splash(width: int, height: int) -> Image.Image:
    image = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(image)

    mark = int(min(width, height) * 0.34)
    logo = Image.open(LOGO_PATH).convert("RGBA").resize((mark, mark), Image.LANCZOS)
    x = (width - mark) // 2
    y = int(height * 0.5 - mark * 0.7)
    image.paste(logo, (x, y), logo)

    text = "TheBell"
    font_size = max(18, int(mark * 0.19))
    try:
        font = ImageFont.truetype(FONT_BOLD, font_size)
    except OSError:
        font = ImageFont.load_default()
    box = draw.textbbox((0, 0), text, font=font)
    tw = box[2] - box[0]
    draw.text(
        ((width - tw) / 2 - box[0], y + mark * 0.92),
        text,
        font=font,
        fill=INK,
    )
    return image


def main() -> None:
    ios_splash = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset"
    if ios_splash.exists():
        for name in (
            "splash-2732x2732.png",
            "splash-2732x2732-1.png",
            "splash-2732x2732-2.png",
        ):
            splash(2732, 2732).save(ios_splash / name)

    for path in RES.glob("drawable-port-*/splash.png"):
        splash(*Image.open(path).size).save(path)
    for path in RES.glob("drawable-land-*/splash.png"):
        splash(*Image.open(path).size).save(path)
    base = Image.open(RES / "drawable" / "splash.png").size
    splash(*base).save(RES / "drawable" / "splash.png")

    print("splashes generated")


if __name__ == "__main__":
    main()
