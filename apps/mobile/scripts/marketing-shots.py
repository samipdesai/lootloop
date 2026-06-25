#!/usr/bin/env python3
"""LootLoop App Store marketing screenshots for iPhone (1284x2778) and iPad
(2064x2752): branded background + headline + raw capture in a device bezel +
wordmark."""
from PIL import Image, ImageDraw, ImageFont
import os

INK = (32, 36, 58)
INK_MUTED = (120, 116, 128)
ORANGE = (244, 114, 14)
BG_TOP = (255, 235, 214)
BG_BOT = (255, 252, 248)
DEVICE = (22, 22, 28)
HEAD_F = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"

SCREENS = [
    ("01-home.png",    "Chores, points & rewards", "the whole family, in one app", "rewards"),
    ("02-chores.png",  "Today's chores, done",      "kids check off tasks and earn", "done"),
    ("03-store.png",   "Rewards they choose",       "spend points in your family store", "Rewards"),
    ("04-reading.png", "Build reading streaks",     "celebrate every day they read", "streaks"),
    ("05-savings.png", "Watch savings grow",        "save up, and earn interest", "grow"),
]

DEVICES = [
    dict(name="iphone", W=1284, H=2778, src="/tmp/lootloop-shots/iphone",
         out="/tmp/lootloop-shots/iphone-marketing", head=72, sub=44, wm=50,
         screen_w=870, bezel=22, r_screen=70, r_dev=92, dev_y=560, line_h=88,
         head_top=150, maxw=1120),
    dict(name="ipad", W=2064, H=2752, src="/tmp/lootloop-shots/ipad",
         out="/tmp/lootloop-shots/ipad-marketing", head=108, sub=64, wm=72,
         screen_w=1480, bezel=30, r_screen=44, r_dev=64, dev_y=540, line_h=130,
         head_top=170, maxw=1840),
]

def gradient_bg(W, H):
    bg = Image.new("RGB", (W, H), BG_BOT)
    px = bg.load()
    for y in range(H):
        t = min(1.0, y / (H * 0.55))
        row = tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3))
        for x in range(W):
            px[x, y] = row
    return bg

def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0]-1, img.size[1]-1], radius=radius, fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out

def centered_words(draw, words_colored, cx, y, font):
    space = font.getlength(" ")
    total = sum(font.getlength(w) for w, _ in words_colored) + space * (len(words_colored) - 1)
    x = cx - total / 2
    for w, c in words_colored:
        draw.text((x, y), w, font=font, fill=c)
        x += font.getlength(w) + space

def render(cfg):
    os.makedirs(cfg["out"], exist_ok=True)
    fH, fS, fW = (ImageFont.truetype(HEAD_F, cfg[k]) for k in ("head", "sub", "wm"))
    for fname, title, sub, oword in SCREENS:
        W, H = cfg["W"], cfg["H"]
        canvas = gradient_bg(W, H)
        d = ImageDraw.Draw(canvas)
        # headline (wrap, keyword orange)
        words, lines, cur = title.split(), [], []
        for w in words:
            if fH.getlength(" ".join(cur + [w])) <= cfg["maxw"] or not cur:
                cur.append(w)
            else:
                lines.append(cur); cur = [w]
        lines.append(cur)
        y = cfg["head_top"]
        for line in lines:
            centered_words(d, [(w, ORANGE if w.strip(",&") == oword else INK) for w in line], W/2, y, fH)
            y += cfg["line_h"]
        d.text((W/2, y + 12), sub, font=fS, fill=INK_MUTED, anchor="ma")
        # device + screenshot
        src = Image.open(os.path.join(cfg["src"], fname)).convert("RGB")
        sw = cfg["screen_w"]
        sh = round(sw * src.size[1] / src.size[0])
        shot = rounded(src.resize((sw, sh), Image.LANCZOS), cfg["r_screen"])
        bez = cfg["bezel"]
        dw, dh = sw + bez*2, sh + bez*2
        dx, dy = (W - dw)//2, cfg["dev_y"]
        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle([dx+12, dy+20, dx+dw+12, dy+dh+20], radius=cfg["r_dev"], fill=(20,24,40,55))
        canvas.paste(shadow.convert("RGB"), (0, 0), shadow)
        d = ImageDraw.Draw(canvas)
        d.rounded_rectangle([dx, dy, dx+dw, dy+dh], radius=cfg["r_dev"], fill=DEVICE)
        canvas.paste(shot, (dx+bez, dy+bez), shot)
        # wordmark Loot(ink)Loop(orange), tight
        lw = fW.getlength("Loot")
        x0 = W/2 - (lw + fW.getlength("Loop"))/2
        d.text((x0, H - cfg["head_top"]), "Loot", font=fW, fill=INK)
        d.text((x0 + lw, H - cfg["head_top"]), "Loop", font=fW, fill=ORANGE)
        canvas.save(os.path.join(cfg["out"], fname))
        print(f"  {cfg['name']}: {fname}")

for cfg in DEVICES:
    render(cfg)
print("done")
