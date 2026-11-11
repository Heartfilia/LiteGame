"""Center-crop user-supplied pictures to 3:4 and produce local WebP assets.

Usage: python3 deploy/prepare-jigsaw-images.py /path/to/pictures
Requires Pillow. Source images are read-only.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
args = parser.parse_args()
target = Path(__file__).resolve().parents[1] / 'games/jigsaw/images'
target.mkdir(parents=True, exist_ok=True)
records = []
for source in sorted(args.source.iterdir()):
    if source.suffix.lower() not in {'.png', '.jpg', '.jpeg', '.webp'}:
        continue
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    image_id = 'photo-' + digest[:12]
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        width, height = image.size
        # Integer 3:4 crop, with exactly the same centre on both axes.
        unit = min(width // 3, height // 4)
        crop_w, crop_h = unit * 3, unit * 4
        left, top = (width - crop_w) // 2, (height - crop_h) // 2
        box = (left, top, left + crop_w, top + crop_h)
        scale = min(400, unit)  # Up to 1200x1600; never upscale smaller originals.
        image = image.crop(box).resize((scale * 3, scale * 4), Image.Resampling.LANCZOS)
        dest = target / (image_id + '.webp')
        image.save(dest, 'WEBP', quality=86, method=6)
        records.append(dict(id=image_id, title=source.stem.replace('【哲风壁纸】', ''),
                            src='images/' + dest.name, source=source.name,
                            sourceSHA256=digest, sourceBytes=source.stat().st_size,
                            originalSize=[width, height], crop=list(box),
                            width=image.width, height=image.height, bytes=dest.stat().st_size))
manifest = json.dumps(records, ensure_ascii=False, indent=2)
(target / 'manifest.json').write_text(manifest + '\n')
(target / 'catalog.js').write_text('window.JIGSAW_PHOTOS = ' + manifest + ';\n')
print(manifest)
print(f'Total: {sum(r["sourceBytes"] for r in records):,} -> {sum(r["bytes"] for r in records):,} bytes')
