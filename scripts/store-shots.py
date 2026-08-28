#!/usr/bin/env python3
"""스토어 스크린샷 합성기 — 파노라마(1·2페이지에 걸쳐 한 화면) + 단일 슬라이드.

입력: store-assets/shots-v3/raw-real/*.png (에뮬레이터 실캡처 1080x2400, SHOT 모드 아님; SHOTS_RAW 환경변수로 변경)
출력: store-assets/shots-v3/{android-phone,ios-6.9}/0N-*.png

사용: python3 scripts/store-shots.py
스토어 문구엔 제3자 IP(작품명) 금지 — Guideline 4.1(a).
"""
from __future__ import annotations
import os, math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, os.environ.get("SHOTS_RAW", "store-assets/shots-v3/raw-real"))
OUT = os.path.join(ROOT, "store-assets/shots-v3")
FONT_DIR = os.path.expanduser("~/.fonts")

SIZES = {"android-phone": (1080, 1920), "ios-6.9": (1290, 2796)}

# 팔레트 (브랜드: 딥그린 + 오렌지 포인트)
GREEN = (18, 151, 130)
GREEN_D = (8, 74, 66)
NAVY = (15, 23, 42)
NAVY_L = (30, 41, 59)
ORANGE = (255, 122, 0)
CREAM = (250, 247, 240)
WHITE = (255, 255, 255)

SLIDES = [
    # (raw file, headline, sub, bg style)  — 0·1 은 파노라마 1장으로 취급
    ("01-home.png", "내 카드, 지금 얼마일까?", "실시간 시세 · 스캔 등록 · 자산 관리 · 직거래\n트레이딩 카드의 모든 것을 한 앱에서", "dark"),
    ("04-collection.png", "내 자산을 한눈에", "자산 구성 · 손익 분포 · 시장 지수 비교\n인포그래픽 대시보드", "green"),
    ("02-detail.png", "등급별 시세를 한 번에", "일반 카드 ↔ PSA 10 전환\n일별 · 7일 · 30일 평균", "cream"),
    ("03-market.png", "박스별 히트카드 시세", "인기 박스와 카드의 오늘 등락을\n실시간으로 확인", "dark"),
    ("05-community.png", "수집가들과 직거래", "삽니다 · 팝니다 · 쪽지\n커뮤니티와 카드샵 지도까지", "orange"),
    ("06-my.png", "관심 카드 하루 등락", "찜한 카드의 변동을 알림으로\n포인트 · 레벨업 소식도 한곳에", "green"),
]


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(os.path.join(FONT_DIR, f"NotoSansKR-{weight}.otf"), size)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(w, h, top, bottom, diag=True):
    """세로(또는 대각) 그라데이션 배경."""
    base = Image.new("RGB", (1, 256))
    px = base.load()
    for y in range(256):
        px[0, y] = lerp(top, bottom, y / 255)
    img = base.resize((w, h), Image.BILINEAR)
    if diag:
        img = img.rotate(-12, resample=Image.BICUBIC, expand=False)
        # 회전 시 생기는 모서리 빈틈을 큰 리사이즈로 덮음
        big = base.resize((int(w * 1.6), int(h * 1.6)), Image.BILINEAR).rotate(-12, resample=Image.BICUBIC)
        bw, bh = big.size
        img = big.crop(((bw - w) // 2, (bh - h) // 2, (bw - w) // 2 + w, (bh - h) // 2 + h))
    return img


def blob(img, cx, cy, r, color, alpha=90, blur=120):
    """부드러운 원형 글로우."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.paste(layer, (0, 0), layer)


def dots(img, color, alpha=28, step=44):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    w, h = img.size
    for y in range(0, h, step):
        for x in range(0, w, step):
            d.ellipse((x, y, x + 3, y + 3), fill=color + (alpha,))
    img.paste(layer, (0, 0), layer)


def background(w, h, style):
    if style == "dark":
        img = gradient(w, h, NAVY_L, NAVY).convert("RGBA")
        blob(img, int(w * 0.85), int(h * 0.15), int(w * 0.45), GREEN, 120)
        blob(img, int(w * 0.1), int(h * 0.75), int(w * 0.4), ORANGE, 70)
        dots(img, WHITE, 22)
        fg, sub = WHITE, (203, 213, 225)
    elif style == "green":
        img = gradient(w, h, GREEN, GREEN_D).convert("RGBA")
        blob(img, int(w * 0.9), int(h * 0.2), int(w * 0.45), (90, 220, 190), 110)
        dots(img, WHITE, 26)
        fg, sub = WHITE, (210, 240, 232)
    elif style == "orange":
        img = gradient(w, h, (255, 150, 60), (215, 85, 0)).convert("RGBA")
        blob(img, int(w * 0.15), int(h * 0.2), int(w * 0.45), (255, 220, 150), 120)
        dots(img, WHITE, 30)
        fg, sub = WHITE, (255, 236, 214)
    else:  # cream
        img = gradient(w, h, CREAM, (235, 228, 214)).convert("RGBA")
        blob(img, int(w * 0.85), int(h * 0.2), int(w * 0.45), GREEN, 60)
        blob(img, int(w * 0.1), int(h * 0.7), int(w * 0.4), ORANGE, 45)
        dots(img, NAVY, 18)
        fg, sub = NAVY, (71, 85, 105)
    return img, fg, sub


def phone_card(raw: Image.Image, width: int, radius: int) -> Image.Image:
    """원본 캡처를 둥근 모서리 + 얇은 베젤 + 그림자로 감싼 카드."""
    scale = width / raw.width
    shot = raw.resize((width, int(raw.height * scale)), Image.LANCZOS).convert("RGBA")
    bezel = max(10, int(width * 0.022))
    w, h = shot.width + bezel * 2, shot.height + bezel * 2
    pad = int(width * 0.14)
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    # 그림자
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((pad, pad + int(pad * 0.35), pad + w, pad + h + int(pad * 0.35)), radius + bezel, fill=(0, 0, 0, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(int(pad * 0.45)))
    canvas.alpha_composite(sh)
    # 베젤
    ImageDraw.Draw(canvas).rounded_rectangle((pad, pad, pad + w, pad + h), radius + bezel, fill=(17, 17, 20, 255))
    # 화면 마스크
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, shot.width, shot.height), radius, fill=255)
    canvas.paste(shot, (pad + bezel, pad + bezel), mask)
    return canvas, pad, bezel


def draw_centered(d, cx, y, text, f, fill, spacing=1.0):
    for line in text.split("\n"):
        bbox = d.textbbox((0, 0), line, font=f)
        tw = bbox[2] - bbox[0]
        d.text((cx - tw / 2, y), line, font=f, fill=fill)
        y += int(f.size * 1.25 * spacing)
    return y


def pill(d, cx, cy, text, f, bg, fg):
    bbox = d.textbbox((0, 0), text, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    px, py = int(f.size * 0.9), int(f.size * 0.45)
    d.rounded_rectangle((cx - tw / 2 - px, cy - th / 2 - py, cx + tw / 2 + px, cy + th / 2 + py), th, fill=bg)
    d.text((cx - tw / 2, cy - th / 2 - bbox[1]), text, font=f, fill=fg)


def render_single(raw_path, headline, sub, style, size):
    W, H = size
    img, fg, subc = background(W, H, style)
    d = ImageDraw.Draw(img)
    u = W / 1080  # 스케일 단위
    y = int(150 * u)
    y = draw_centered(d, W / 2, y, headline, font("Black", int(74 * u)), fg)
    y = draw_centered(d, W / 2, y + int(8 * u), sub, font("Regular", int(36 * u)), subc)
    raw = Image.open(raw_path)
    card, pad, bezel = phone_card(raw, int(W * 0.82), int(56 * u))
    top = y + int(50 * u)
    img.alpha_composite(card, ((W - card.width) // 2, top - pad))
    return img.convert("RGB")


def render_panorama(raw_path, headline, sub, style, size):
    """2장 폭 캔버스에 큰 폰 1개 + 문구 → 좌/우로 잘라 1·2페이지."""
    W, H = size
    PW = W * 2
    img, fg, subc = background(PW, H, style)
    d = ImageDraw.Draw(img)
    u = W / 1080
    # 상단: 로고 필 + 대형 헤드라인(2장에 걸침)
    pill(d, PW / 2, int(120 * u), "ARVOTCG", font("Black", int(34 * u)), ORANGE, WHITE)
    y = int(190 * u)
    y = draw_centered(d, PW / 2, y, headline, font("Black", int(150 * u)), fg)
    y = draw_centered(d, PW / 2, y + int(12 * u), sub, font("Regular", int(44 * u)), subc)
    # 폰: 두 장 경계에 걸쳐 크게, 살짝 기울여서
    raw = Image.open(raw_path)
    card, pad, bezel = phone_card(raw, int(W * 1.15), int(80 * u))
    card = card.rotate(-6, resample=Image.BICUBIC, expand=True)
    top = y + int(40 * u)
    img.alpha_composite(card, ((PW - card.width) // 2, top - pad))
    # 하단 좌우 포인트 문구 (각 페이지 안쪽에 하나씩)
    f = font("Bold", int(40 * u))
    for cx, txt in ((W * 0.28, "실시간 시세"), (W * 1.72, "스캔 한 번으로 등록")):
        pill(d, cx, H - int(150 * u), txt, f, (255, 255, 255, 235) if style != "cream" else NAVY, NAVY if style != "cream" else WHITE)
    img = img.convert("RGB")
    return img.crop((0, 0, W, H)), img.crop((W, 0, PW, H))


def main():
    for plat, size in SIZES.items():
        out = os.path.join(OUT, plat)
        os.makedirs(out, exist_ok=True)
        raw, hl, sub, style = SLIDES[0]
        a, b = render_panorama(os.path.join(RAW, raw), hl, sub, style, size)
        a.save(os.path.join(out, "01-pano-a.png"), optimize=True)
        b.save(os.path.join(out, "02-pano-b.png"), optimize=True)
        for i, (raw, hl, sub, style) in enumerate(SLIDES[1:], start=3):
            render_single(os.path.join(RAW, raw), hl, sub, style, size).save(
                os.path.join(out, f"{i:02d}-{raw.split('-')[1].split('.')[0]}.png"), optimize=True)
        print(plat, "->", out)


if __name__ == "__main__":
    main()
