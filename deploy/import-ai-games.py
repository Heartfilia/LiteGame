"""Import readable sources from a pinned, extracted upstream archive, then adapt branding.

Usage: python3 deploy/import-ai-games.py /path/to/extracted/upstream
Build instructions are recorded in games/ai-3d-SOURCE.md.
"""
import hashlib
import json
import pathlib
import shutil
import sys

root = pathlib.Path(__file__).resolve().parents[1]
upstream = pathlib.Path(sys.argv[1])
if any((root / "games" / name / "src").exists() for name in ["ai-speed", "ai-cf"]):
    raise SystemExit("Bootstrap only: existing adapted sources must not be overwritten. Use build-ai-games.cjs to rebuild.")
manifest = {"repository": "https://github.com/riba2534/claude-opus-5-5-demo", "commit": "54adc1fb64155f9dd7c1c90ecae7b8185ac540b8", "files": {}}
for source, target, title in [("qq-speed", "ai-speed", "Ai飞车"), ("cf-transport-ship", "ai-cf", "AiCF·运输船")]:
    dest = root / "games" / target
    dest.mkdir(parents=True, exist_ok=True)
    for file in (upstream / source / "src").iterdir():
        if not file.is_file():
            continue
        content = file.read_text()
        manifest["files"][source + "/src/" + file.name] = hashlib.sha256(file.read_bytes()).hexdigest()
        if source == "qq-speed":
            content = content.replace("飞车 3D · QQ飞车同人还原", "Ai飞车 · LiteGame").replace("QQ飞车 同人还原", "Ai飞车 · 3D 竞速").replace("飞车 3D</div>", "Ai飞车</div>")
            content = content.replace("非官方同人作品，致敬 QQ飞车。所有模型、贴图、音乐均为程序实时生成。", "Ai飞车 · LiteGame 适配版 · 场景、赛车与音乐由程序生成。原作 riba2534。")
            content = content.replace("feiche3d.v1", "litegame.ai-speed.settings")
        else:
            content = content.replace("运输船 · 穿越火线 3D", "AiCF·运输船 · LiteGame").replace("穿越火线", "AiCF").replace("<h1>运输船</h1>", "<h1>AiCF·运输船</h1>").replace("CROSSFIRE", "AiCF")
            content = content.replace("cf_ship_opts", "litegame.ai-cf.settings")
        output = dest / "src" / file.name
        output.parent.mkdir(exist_ok=True)
        output.write_text(content)
    shutil.copyfile(upstream / source / "package.json", dest / "upstream-package.json")
(root / "games" / "ai-3d-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
