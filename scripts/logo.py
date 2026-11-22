"""TheBell logo generator.

Draws a cat-eared clock:
- white background
- blue ring (clock face)
- yellow centre pin
- minute hand pointing to 5 o'clock, continuing outside the ring as a tapered cat tail
- two slightly curved triangular ears on top

Outputs:
    resources/icon.svg            白色圆角底（应用图标主视觉）
    resources/icon-square.svg     白色方形底（商店 / iOS）
    resources/icon-round.svg      白色圆形底（旧版圆形图标）
    resources/logo.svg            透明底（启动图 / favicon）
    resources/icon-monochrome.svg 单色剪影（themed icon 预览）
"""

from __future__ import annotations

import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "resources"

SIZE = 1024
C = (512.0, 512.0)
RING_R = 276.0
RING_W = 68.0
EAR_TIP_R = 108.0
BLUE = "#2563EB"
YELLOW = "#FBBF24"
WHITE = "#FFFFFF"


# ---------------------------------------------------------------- helpers
def pt(radius: float, deg: float) -> tuple[float, float]:
    """极坐标：deg 从 12 点方向顺时针。"""
    rad = math.radians(deg)
    return (C[0] + radius * math.sin(rad), C[1] - radius * math.cos(rad))


def fmt(value: float) -> str:
    return f"{value:.2f}".rstrip("0").rstrip(".")


def n(point: tuple[float, float]) -> str:
    return f"{fmt(point[0])} {fmt(point[1])}"


def ctrl_offset(a, b, offset: float, ratio: float = 0.5):
    """a->b 连线上的点，沿法线偏移 offset。"""
    px = a[0] + (b[0] - a[0]) * ratio
    py = a[1] + (b[1] - a[1]) * ratio
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy) or 1.0
    return (px - dy / length * offset, py + dx / length * offset)


def ear_path(sign: int) -> str:
    """sign=-1 左耳，+1 右耳。

    底边沿圆环外缘画弧（不留缺口），两条边带轻微弧度收到耳尖。
    """
    center = sign * 30
    base_r = RING_R - 2
    left = pt(base_r, center - 22)
    right = pt(base_r, center + 22)
    tip = pt(RING_R + EAR_TIP_R, center)

    inner = ctrl_offset(right, tip, 2, 0.45)
    outer = ctrl_offset(tip, left, -6, 0.55)

    return (
        f"M {n(left)} "
        f"A {fmt(base_r)} {fmt(base_r)} 0 0 1 {n(right)} "
        f"Q {n(inner)} {n(tip)} "
        f"Q {n(outer)} {n(left)} "
        "Z"
    )


def catmull_rom(points, samples: int = 14):
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for step in range(samples):
            t = step / samples
            t2, t3 = t * t, t * t * t
            x = 0.5 * (
                (2 * p1[0])
                + (-p0[0] + p2[0]) * t
                + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
            )
            y = 0.5 * (
                (2 * p1[1])
                + (-p0[1] + p2[1]) * t
                + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
            )
            out.append((x, y))
    out.append(points[-1])
    return out


TAIL_POINTS = [
    pt(RING_R + 10, 150),
    (700, 796),
    (754, 802),
    (794, 772),
    (808, 722),
]
TAIL_W0 = 60.0
TAIL_W1 = 38.0


def tail_path() -> str:
    spine = catmull_rom(TAIL_POINTS, samples=12)
    total = len(spine)
    left, right = [], []
    for index, point in enumerate(spine):
        t = index / (total - 1)
        width = TAIL_W0 + (TAIL_W1 - TAIL_W0) * (t ** 1.6)
        if index == 0:
            prev, nxt = spine[0], spine[1]
        elif index == total - 1:
            prev, nxt = spine[-2], spine[-1]
        else:
            prev, nxt = spine[index - 1], spine[index + 1]
        dx, dy = nxt[0] - prev[0], nxt[1] - prev[1]
        length = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / length, dx / length
        left.append((point[0] + nx * width / 2, point[1] + ny * width / 2))
        right.append((point[0] - nx * width / 2, point[1] - ny * width / 2))

    # 圆头：以尾端为圆心补半圆
    tip = spine[-1]
    px, py = spine[-2]
    dx, dy = tip[0] - px, tip[1] - py
    base_angle = math.atan2(dy, dx)
    radius = TAIL_W1 / 2
    cap = []
    for step in range(1, 8):
        angle = base_angle + math.pi / 2 - math.pi * step / 8
        cap.append((tip[0] + math.cos(angle) * radius, tip[1] + math.sin(angle) * radius))

    parts = [f"M {n(left[0])}"]
    for point in left[1:]:
        parts.append(f"L {n(point)}")
    for point in cap:
        parts.append(f"L {n(point)}")
    for point in reversed(right):
        parts.append(f"L {n(point)}")
    parts.append("Z")
    return " ".join(parts)


def ring_path() -> str:
    """圆环用两段圆弧画出闭合路径，stroke 渲染。"""
    top = (C[0], C[1] - RING_R)
    bottom = (C[0], C[1] + RING_R)
    return (
        f"M {n(top)} "
        f"A {fmt(RING_R)} {fmt(RING_R)} 0 1 1 {n(bottom)} "
        f"A {fmt(RING_R)} {fmt(RING_R)} 0 1 1 {n(top)} Z"
    )


def hand(deg: float, length: float) -> tuple[tuple[float, float], tuple[float, float]]:
    return C, pt(length, deg)


def build_shapes(color_blue=BLUE, color_yellow=YELLOW, with_pin=True):
    """几何图形列表：SVG 与 Android Vector 共用同一份数据。"""
    minute_a, minute_b = hand(150, RING_R + 20)
    hour_a, hour_b = hand(300, 150)
    shapes = [
        {"id": "ring", "kind": "ring", "d": ring_path(), "w": RING_W, "color": color_blue},
        {"id": "ear-left", "kind": "ear", "d": ear_path(-1), "w": 20, "color": color_blue},
        {"id": "ear-right", "kind": "ear", "d": ear_path(1), "w": 20, "color": color_blue},
        {
            "id": "hand-hour",
            "kind": "hand",
            "d": f"M {n(hour_a)} L {n(hour_b)}",
            "w": 52,
            "color": color_blue,
        },
        {
            "id": "hand-minute",
            "kind": "hand",
            "d": f"M {n(minute_a)} L {n(minute_b)}",
            "w": 46,
            "color": color_blue,
        },
        {"id": "cat-tail", "kind": "tail", "d": tail_path(), "color": color_blue},
    ]
    if with_pin:
        shapes.append({"id": "center-pin", "kind": "pin", "color": color_yellow})
    return shapes


def svg_from_shapes(shapes) -> str:
    """输出带分组的 SVG：每个部件一个 <g id>，方便二次编辑。"""
    out = []
    for shape in shapes:
        kind = shape["kind"]
        color = shape["color"]
        if kind == "pin":
            body = f'<circle cx="{fmt(C[0])}" cy="{fmt(C[1])}" r="38" fill="{color}"/>'
        elif kind == "ring":
            body = (
                f'<path d="{shape["d"]}" fill="none" stroke="{color}" '
                f'stroke-width="{fmt(shape["w"])}"/>'
            )
        elif kind == "ear":
            if shape["w"] > 0:
                body = (
                    f'<path d="{shape["d"]}" fill="{color}" stroke="{color}" '
                    f'stroke-width="{fmt(shape["w"])}" stroke-linejoin="round"/>'
                )
            else:
                body = f'<path d="{shape["d"]}" fill="{color}"/>'
        elif kind == "hand":
            body = (
                f'<path d="{shape["d"]}" fill="none" stroke="{color}" '
                f'stroke-width="{fmt(shape["w"])}" stroke-linecap="round"/>'
            )
        else:
            body = f'<path d="{shape["d"]}" fill="{color}"/>'
        out.append(f'<g id="{shape["id"]}">\n    {body}\n  </g>')
    return "\n  ".join(out)


def wrap(
    body: str,
    background: str,
    scale: float = 1.0,
    title: str = "TheBell 应用图标",
    desc: str = "猫耳时钟：蓝色圆环 + 黄色轴心，分针指向 5 点后延伸为猫尾，环顶两只带弧度的猫耳。",
) -> str:
    if scale != 1.0:
        body = (
            f'<g transform="translate(512 512) scale({scale}) translate(-512 -512)">\n'
            f"  {body}\n"
            "</g>"
        )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" '
        'width="1024" height="1024">\n'
        f"  <title>{title}</title>\n"
        f"  <desc>{desc}</desc>\n"
        f"  {background}\n"
        f"  {body}\n"
        "</svg>\n"
    )


# ---------------------------------------------------------------- android
TARGET_DP = 108
SAFE_RADIUS = 32.0


def art_extent() -> float:
    """所有图形（含描边）离圆心的最大距离，用于自适应图标的安全区缩放。"""
    extent = RING_R + RING_W / 2
    extent = max(extent, RING_R + EAR_TIP_R + 4)
    spine = catmull_rom(TAIL_POINTS, samples=12)
    total = len(spine)
    for index, point in enumerate(spine):
        t = index / (total - 1)
        width = TAIL_W0 + (TAIL_W1 - TAIL_W0) * (t ** 1.6)
        extent = max(extent, math.hypot(point[0] - C[0], point[1] - C[1]) + width / 2)
    return extent


def scale_for_adaptive() -> float:
    return SAFE_RADIUS / art_extent()


def to_target(value: float, k: float) -> float:
    return TARGET_DP / 2 + (value - 512) * k


def transform_path(path: str, k: float) -> str:
    """把 1024 坐标系的绝对路径缩放到 108dp 视口。"""
    import re

    parts = re.findall(r"([MLQAZ])([^MLQAZ]*)", path)
    chunks = []
    for cmd, args in parts:
        nums = [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", args)]
        if cmd == "Z":
            chunks.append("Z")
            continue
        if cmd == "A":
            rx, ry, rot, large, sweep, x, y = nums
            chunks.append(
                f"A {rx * k:.3f} {ry * k:.3f} {rot:.0f} {large:.0f} {sweep:.0f} "
                f"{to_target(x, k):.3f} {to_target(y, k):.3f}"
            )
        else:
            pairs = [
                f"{to_target(nums[i], k):.3f} {to_target(nums[i + 1], k):.3f}"
                for i in range(0, len(nums), 2)
            ]
            chunks.append(cmd + " " + " ".join(pairs))
    return " ".join(chunks)


def pin_path(k: float) -> str:
    radius = 29 * k
    cx = to_target(C[0], k)
    cy = to_target(C[1], k)
    return (
        f"M {cx - radius:.3f} {cy:.3f} "
        f"A {radius:.3f} {radius:.3f} 0 1 0 {cx + radius:.3f} {cy:.3f} "
        f"A {radius:.3f} {radius:.3f} 0 1 0 {cx - radius:.3f} {cy:.3f} Z"
    )


def vector_xml(shapes, tint: str | None = None) -> str:
    k = scale_for_adaptive()
    lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<!-- Generated by scripts/logo.py. 108dp adaptive icon foreground. -->",
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
        '    android:width="108dp"',
        '    android:height="108dp"',
        '    android:viewportWidth="108"',
        '    android:viewportHeight="108">',
    ]
    for shape in shapes:
        kind = shape["kind"]
        color = tint or shape["color"]
        if kind == "pin":
            lines.append(
                f'    <path\n        android:fillColor="{color}"\n'
                f'        android:pathData="{pin_path(k)}" />'
            )
            continue
        d = transform_path(shape["d"], k)
        if kind == "tail":
            lines.append(
                f'    <path\n        android:fillColor="{color}"\n'
                f'        android:pathData="{d}" />'
            )
        elif kind == "ear":
            if shape["w"] > 0:
                lines.append(
                    f'    <path\n        android:fillColor="{color}"\n'
                    f'        android:strokeColor="{color}"\n'
                    f'        android:strokeWidth="{shape["w"] * k:.3f}"\n'
                    f'        android:strokeLineJoin="round"\n'
                    f'        android:pathData="{d}" />'
                )
            else:
                lines.append(
                    f'    <path\n        android:fillColor="{color}"\n'
                    f'        android:pathData="{d}" />'
                )
        elif kind == "hand":
            lines.append(
                f'    <path\n        android:fillColor="#00000000"\n'
                f'        android:strokeColor="{color}"\n'
                f'        android:strokeWidth="{shape["w"] * k:.3f}"\n'
                f'        android:strokeLineCap="round"\n'
                f'        android:pathData="{d}" />'
            )
        else:
            lines.append(
                f'    <path\n        android:fillColor="#00000000"\n'
                f'        android:strokeColor="{color}"\n'
                f'        android:strokeWidth="{shape["w"] * k:.3f}"\n'
                f'        android:pathData="{d}" />'
            )
    lines.append("</vector>")
    return "\n".join(lines) + "\n"


BACKGROUND_XML = """<?xml version="1.0" encoding="utf-8"?>
<!-- 纯白底，符合自适应图标 background 图层规范 -->
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#FFFFFF" />
</shape>
"""

ADAPTIVE_XML = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />
</adaptive-icon>
"""


def main() -> None:
    RES.mkdir(exist_ok=True)
    shapes = build_shapes()
    art_markup = svg_from_shapes(shapes)
    mono = svg_from_shapes(build_shapes("#FFFFFF", "#FFFFFF", with_pin=False))

    (RES / "logo.svg").write_text(wrap(art_markup, ""), encoding="utf-8")
    (RES / "icon.svg").write_text(
        wrap(art_markup, '<rect width="1024" height="1024" rx="230" fill="#FFFFFF"/>', 1.12),
        encoding="utf-8",
    )
    (RES / "icon-square.svg").write_text(
        wrap(art_markup, '<rect width="1024" height="1024" fill="#FFFFFF"/>', 1.12),
        encoding="utf-8",
    )
    (RES / "icon-round.svg").write_text(
        wrap(art_markup, '<circle cx="512" cy="512" r="512" fill="#FFFFFF"/>', 1.12),
        encoding="utf-8",
    )
    (RES / "icon-monochrome.svg").write_text(wrap(mono, ""), encoding="utf-8")

    bw = svg_from_shapes(build_shapes("#000000", "#000000"))
    (RES / "icon-bw.svg").write_text(
        wrap(
            bw,
            '<rect width="1024" height="1024" fill="#FFFFFF"/>',
            1.12,
            title="TheBell 图标（黑白墨稿）",
            desc="商标 / 软著申报用黑白稿：纯黑图形 + 纯白底。",
        ),
        encoding="utf-8",
    )

    # 同步给 Web 端：favicon 与品牌角标
    public = ROOT / "public"
    public.mkdir(exist_ok=True)
    (public / "brand-icon.svg").write_text(
        (RES / "icon.svg").read_text(encoding="utf-8"), encoding="utf-8"
    )
    (public / "favicon.svg").write_text(
        (RES / "icon.svg").read_text(encoding="utf-8"), encoding="utf-8"
    )

    android = ROOT / "android" / "app" / "src" / "main" / "res"
    drawable = android / "drawable"
    drawable.mkdir(parents=True, exist_ok=True)
    (drawable / "ic_launcher_background.xml").write_text(BACKGROUND_XML, encoding="utf-8")
    # 彩色前景属于变体资源：dev 品牌（黑金）输出到 dev flavor 的 source set
    dev_drawable = ROOT / "android" / "app" / "src" / "dev" / "res" / "drawable"
    dev_drawable.mkdir(parents=True, exist_ok=True)
    (dev_drawable / "ic_launcher_foreground.xml").write_text(
        vector_xml(shapes), encoding="utf-8"
    )
    (drawable / "ic_launcher_monochrome.xml").write_text(
        vector_xml(build_shapes("#FFFFFF", "#FFFFFF", with_pin=False), tint="#FFFFFF"),
        encoding="utf-8",
    )
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        (android / "mipmap-anydpi-v26" / name).write_text(ADAPTIVE_XML, encoding="utf-8")

    k = scale_for_adaptive()
    print(f"logo written · extent={art_extent():.1f} scale={k:.4f} ring_dp={RING_R * 2 * k:.1f}")


if __name__ == "__main__":
    main()
