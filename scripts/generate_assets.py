"""Generate launcher icons and splash images for TheBell.

Requires Pillow. Run from the project root:
    python scripts/generate_assets.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"

VIOLET = (91, 75, 240)
PURPLE = (168, 85, 247)
BG = (244, 244, 247)
INK = (19, 19, 22)

FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"


def gradient(size: int) -> Image.Image:
    small = Image.new("RGB", (128, 128))
    pixels = small.load()
    for y in range(128):
        for x in range(128):
            t = min(1.0, (x / 127) * 0.55 + (y / 127) * 0.45)
            pixels[x, y] = tuple(
                round(VIOLET[i] + (PURPLE[i] - VIOLET[i]) * t) for i in range(3)
            )
    return small.resize((size, size), Image.LANCZOS)


def draw_check(draw: ImageDraw.ImageDraw, size: int, scale: float = 1.0) -> None:
    width = max(2, int(size * 0.075 * scale))
    points = [
        (size * 0.285, size * 0.53),
        (size * 0.435, size * 0.675),
        (size * 0.725, size * 0.36),
    ]
    draw.line(points, fill=(255, 255, 255, 255), width=width, joint="curve")
    radius = width / 2
    for x, y in (points[0], points[1], points[2]):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(255, 255, 255, 255))


def rounded_icon(size: int, radius_ratio: float = 0.235) -> Image.Image:
    image = gradient(size).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=int(size * radius_ratio), fill=255
    )
    image.putalpha(mask)
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse(
        (size * 0.08, -size * 0.35, size * 0.95, size * 0.5),
        fill=(255, 255, 255, 26),
    )
    image = Image.alpha_composite(image, glow)
    draw_check(ImageDraw.Draw(image), size)
    return image


def circle_icon(size: int) -> Image.Image:
    image = gradient(size).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    image.putalpha(mask)
    draw_check(ImageDraw.Draw(image), size)
    return image


def square_icon(size: int) -> Image.Image:
    image = gradient(size).convert("RGBA")
    draw_check(ImageDraw.Draw(image), size)
    return image.convert("RGB")


def foreground(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw_check(ImageDraw.Draw(image), size, scale=0.92)
    return image


def splash(width: int, height: int) -> Image.Image:
    image = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(image)
    mark = int(min(width, height) * 0.22)
    icon = rounded_icon(mark, 0.26)
    x = (width - mark) // 2
    y = int(height * 0.5 - mark * 0.72)
    image.paste(icon, (x, y), icon)

    text = "TheBell"
    font_size = max(18, int(mark * 0.26))
    try:
        font = ImageFont.truetype(FONT_BOLD, font_size)
    except OSError:
        font = ImageFont.load_default()
    box = draw.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    draw.text(
        ((width - tw) / 2 - box[0], y + mark + mark * 0.22),
        text,
        font=font,
        fill=INK,
    )
    return image


def main() -> None:
    legacy = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    adaptive = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

    for density, size in legacy.items():
        folder = RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        rounded_icon(size).save(folder / "ic_launcher.png")
        circle_icon(size).save(folder / "ic_launcher_round.png")
    for density, size in adaptive.items():
        folder = RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        foreground(size).save(folder / "ic_launcher_foreground.png")

    (ROOT / "resources").mkdir(exist_ok=True)
    rounded_icon(1024).save(ROOT / "resources" / "icon.png")

    ios_icon = (
        ROOT
        / "ios"
        / "App"
        / "App"
        / "Assets.xcassets"
        / "AppIcon.appiconset"
        / "AppIcon-512@2x.png"
    )
    if ios_icon.parent.exists():
        square_icon(1024).save(ios_icon)

    ios_splash = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset"
    if ios_splash.exists():
        for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
            splash(2732, 2732).save(ios_splash / name)

    for path in RES.glob("drawable-port-*/splash.png"):
        size = Image.open(path).size
        splash(*size).save(path)
    for path in RES.glob("drawable-land-*/splash.png"):
        size = Image.open(path).size
        splash(*size).save(path)
    base = Image.open(RES / "drawable" / "splash.png").size
    splash(*base).save(RES / "drawable" / "splash.png")

    print("icons and splashes generated")


if __name__ == "__main__":
    main()
