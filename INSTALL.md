# 给 AI 助手的安装协议

> 这份文件是给 **AI 助手**读的，不是给人读的。人看 [`README.md`](README.md)。
> 你的任务：把 `plugin/wb-daily-butler/` 这个 WorkBuddy 专家包装进当前用户的 WorkBuddy 里，让它出现在「专家 → 我的专家」。

## 0. 先确认三件事

1. 用户的操作系统（Windows / macOS / Linux）
2. 是否存在 `~/.workbuddy` 目录（Windows 为 `C:\Users\<用户名>\.workbuddy`）。
   不存在说明这台机器没装 WorkBuddy 或没登录过 —— **停下来告诉用户先安装并登录 WorkBuddy**，不要继续。
3. 是否有 `python` 或 `python3` 命令

## 1. 取到代码（二选一）

**方式 A · 下载 zip（不需要 git）**

```bash
# 把 porjeff 换成仓库实际用户名
curl -L -o wb.zip https://github.com/porjeff/wb-daily-butler/archive/refs/heads/main.zip
unzip -q wb.zip -d wb-src
```

Windows PowerShell：

```powershell
Invoke-WebRequest -Uri "https://github.com/porjeff/wb-daily-butler/archive/refs/heads/main.zip" -OutFile wb.zip
Expand-Archive wb.zip -DestinationPath wb-src -Force
```

如果解压后目录名不是 `wb-daily-butler-main`，以实际为准。

**方式 B · git clone**

```bash
git clone --depth 1 https://github.com/porjeff/wb-daily-butler.git
```

## 2. 执行安装

进入上一步得到的目录（**必须**是含 `install.py` 的那一层），然后：

```bash
python install.py
```

`python` 不可用时换 `python3 install.py`。

脚本会做四件事，并逐行打印结果：

1. 往上找含 `.codebuddy-plugin/plugin.json` 的专家包根目录
2. 复制到 `<config>/plugins/marketplaces/my-experts/plugins/wb-daily-butler/`
3. 在 `<config>/plugins/marketplaces/my-experts/.codebuddy-plugin/marketplace.json` 的 `plugins` 数组里登记（已有则更新）
4. 回读自检

预期输出包含 `自检    : 通过`。

### 沙箱里跑不了脚本时，手抄这四步

1. 把 `plugin/wb-daily-butler/` 整个复制到
   `<config>/plugins/marketplaces/my-experts/plugins/wb-daily-butler/`
2. 打开 `<config>/plugins/marketplaces/my-experts/.codebuddy-plugin/marketplace.json`
3. 在 `plugins` 数组里加（或更新）一条：

```json
{
  "name": "wb-daily-butler",
  "source": "./plugins/wb-daily-butler",
  "description": "<照抄 plugin.json 里的 description>",
  "version": "<照抄 plugin.json 里的 version>"
}
```

4. 保存，保持 JSON 合法（别留下尾逗号）

> 只复制目录、不改 `marketplace.json` 是**无效安装**：WorkBuddy 按这份清单枚举专家，清单里没有的目录在界面上完全不存在。

## 3. 收尾

- 让用户**重启 WorkBuddy**
- 重启后路径：左侧「专家」→「我的专家」→「云签到托管管家」
- 专家不会自己开口。要用户点它、发第一句（或点默认提示词），它才会给出首轮引导卡

## 4. 验证清单

| 检查项 | 通过标准 |
|---|---|
| 目录存在 | `plugins/wb-daily-butler/.codebuddy-plugin/plugin.json` 可读 |
| 清单已登记 | `marketplace.json` 的 `plugins` 里有 `name = wb-daily-butler` |
| 版本 | 与 `plugin.json` 的 `version` 一致（当前 1.1.0） |
| 界面可见 | 重启后在「我的专家」里出现 |

任何一项不通过，按第 5 节排错，不要直接说"装好了"。

## 5. 常见错误

| 现象 | 原因 | 处理 |
|---|---|---|
| `没找到专家包（缺少 .codebuddy-plugin/plugin.json）` | 在错误目录运行，例如仓库根而包在 `plugin/` 下 | 脚本会自动找 3 层；仍失败就 `cd` 到含 `plugin.json` 的目录再跑 |
| 脚本成功但界面没有 | 没有改 `marketplace.json`，或改完没重启 | 检查清单条目，然后重启 WorkBuddy |
| 界面有但点开报错 | `agentName` 与 `agents/*.md` 文件名不一致 | `agentName` 必须是 `wb-daily-butler`，文件名必须是 `agents/wb-daily-butler.md` |
| JSON 解析失败 | 手改 `marketplace.json` 留下尾逗号 | 修好 JSON 再重启 |
| 已有旧版本 | 同名目录已存在 | 脚本默认覆盖；覆盖后仍需重启 |

## 6. 红线

- **不要**修改 `plugin.json` 的 `name`、`agentName`，也不要改目录名和 `agents/*.md` 文件名 —— 它们是唯一标识，改了专家就"消失"
- **不要**删除或重排 `marketplace.json` 里其他专家的条目
- **不要**替用户执行签到脚本、不要让用户把密码或 Cookie 贴给你。这个专家只教用户部署，不代跑
- 装完就停，不要顺手改专家的提示词或脚本
