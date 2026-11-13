---
name: wb-checkin-kit
description: "Host WorkBuddy daily check-in and Buddy Cat travel in the cloud (or on a local PC) so it runs without anyone clicking. Use when the user wants daily credits claimed automatically, wants it to keep running with their computer off, asks which environment to use, needs help with the one-time QR login, or reports that the check-in script fails. 新手可能会说：「我老是忘记签到，能不能自动」「我不想每天点，能定时吗」「帮我把签到挂到云上」「电脑关了还能签吗」「扫码扫不上」「签到脚本报错了」。"
---

# WorkBuddy 自动签到 + 派猫 部署套件（云托管优先）

把「每天打开 WorkBuddy 签到、派猫去旅行」变成全自动。用户在第一次扫码之后不需要再做任何操作。

**卖点只有一句：托管在云上，用户自己的电脑关机、断网、休眠都不影响。** 本机方案只是给「不想注册任何账号」的人留的退路。

## 核心原理（先理解，再动手）

浏览器里一旦登录过 WorkBuddy 网页版，登录态就存在**浏览器配置目录（profile）**里。本套件启动一个带调试端口的 Chrome 指向这个 profile，在页面内用页面自己的会话调接口，然后把 profile 留着复用。

**因此：不读取、不保存、不传输任何密码或 token。** 用户只需要在第一步扫码一次。

接口只有五个，全部为网页版自身在用的：

| 用途 | 接口 |
|---|---|
| 查签到状态 | `POST /billing/meter/checkin-activity-status` |
| 领取签到 | `POST /billing/meter/daily-checkin` |
| 查猫状态 | `GET /activity/growth/buddy/travel/status` |
| 派猫出发 | `POST /activity/growth/buddy/travel/depart` body `{"location_id":1}` |
| 领回旅行奖励 | `POST /activity/growth/buddy/travel/claim` |

细节与返回样例见 `references/04-api-contract.md`。

## 第一步：选环境（不要跳过）

必须先问清两件事：**① 有没有 GitHub 或 Google 账号；② 能不能接受电脑每天开着。**

| 方案 | 成本 | 注册门槛 | 要不要开机 | 适合谁 |
|---|---|---|---|---|
| **A. box 云电脑（云端托管）** | **GitHub 登录后免费** | GitHub（邮箱可注册，国内可直连）或 Google，**无邮箱注册入口** | 不用 | 首选，最省心 |
| **B. 国内云服务器** | 约 68 元/年起 | 手机号 + 实名 | 不用 | 没有外网账号，又不想开电脑 |
| **C. 本机 Windows** | 0 元 | 无需注册 | 要 | 完全不想注册任何账号 |

**判断口径：**
- 用户想要「电脑关了也能签」→ **A**；没有 GitHub/Google → **B**
- 用户说「不想花钱，我有 GitHub」→ **A**
- 用户说「我什么账号都不想注册」→ **C**
- 用户什么都不确定 → 先解释 A 的价值（不用开电脑），再看注册意愿；都拒绝就 **C**

> 重要澄清：**GitHub 用邮箱就能注册，国内可以直接访问，不需要翻墙。** 只有 Google 账号需要额外网络条件。不要把「需要 GitHub」说成「需要外网账号」，那会劝退一半人。

不要一次抛三个方案让用户选，先给推荐项和一句理由，再补一句备选。

## 第二步：按路径部署

| 方案 | 详细步骤 |
|---|---|
| A box 云电脑 | `references/01-box.md` |
| B 国内云服务器 | `references/02-cn-cloud.md` |
| C 本机 Windows | `references/03-local-windows.md` |

## 第三步：通用部署四步

1. **放脚本**：把本 skill 的 `scripts/` 整个目录复制到工作目录（下文记作 `<工作目录>`）。box 上如果连接器已就绪，由 Agent 直接写入 `/workspace/wb`，用户不用碰终端。
2. **写账号表**：复制 `accounts.example.json` 为 `accounts.json`，一个账号一条。`profile` 留空会自动建到 `<工作目录>/profiles/<账号名>`。
3. **扫码登录（一条命令，扫完自动继续）**：`node run_all.mjs --login`
   - 本机：会弹出一个独立的 Chrome 窗口，用微信扫窗口里的码。
   - 云主机 / box：看不到窗口，另开终端执行 `node login-qr.mjs <端口>`，把生成的 `login-qr.png` 打开再扫。
   - 成功后输出 `"login": "ok"` 和 `total_credits`，**不需要重跑命令**。
4. **真跑 + 装定时**：`node run_all.mjs` 确认能领到；然后按平台装定时：
   - Linux：`bash install-systemd.sh`
   - Windows：`powershell -ExecutionPolicy Bypass -File install-windows.ps1`

## 第四步：验证（不给证据不算完成）

必须拿到以下输出才能对用户说「好了」：

- `--login` 返回 `"login": "ok"` 且 `total_credits` 有具体数字 → 登录态有效
- 真跑返回 `already: false, claimed: true, claim_code: 0` → 本次真的领到了
- 再跑一次返回 `already: true` → 幂等正确，没有重复领
- `travel_depart` 为 `departed` 或 `skip:traveling` → 派猫逻辑正常
- 定时已列出：Linux 用 `systemctl --user list-timers`，Windows 用 `schtasks /Query /TN WorkBuddyDailyCheckin`

**任何一项没拿到，就如实说没验证，不要用「应该可以了」收尾。**

## 关于扫码的两句标准解释

用户问「为什么还要扫码」：

> 脚本用的是一套独立的浏览器配置，不碰你平时用的 Chrome，所以第一次得知道你是谁。扫一次，登录状态就存在那套配置里，以后它自己用。

用户问「云上看不到窗口怎么扫」：

> 那台机器没屏幕，正常。我给你截一张登录二维码的图，你用微信扫这张图，扫完我这边会自动继续。

## 输出规范

- **一次只给一个动作。** 用户是新手，一次三步会卡住。
- **命令必须可直接复制**，不要写「把路径改成你的路径」这种要用户自己改的话——直接问出路径再拼好。
- **每条命令后面写一句「你应该看到什么」**，让用户能自查。
- 出错了先给原因，再给修法，最后才给命令。

## 边界（必须如实告知，不能假装做到）

1. **box 闲置会休眠，休眠期间定时不触发**，唤醒后 `Persistent=true`（Linux）补跑一次；云主机不会睡。免费换来的就是这个差别，必须主动说。
2. **多账号共用同一出口 IP**，同日连续领取是最容易被风控识别的形态。账号数量建议控制在 2–3 个，风险由用户承担。
3. **签到和派猫是官方功能，自动化本身不违反规则，但批量多账号刷取有风险**，这一点必须主动说，不能等用户问。
4. **派猫地点默认 1（Coffee Shop，1–4 小时，5–10 分）**，想换地点改 `depart` 的 `location_id`（2/3/4），见接口文档。
5. **派猫每天有次数上限**。实测：当天派过一只，猫回来后立刻再派，会返回 `daily limit reached`。所以定时只需两次（09:00 派、18:00 领回），**不是越频繁越好**——多配只会空跑。
6. 这套东西依赖网页版接口，**接口一旦改版就会失效**。失效时先看 `references/05-troubleshooting.md` 的「接口 404」一节。

## 常见错误速查

| 现象 | 原因 | 处理 |
|---|---|---|
| `CHROME_NOT_FOUND` | 没装 Chrome，或路径不标准 | 装 Chrome，或用 `WB_CHROME` 环境变量指定 |
| `NOT_LOGIN` | profile 里没有登录态 | 跑 `node run_all.mjs --login`，扫完自动继续 |
| `LOGIN_TIMEOUT` | 5 分钟内没扫完 | 窗口还开着，扫完再跑一次 `--login` 即可 |
| `PAGE_NOT_READY` | 页面还没加载完 | 重跑一次；持续失败看排错文档 |
| `CHROME_START_FAIL` | 端口被占或 Chrome 起不来 | 换端口（9224、9225） |
| `already: true` 但没加分 | 今天已经领过 | 正常，不是错误 |
| 定时没跑 | 机器休眠 / 未 enable-linger | 见排错文档 |

完整排错见 `references/05-troubleshooting.md`。
