"""Reproducible import of the reviewed ABA selection; all runtime files are local."""
import hashlib
import html
import io
import json
from pathlib import Path
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'games' / 'crisp'
REVISIONS = {'crisp-game-lib-games': 'cfb39d2f988feb5918eb83697145b5a35adabf58', 'crisp-game-lib-11-games': '6fea4eefe2deaa42706051d96a04ec9e36104696'}

def fetch(url):
    return urllib.request.urlopen(url, timeout=60).read()

def write(path, data):
    if path.suffix == '.html' and isinstance(data, str):
        data = data.replace('<head>', '<head><script src="../../../assets/js/server-sync.js"></script>')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data if isinstance(data, bytes) else data.encode())

def main():
    manifest = {'repositories': REVISIONS, 'packages': [], 'games': []}
    for package, version, source in [('crisp-game-lib', '1.1.1', 'docs/bundle.js'), ('sounds-some-sounds', '3.0.0', 'build/index.js')]:
        import base64
        meta = json.loads(fetch(f'https://registry.npmjs.org/{package}/{version}'))
        archive = fetch(meta['dist']['tarball'])
        integrity = 'sha512-' + base64.b64encode(hashlib.sha512(archive).digest()).decode()
        if integrity != meta['dist']['integrity']:
            raise ValueError('Package integrity mismatch: ' + package)
        with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
            data = tar.extractfile('package/' + source).read()
            if package == 'crisp-game-lib':
                marker = b'requestAnimationFrame(update$3);'
                assert data.count(marker) == 1
                data = data.replace(marker, marker + b'\n        if (window.liteCrispPaused) return;')
            write(DEST / 'vendor' / (package + '.js'), data)
            licenses = [x for x in tar.getnames() if x.lower() in ['package/license', 'package/license.txt', 'package/license.md']]
            assert licenses, package
            write(DEST / 'vendor' / (package + '.LICENSE'), tar.extractfile(licenses[0]).read())
        manifest['packages'].append({'name': package, 'version': version, 'integrity': integrity})
    for repo, revision in REVISIONS.items():
        for name in ['LICENSE', 'LICENSE.txt', 'LICENSE.md']:
            try:
                license_data = fetch(f'https://raw.githubusercontent.com/abagames/{repo}/{revision}/{name}')
                break
            except urllib.error.HTTPError as error:
                if error.code != 404:
                    raise
        else:
            raise ValueError('No license: ' + repo)
        write(DEST / (repo + '.LICENSE'), license_data)
    selection = json.loads((ROOT / 'deploy/h5-selection.json').read_text())
    entries = []
    for item in selection:
        name, title, category, help_text = item[:4]
        repo = 'crisp-game-lib-11-games' if len(item) > 4 else 'crisp-game-lib-games'
        revision = REVISIONS[repo]
        source = f'https://github.com/abagames/{repo}/blob/{revision}/docs/{name}/main.js'
        data = fetch(f'https://raw.githubusercontent.com/abagames/{repo}/{revision}/docs/{name}/main.js')
        write(DEST / name / 'main.js', data)
        game_id = 'aba-' + name
        manifest['games'].append({'id': game_id, 'source': source, 'sha256': hashlib.sha256(data).hexdigest(), 'category': category})
        write(DEST / name / 'frame.html', '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{touch-action:none;overscroll-behavior:none}canvas{touch-action:none}</style></head><body><script src="../vendor/sounds-some-sounds.js"></script><script src="../vendor/crisp-game-lib.js"></script><script src="main.js"></script><script src="../../lib/crisp-frame.js"></script></body></html>''')
        esc = html.escape
        page = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{title} · LiteGame</title><link rel="stylesheet" href="../../lib/crisp-host.css"><link rel="icon" href="../../../assets/images/covers/{game_id}.svg"></head><body data-game="{game_id}"><main><header><a class="hall-link" href="../../../index.html?category={category}#{category}">← 游戏厅</a><h1>{title}</h1></header><p class="crisp-help">{esc(help_text)} 鼠标或手机直接操作画面；单键玩法也可按空格。</p><div class="crisp-stage"><iframe src="frame.html" title="{title}游戏画面" allow="autoplay" sandbox="allow-scripts allow-same-origin"></iframe><div class="crisp-cover"><strong>{title}</strong><button id="crisp-start" disabled>正在加载…</button></div></div><div class="crisp-tools"><button id="crisp-pause">继续</button><button id="crisp-restart">重开一局</button><button id="crisp-sound">声音：开</button><button id="crisp-fullscreen">全屏</button></div><p id="crisp-status" role="status">正在加载本地游戏…</p><p class="crisp-help">最高分保存在本机。暂停保留本页这一局，刷新后重新开始。</p><p class="crisp-source">原作 <a href="{source}" target="_blank" rel="noopener">ABA / {name}</a> · MIT · <a href="../{repo}.LICENSE">游戏许可证</a> · <a href="../SOURCE.md">来源与适配说明</a></p></main><script src="../../lib/crisp-host.js"></script></body></html>'''
        write(DEST / name / 'index.html', page)
        color = {'action':'#9e416b','casual':'#367f72','racing':'#426dae','sports':'#8b722c','cards':'#7451a3'}[category]
        cover = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" fill="#132237"/><circle cx="450" cy="165" r="125" fill="{color}"/><path d="M80 200h210m-105-105v210" stroke="#d0f0e8" stroke-width="30" stroke-linecap="round"/><circle cx="420" cy="135" r="20" fill="#ffe5a1"/><circle cx="490" cy="205" r="20" fill="#ffe5a1"/><text x="32" y="345" fill="white" font-family="sans-serif" font-size="36">{esc(title)}</text><text x="32" y="50" fill="#a9c7e1" font-family="sans-serif" font-size="22">ABA · {name.upper()}</text></svg>'
        write(ROOT / 'assets/images/covers' / (game_id + '.svg'), cover)
        entries.append({'id': game_id, 'title': title, 'category': category, 'url': f'games/crisp/{name}/index.html?from={category}', 'cover': f'assets/images/covers/{game_id}.svg', 'tags': ['开源移植','触屏','最高分保存'], 'description': help_text, 'badge': 'NEW'})
    write(DEST / 'manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    catalog = ROOT / 'assets/js/games.js'
    start, end = '    // H5 IMPORT START', '    // H5 IMPORT END'
    block = start + '\n' + '\n'.join('    '+json.dumps(e, ensure_ascii=False)+',' for e in entries) + '\n' + end
    text = catalog.read_text()
    if start in text:
        text = text[:text.index(start)] + block + text[text.index(end)+len(end):]
    else:
        text = text.replace('  games: [', '  games: [\n' + block, 1)
    write(catalog, text)
    print('Imported', len(entries), 'games')

if __name__ == '__main__':
    main()
