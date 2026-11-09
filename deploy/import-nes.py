#!/usr/bin/env python3
"""Import a local nesrom ZIP into the static site. No runtime build required."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
START = '// BEGIN GENERATED NES CATALOG'
END = '// END GENERATED NES CATALOG'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('--revision', required=True)
    args = parser.parse_args()
    folder = ROOT / 'games/nes/roms'
    folder.mkdir(parents=True, exist_ok=True)
    entries = []
    with zipfile.ZipFile(args.archive) as archive:
        for item in sorted(archive.infolist(), key=lambda v: v.filename):
            if not item.filename.lower().endswith('.nes'):
                continue
            raw = archive.read(item)
            digest = hashlib.sha256(raw).hexdigest()
            name = item.filename.split('/', 1)[-1]
            valid = len(raw) >= 16 and raw[:4] == b'NES\x1a'
            mapper = ((raw[6] >> 4) | (raw[7] & 0xf0)) if valid else None
            entry = dict(id='nes-' + hashlib.sha256(name.encode()).hexdigest()[:16],
                         title=Path(name).stem, sourcePath=name, sha256=digest,
                         rom='roms/' + digest + '.nes', size=len(raw), mapper=mapper,
                         status='pending' if valid else 'invalid',
                         detail='尚未启动检查' if valid else '不是有效的 iNES 文件头')
            (folder / (digest + '.nes')).write_bytes(raw)
            entries.append(entry)
    manifest = dict(source='https://github.com/mengfei523060/nesrom',
                    revision=args.revision, emulator='JSNES 2.1.0', games=entries)
    (ROOT / 'games/nes/catalog.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    publish_catalog(manifest)
    print(f'Imported {len(entries)} entries / {len(set(e["sha256"] for e in entries))} unique ROMs')


def publish_catalog(manifest):
    """Called again after the emulator audit to publish accurate status labels."""
    (ROOT / 'games/nes/catalog.js').write_text('window.NES_LIBRARY = ' + json.dumps(manifest, ensure_ascii=False) + ';\n')
    games = []
    for e in manifest['games']:
        status = '启动已检查' if e['status'] == 'boot' else '兼容性待确认' if e['status'] == 'pending' else '暂不兼容'
        games.append(dict(id=e['id'], title=e['title'], category='retro',
                          url='games/nes/index.html?game=' + e['id'] + '&from=retro',
                          cover='assets/images/covers/nes.svg',
                          tags=['FC / NES', status, '触屏手柄'],
                          description=e['detail'], source='mengfei523060/nesrom'))
    # Put familiar, checked originals ahead of anonymous dumps and unsupported variants.
    order = {'魂斗罗': 0, '马戏团': 1, '冒险岛1': 2}
    games.sort(key=lambda g: (order.get(g['title'], 3), '启动已检查' not in g['tags'], g['title']))
    path = ROOT / 'assets/js/games.js'
    text = path.read_text()
    if START in text:
        text = text[:text.index(START)] + text[text.index(END) + len(END):]
    text = text.rstrip() + '\n\n' + START + '\nwindow.GAME_DATA.games.push(...' + json.dumps(games, ensure_ascii=False) + ');\n' + END + '\n'
    path.write_text(text)


if __name__ == '__main__':
    main()
