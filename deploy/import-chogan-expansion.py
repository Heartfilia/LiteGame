"""Import selected upstream Chogan games without replacing the local shared shell."""
import hashlib
import json
from pathlib import Path
import re
import os
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REVISION = '55bdf6ae6df1fad51221a9403912148ac09fd746'
SELECTION = [
    ('carrom', '卡罗姆弹棋', 'board', '拉动击球器瞄准，把己方棋子弹入角袋。'),
    ('dominoes', '多米诺接龙', 'board', '匹配两端点数，安排出牌顺序，与电脑比拼清空手牌。'),
    ('fourrow', '四子连线', 'board', '轮流落子，抢先横、竖或斜向连接四枚棋子。'),
    ('territories', '领地布子', 'board', '在分区棋盘上布置棋子，让各行、各列与领地满足互斥规则。'),
    ('pipes', '管道工', 'puzzle', '旋转管道，把断开的水路连成完整网络。'),
    ('storekeeper', '仓库推箱', 'puzzle', '规划移动顺序，把箱子推进目标位置，避免死角。'),
    ('sums', '数和谜阵', 'puzzle', '根据行列目标选择数字，使各项总和满足条件。'),
    ('watersort', '彩水分装', 'puzzle', '在试管之间倒水，把相同颜色归入同一支管。'),
    ('trio', '三元配对', 'puzzle', '观察卡片属性，找出满足组合规则的三张牌。'),
    ('numberdrop', '数字落块', 'puzzle', '选择落点合并数字，在不断堆高的棋盘中争取空间。'),
    ('starraid', '星际突袭', 'action', '驾驶战机躲避弹幕，击败不断出现的敌舰。'),
    ('football', '弹棋足球', 'sports', '瞄准并弹动球员，把足球送进对方球门。'),
    ('peak', '巅峰牌阵', 'cards', '相同数字的牌合力压倒较小的牌，抢先清空手牌和面前的牌。'),
]

def main():
    manifest = {'repository': 'https://github.com/choganhq/chogan', 'revision': REVISION, 'games': []}
    entries = []
    cue = urllib.request.urlopen(f'https://raw.githubusercontent.com/choganhq/chogan/{REVISION}/www/lib/cue.js', timeout=60).read()
    (ROOT / 'games/lib/cue-expansion.js').write_bytes(cue)
    manifest['cueSha256'] = hashlib.sha256(cue).hexdigest()
    for game_id, title, category, description in SELECTION:
        dest = ROOT / 'games' / game_id
        dest.mkdir(exist_ok=True)
        files = {}
        for name in ['index.html', 'icon.svg']:
            url = f'https://raw.githubusercontent.com/choganhq/chogan/{REVISION}/www/games/{game_id}/{name}'
            cache = os.environ.get('CHOGAN_SOURCE')
            data = (Path(cache)/'www/games'/game_id/name).read_bytes() if cache else urllib.request.urlopen(url, timeout=60).read()
            files[name] = hashlib.sha256(data).hexdigest()
            if name == 'index.html':
                text = data.decode().replace('lang="fa" dir="rtl"', 'lang="zh-CN" dir="ltr"')
                text = text.replace('../../lib/', '../lib/').replace('../../version.js', '../version.js')
                text = text.replace('../lib/cue.js', '../lib/cue-expansion.js')
                if game_id == 'trio':
                    text = text.replace("id: 'trio',", "id: 'trio',\n    scroll: true,", 1)
                if game_id == 'sums':
                    text = text.replace('new ResizeObserver(fitFont)', 'new ResizeObserver(function () { requestAnimationFrame(fitFont); })')
                text = text.replace('</head>', '<link rel="stylesheet" href="../lib/chogan-expansion.css"></head>')
                text = re.sub(r'<title>.*?</title>', '<title>'+title+' · LiteGame</title>', text)
                text = text.replace('<link rel="stylesheet" href="../lib/chogan.css">', '<link rel="stylesheet" href="../lib/chogan.css"><link rel="stylesheet" href="../lib/litegame.css">')
                text = text.replace('<script src="../lib/chogan.js"></script>', '<script src="../lib/chogan.js"></script><script src="../lib/litegame.js"></script>')
                data = text.encode()
            (dest / name).write_bytes(data)
        (dest / 'SOURCE.md').write_text(f'# {title}\n\nSource: https://github.com/choganhq/chogan/tree/{REVISION}/www/games/{game_id}\n\nMIT; see ../CHOGAN-LICENSE. Local adaptation: paths, Chinese page metadata, LiteGame navigation and mobile styles.\n')
        manifest['games'].append({'id': game_id, 'files': files})
        entries.append({'id': game_id, 'title': title, 'category': category, 'url': f'games/{game_id}/index.html?from={category}', 'cover': f'games/{game_id}/icon.svg', 'tags': ['开源移植','触屏','进度保存'], 'description': description, 'badge': 'NEW'})
    (ROOT / 'games/lib/chogan-expansion.json').write_text(json.dumps(manifest, indent=2)+'\n')
    catalog = ROOT / 'assets/js/games.js'
    start, end = '    // CHOGAN EXPANSION START', '    // CHOGAN EXPANSION END'
    block = start+'\n'+'\n'.join('    '+json.dumps(e,ensure_ascii=False)+',' for e in entries)+'\n'+end
    text = catalog.read_text()
    if start in text:
        text = text[:text.index(start)]+block+text[text.index(end)+len(end):]
    else:
        text = text.replace('  games: [', '  games: [\n'+block, 1)
    catalog.write_text(text)
    print('Imported', len(entries), 'Chogan games')

if __name__ == '__main__':
    main()
