"""Generate small, original, palette-based 1990s web graphics. Requires Pillow."""
from pathlib import Path
import random
from PIL import Image, ImageDraw, ImageFont

out = Path(__file__).resolve().parents[1] / 'blog/static/images/first-webpage'
out.mkdir(parents=True, exist_ok=True)
rng = random.Random(95)
stars = Image.new('RGB', (128, 128), 'black')
draw = ImageDraw.Draw(stars)
for _ in range(42):
    x, y = rng.randrange(126), rng.randrange(126)
    size = rng.choices([1, 2, 3], [8, 3, 1])[0]
    draw.rectangle((x, y, x + size - 1, y + size - 1), fill='white')
stars.save(out / 'stars.png')

# Render bitmap lettering at 2x for the low-resolution GIF look.
font = ImageFont.load_default()
frames = []
for phase in range(8):
    frame = Image.new('RGB', (180, 28), '#ffcc00')
    draw = ImageDraw.Draw(frame)
    for x in range(-20, 200, 16):
        x += phase * 2
        for y in (0, 23):
            draw.polygon([(x, y), (x + 8, y), (x + 3, y + 4), (x - 5, y + 4)], fill='black')
    draw.rectangle((0, 5, 179, 22), fill='black')
    text = 'UNDER CONSTRUCTION'
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((180 - (box[2] - box[0])) // 2, 7), text, font=font, fill='#ffcc00')
    frames.append(frame.resize((360, 56), Image.Resampling.NEAREST))
frames[0].save(out / 'under-construction.png')
frames[0].save(out / 'under-construction.gif', save_all=True, append_images=frames[1:], duration=140, loop=0, optimize=False)
