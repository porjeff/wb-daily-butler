<div align="center">

<img src="plugin/wb-daily-butler/avatars/expert.png" width="120" alt="云签到托管管家">

# 云签到托管管家

**把 WorkBuddy 的每日签到和派猫托管到云端 —— 电脑关机、断网都不影响。**

扫码一次，之后每天自动领积分、自动把猫派出去。

</div>

---

## 一句话安装

复制下面这句话，发给 WorkBuddy（或任何能读写本地文件的 AI 助手）：

```text
帮我装这个 WorkBuddy 专家：https://github.com/porjeff/wb-daily-butler
照仓库里的 INSTALL.md 执行，装完告诉我怎么用。
```

它会自动下载、解压、装进 `~/.workbuddy/plugins/marketplaces/my-experts/plugins/`，并登记到市场清单。**装完重启 WorkBuddy**，在「专家 → 我的专家」里就能看到。

> 前提：本机已安装并登录 WorkBuddy。装的是"专家"，不是一个独立软件。

### 装不上就手动来

1. 下载本仓库 → 解压
2. 把 `plugin/wb-daily-butler/` 整个复制到
   `C:\Users\<你的用户名>\.workbuddy\plugins\marketplaces\my-experts\plugins\`
   （macOS / Linux：`~/.workbuddy/plugins/marketplaces/my-experts/plugins/`）
3. 打开同级的 `.codebuddy-plugin/marketplace.json`，在 `plugins` 数组里加一条：

```json
{
  "name": "wb-daily-butler",
  "source": "./plugins/wb-daily-butler",
  "description": "Hosts WorkBuddy daily check-in and Buddy Cat travel in the cloud so it keeps running with the PC off: guides non-technical users from picking an environment to one QR scan, then schedules everything automatically.",
  "version": "1.1.0"
}
```

4. 重启 WorkBuddy

---

## 它到底解决什么

签到这件事本身不难，难的是**连续**：

- 出差三天，回来发现连续记录断了
- 设了闹钟，人在开会，按掉了
- 写了脚本，但脚本要求电脑开着

断签一次，前面攒的连续天数就白费。这个专家做的事只有一件：**把"每天必须有人在电脑前点一下"变成"云上那台机器自己点"**。

## 三条路，按你的条件选

| 方案 | 费用 | 门槛 | 电脑要开吗 | 适合谁 |
|---|---|---|---|---|
| **A. box 云电脑** | GitHub 登录后免费 | **只能用 GitHub 或 Google 登录，无邮箱注册入口** | 不用 | 有 GitHub 账号，想零成本 |
| **B. 国内云服务器** | 约 68 元/年 | 手机号 + 实名 | 不用 | 没外网账号，又要求稳定 |
| **C. 本机 Windows** | 0 元 | 无需注册 | **要** | 完全不想注册 |

> **关于"免费"要说清楚**：box 不是谁都白拿。它不开放邮箱注册，得用 GitHub 或 Google 账号登录进去才有免费额度。好消息是 GitHub 用邮箱就能注册，国内可直接访问 `github.com`，不需要翻墙；真正需要额外网络条件的只有 Google 账号。
> 另外 box 免费额度会**休眠**，闲置久了定时不触发，醒来补跑一次。要绝对稳，走 B。

## 第一次对话长什么样

选中专家，发第一句（哪怕是"你好"），它会先给一张引导卡：

```text
我是云签到托管管家。三条路，回我一个数字：

1) 云 box 托管（GitHub 登录后免费）—— 不用开电脑
2) 云主机（约 68 元/年）—— 不用开电脑，不休眠
3) 放到自己电脑（0 元）—— 电脑得开着

拿不准就回 0，我问两句替你定。
```

选完之后是固定的动作序列：装浏览器 → `--login` 扫码 → 验证一次真跑 → 装定时（每天 09:00 派猫、18:00 领回）。每一步都会给出可验收的证据，不用你判断对错。

## 包里有什么

```text
plugin/wb-daily-butler/
├── .codebuddy-plugin/plugin.json      # 专家元信息（名称、分类、标签、推荐问法）
├── agents/wb-daily-butler.md          # 人设 + 首轮引导卡 + 按数字分流
├── avatars/expert.png                 # 头像 512×512
└── skills/wb-checkin-kit/
    ├── SKILL.md                       # 总纲：选环境 → 部署 → 验证
    ├── references/
    │   ├── 01-box.md                  # box 申请 + 接入 + 部署
    │   ├── 02-cn-cloud.md             # 国内云主机部署
    │   ├── 03-local-windows.md        # 本机 Windows 部署
    │   ├── 04-api-contract.md         # 接口契约
    │   └── 05-troubleshooting.md      # 排错
    └── scripts/
        ├── run_all.mjs                # 主脚本：--login / --dry / 正常跑
        ├── cdp.mjs                    # 调试：在已登录页面执行 JS
        ├── login-qr.mjs               # 无桌面环境截图取二维码
        ├── install-systemd.sh         # Linux 定时
        ├── install-windows.ps1        # Windows 计划任务
        └── accounts.example.json
```

## 安全边界

- **不读取、不保存、不传输任何密码或 token。** 登录态留在你自己的浏览器 profile 里（`profiles/` 目录），脚本只借用它
- 脚本会启动一个带 `--remote-debugging-port` 的独立 Chrome，**不碰你日常用的浏览器**
- 所有接口调用都发生在你已登录的页面上下文里，等价于你自己在网页上点了一下
- 二维码不会被截图上传，只在本地生成图片供你扫

## 风险与免责

- 自动化依赖 WorkBuddy **网页版接口**，官方改版会失效。失效时按 `references/04-api-contract.md` 最后一节重探接口
- **多账号**共用同一出口 IP 连续领取存在风控风险，账号数量自己控制，别贪
- box 是第三方服务，免费额度、休眠策略、注册政策以官网为准，可能变化
- 本项目只做"把官方功能自动化"，不修改、不绕过任何接口校验。因使用产生的账号风险由使用者自负
- 首次登录必须**你本人扫码**，任何要你提供密码或验证码的"代登录"都是骗局

## 许可

[MIT](LICENSE)
