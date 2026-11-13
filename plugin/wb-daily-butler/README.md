# 云签到托管管家（wb-daily-butler）

把 WorkBuddy 的每日签到和派猫托管到云端——**用户自己的电脑关机、断网都不影响**，扫码一次之后每天自动领积分、自动派猫。

## 一句话

不用开电脑，跟着点几下，云上那台机器每天自己签。

## 它能做什么

- 每天自动完成 WorkBuddy 签到，领取积分
- 自动把 Buddy 猫派去旅行，猫回来后自动领回奖励
- `--login` 一条命令完成首次扫码，扫完自动继续，不用重跑
- 支持多账号（一账号一浏览器 profile，互不干扰）
- 三条部署路径，按用户条件选，优先推云托管

## 三条路径

| 方案 | 成本 | 注册门槛 | 要不要开机 | 适合谁 |
|---|---|---|---|---|
| A box 云电脑 | 登录后免费 | GitHub（邮箱可注册）或 Google，**无邮箱注册入口** | 不用 | **首选**，云托管 |
| B 国内云服务器 | 约 68 元/年 | 手机号 + 实名 | 不用 | 没外网账号，又不想开电脑 |
| C 本机 Windows | 0 元 | 无需注册 | 要 | 完全不想注册 |

## 目录结构

```
wb-daily-butler/
├── .codebuddy-plugin/plugin.json
├── agents/wb-daily-butler.md          # 人设 + 首轮引导卡 + 按数字分流
├── avatars/expert.png
└── skills/wb-checkin-kit/
    ├── SKILL.md                        # 操作总纲（选环境 → 部署 → 验证）
    ├── references/
    │   ├── 01-box.md                   # box 申请 + MCP 接入 + 部署（主推）
    │   ├── 02-cn-cloud.md              # 国内云主机部署
    │   ├── 03-local-windows.md         # 本机 Windows 部署
    │   ├── 04-api-contract.md          # 签到/派猫接口契约
    │   └── 05-troubleshooting.md       # 排错
    └── scripts/
        ├── run_all.mjs                 # 主脚本（--login / --dry / 正常跑）
        ├── cdp.mjs                     # 调试：在已登录页面执行 JS
        ├── login-qr.mjs                # 无桌面环境截图取二维码
        ├── install-systemd.sh          # Linux 定时（09:00/18:00 Asia/Shanghai）
        ├── install-windows.ps1         # Windows 计划任务
        └── accounts.example.json
```

## 命令一览

```bash
node run_all.mjs --login    # 首次：打开登录页，扫码，扫完自动继续
node run_all.mjs --dry      # 只查状态，不领取
node run_all.mjs            # 真跑：签到 + 领回 + 派猫
bash install-systemd.sh     # Linux 装定时
powershell -ExecutionPolicy Bypass -File install-windows.ps1   # Windows 装定时
```

## 使用示例

- 我想让签到全自动，但不想电脑一直开着
- 帮我把签到挂到 box 云电脑上，一步步教我
- 我已经扫码了，怎么确认它真的每天会自动跑

## 技术原理

浏览器登录过 WorkBuddy 网页版后，登录态存在浏览器 profile 里。脚本启动一个带 `--remote-debugging-port` 的 Chrome 指向该 profile，在页面上下文中调用网页版自身的接口，从而复用 Cookie 会话。

**不读取、不保存、不传输任何密码或 token。** 用户只需在第一步扫码一次。

## 头像

`avatars/expert.png`：512×512，224KB，为用户提供主视觉中「云box」图标区域的裁切特写（小尺寸下比整图清晰）。替换要求 PNG/JPG、512×512、≤500KB。

## 修改与维护

- 想换派猫地点：改 `run_all.mjs` 里 `location_id`（1–4）
- 接口改版：按 `references/04-api-contract.md` 最后一节的探测法重找，只改 `EXPR` 里的路径字符串
- 加账号：`accounts.json` 加一条，`port` 顺延即可
- 改登录等待时长：环境变量 `WB_LOGIN_TIMEOUT=600`（秒）

## 安装 / 打包

```bash
python3 scripts/register_expert.py <expert-dir>
python3 scripts/package_expert.py <expert-dir>
```

## 免责

签到与派猫都是 WorkBuddy 官方功能，自动化不改变其性质。多账号共用同一出口 IP 连续领取存在风控风险，请自行控制账号数量。本套件依赖网页版接口，官方改版会失效。box 为第三方服务，其免费额度与注册政策以官网为准。
