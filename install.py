#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""wb-daily-butler installer for WorkBuddy.

把「云签到托管管家」专家包装进当前用户的 WorkBuddy「我的专家」。

用法:
    python install.py            # 安装 / 升级
    python install.py --dry      # 只打印将要做什么，不改动磁盘
    python install.py --force    # 已存在时覆盖（默认就是覆盖，保留此参数兼容）

装完需要重启 WorkBuddy，专家才会出现在「专家 → 我的专家」。
"""

import json
import os
import shutil
import sys
from pathlib import Path

PLUGIN_HINT = "wb-daily-butler"
MANIFEST = Path(".codebuddy-plugin") / "plugin.json"
SKIP = {".git", ".github", "__pycache__", ".DS_Store", "Thumbs.db", "install.py"}

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def config_dir() -> Path:
    """WorkBuddy 配置根目录：优先 WORKBUDDY_CONFIG_DIR，否则 ~/.workbuddy。"""
    env = os.environ.get("WORKBUDDY_CONFIG_DIR")
    if env:
        return Path(env).expanduser()
    return Path.home() / ".workbuddy"


def discover(start: Path):
    """在当前目录及其往下 3 层里找含 .codebuddy-plugin/plugin.json 的目录。"""
    if (start / MANIFEST).is_file():
        return start
    for depth in (1, 2, 3):
        hits = sorted(start.glob("/".join(["*"] * depth) + "/" + str(MANIFEST)))
        if not hits:
            continue
        for h in hits:
            if h.parent.parent.name == PLUGIN_HINT:
                return h.parent.parent
        return hits[0].parent.parent
    return None


def main() -> int:
    dry = "--dry" in sys.argv
    here = Path(__file__).resolve().parent
    src = discover(here)
    if src is None:
        print("[x] 没找到专家包（缺少 .codebuddy-plugin/plugin.json）")
        print("    请在仓库根目录或解压后的目录里运行：python install.py")
        return 1

    meta = json.loads((src / MANIFEST).read_text(encoding="utf-8"))
    name = meta.get("name") or PLUGIN_HINT
    version = meta.get("version", "1.0.0")

    plugins_root = config_dir() / "plugins" / "marketplaces" / "my-experts" / "plugins"
    target = plugins_root / name
    marketplace = plugins_root.parent / ".codebuddy-plugin" / "marketplace.json"

    print(f"  源      : {src}")
    print(f"  目标    : {target}")
    print(f"  版本    : {version}")
    if dry:
        print("  --dry   : 未改动磁盘")
        return 0

    plugins_root.mkdir(parents=True, exist_ok=True)
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(src, target, ignore=shutil.ignore_patterns(*SKIP))
    print("  [1/2] 专家文件已复制")

    if marketplace.is_file():
        data = json.loads(marketplace.read_text(encoding="utf-8"))
    else:
        data = {
            "name": "my-experts",
            "description": "my-experts marketplace (auto-generated)",
            "plugins": [],
        }
    entries = data.setdefault("plugins", [])
    entry = {
        "name": name,
        "source": f"./plugins/{name}",
        "description": meta.get("description", ""),
        "version": version,
    }
    for i, item in enumerate(entries):
        if isinstance(item, dict) and item.get("name") == name:
            entries[i] = {**item, **entry}
            break
    else:
        entries.append(entry)
    marketplace.parent.mkdir(parents=True, exist_ok=True)
    marketplace.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("  [2/2] 已登记到 my-experts/marketplace.json")

    # 回读自检
    ok = any(
        isinstance(i, dict) and i.get("name") == name
        for i in json.loads(marketplace.read_text(encoding="utf-8")).get("plugins", [])
    )
    print(f"  自检    : {'通过' if ok else '失败'}")
    if not ok:
        return 1

    print("")
    print("装好了。重启 WorkBuddy，然后在左侧「专家」→「我的专家」里就能看到「云签到托管管家」。")
    print("第一次对话它会先让你选一条路（云 box / 云主机 / 本机），回一个数字就行。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
