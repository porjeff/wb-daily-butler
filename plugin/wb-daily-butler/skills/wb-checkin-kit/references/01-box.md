# 方案 A：box 云电脑（GitHub 登录后免费，电脑关机也照跑）

这是主推方案：签到跑在一台云上的电脑里，**用户自己的电脑关不关、断不断网，都不影响。**

## 一、box 是什么，先把这件事说清楚

box 是一台跑在浏览器里的 Ubuntu 云电脑（Simular 提供）。打开一个网页就能看到它的桌面，关掉网页它还在跑。

对这套方案来说它有三个好处：

1. **用 GitHub 或 Google 登录后免费**（不开放邮箱注册，登录进去才有额度），每个账号最多 2 台。
2. **自带 Chrome，而且这个 Chrome 默认就开着调试端口 9222** —— 整套方案能成立的关键，不用额外配置。
3. **自带 Node.js**，不用装环境。

代价也要先说：**闲置久了会休眠，休眠期间定时任务不触发**，唤醒后补跑一次。免费换来的就是这个。

## 二、注册门槛（别把人劝退，这里最容易误会）

box 只支持 **Google 或 GitHub** 登录。

- **GitHub：用邮箱就能注册，国内可以直接打开 github.com，不需要翻墙。** 慢一点是正常的，多等几秒。
- **Google：需要能访问 Google 的网络条件。**

所以正确的判断是：**愿意花 5 分钟注册一个 GitHub 账号 → 用 box；连注册都不想 → 走本机或国内云主机。** 不要说成「需要外网账号」，那会劝退一半人。

## 三、申请（用户自己点，Agent 只负责说清楚每一步该看到什么）

1. 打开 https://box.simular.ai ，点右上角登录，选 **Continue with GitHub**（推荐）或 Google。
2. 第一次用 GitHub 登录会要求授权，点绿色的 **Authorize**。
3. 进入控制台后点 **New box** / **Create box**，等 30–60 秒。
4. 状态变成 **Running**，点进这台 box，会打开 live view（一个能看到桌面的网页）。

**验收**：live view 里能看到桌面、能点开 Chrome，就算成功。地址形如 `https://box.simular.ai/box/<box-id>/live`。

> 如果注册页一直转圈：换 Chrome 浏览器、关掉广告拦截插件，或者先在本机登录 GitHub 再回来点授权。

## 四、让 WorkBuddy 能操作这台 box（关键一步，做完后面我替你干）

在 `~/.workbuddy/mcp.json` 的 `mcpServers` 里加一条：

```json
"box": { "type": "http", "url": "https://mcp.box.simular.ai/mcp" }
```

然后打开 WorkBuddy 的「连接器」→ 右上角「自定义连接器」→ 找到 **box** → 点「信任」，浏览器会弹 Simular 授权页，同意即可。

**验收**：连接器列表里 box 显示已连接。此后我可以直接在这台 box 里读写文件、跑命令、截图。

### 不想用连接器？用 API Key

在 https://box.simular.ai/keys 生成一个 `cb_` 开头的密钥：

```json
"box": { "type": "http", "url": "https://mcp.box.simular.ai/mcp",
         "headers": { "Authorization": "Bearer cb_xxxxxxxx" } }
```

> 这个 key 等于云电脑的最高权限，不要贴到公开仓库或聊天里。

## 五、部署（脚本由 Agent 写进 box，用户不用碰终端）

目标目录固定用 `/workspace/wb`。这一步由 Agent 完成：

1. 在 box 里建 `/workspace/wb`，把 `scripts/` 全部文件写进去。
2. 写 `accounts.json`：

```json
[
  { "name": "主账号", "port": 9222, "profile": "/home/user/.config/cocoonbox-chrome" }
]
```

3. 确认 Node 可用：`node -v`，应输出 `v18` 以上（box 自带）。

> **不要让用户自己在终端里手打脚本内容。** 那是这套流程里最容易崩的一步。连接器没接通就先解决连接器。

## 六、扫码（box 上比云主机简单：窗口就在 live view 里）

```bash
cd /workspace/wb
node run_all.mjs --login
```

命令会停在那里等。回到 live view，能看到一个 Chrome 窗口停在 WorkBuddy 登录页，**用手机微信扫窗口里的二维码**。

扫完**不用重跑命令**，它自己会继续，终端里出现：

```json
{ "ok": true, "login": true, "results": [{ "login": "ok", "total_credits": 1400 }] }
```

看到 `"login": "ok"` 就成了，窗口可以直接关掉。

**如果 live view 里看不清二维码**（画面糊、缩放不对）：

```bash
node login-qr.mjs 9222     # 生成 login-qr.png
```

把 `login-qr.png` 在 live view 里打开看，或者下载到本地打开再扫。

## 七、真跑 + 装定时

```bash
cd /workspace/wb
node run_all.mjs          # 应出现 claimed: true / travel_depart: departed
bash install-systemd.sh /workspace/wb
```

装完验证：

```bash
systemctl --user list-timers wb-checkin.timer
```

看到 `NEXT` 是北京时间 09:00（UTC 01:00）就对了。

> box 的系统时区是 UTC，`install-systemd.sh` 里已显式写 `Asia/Shanghai`，**不要删**，否则 9 点会变成北京时间 17 点。
> 还要确认 `loginctl show-user $USER -p Linger` 是 `Linger=yes`，否则用户登出后定时器不跑。

## 八、多账号（box 上最划算的用法）

**不要开第二台 box。** 一台 box 里用「一个账号一个 profile + 一个调试端口」即可，不占用 2 台上限：

```json
[
  { "name": "账号A", "port": 9222, "profile": "/home/user/.config/cocoonbox-chrome" },
  { "name": "账号B", "port": 9223, "profile": "/home/user/.config/wb-acct2" }
]
```

账号 B 第一次跑 `--login` 时会自动拉起一个新窗口（独立 profile），在 live view 里用账号 B 扫码即可。此后再不用扫。

> 多账号共用同一出口 IP，同日连续领取有风控风险，建议 2–3 个以内。

## 九、这个方案的坑

| 坑 | 说明 |
|---|---|
| 闲置休眠 | 休眠时定时不触发，唤醒后 `Persistent=true` 补跑一次。想绝对稳就走国内云主机 |
| 装不了 WorkBuddy 桌面客户端 | Linux 版只通过 UOS / 麒麟应用商店分发，CDN 上的 `.deb`/`.AppImage` 全部 404。所以只能走**网页版** |
| 出口 IP | 所有账号共用同一 IP，多账号同日领取有风控风险 |
| 时区 | UTC，定时脚本里已写死 `Asia/Shanghai`，不要删 |
| 第三方服务 | 免费额度、注册政策以 box 官网为准，我这套只保证签到怎么跑通 |
