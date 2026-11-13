# 排错手册

排查顺序永远是：**先看报错码 → 再看浏览器能不能连上 → 最后看页面有没有加载完**。不要一上来就重装环境。

## 一、脚本报错对照

| 报错 | 含义 | 修法 |
|---|---|---|
| `ACCOUNTS_FILE_MISSING` | 找不到 `accounts.json` | 确认文件在工作目录，或设 `WB_ACCOUNTS` 指向它 |
| `CHROME_NOT_FOUND` | 没找到 Chrome/Edge | 装 Chrome；或用 `WB_CHROME=/完整路径` 指定 |
| `CHROME_START_FAIL` | 端口起了但连不上调试口 | 换端口（9224）；检查是否有安全软件拦截 |
| `NO_PAGE` | 下没有可用的页面 | 多半是 Chrome 起来了但没打开页面，重跑一次 |
| `PAGE_NOT_READY` | 页面还在导航/白屏 | 重跑；持续失败见第三节 |
| `NOT_LOGIN` | profile 里没有登录态 | 改用 `node run_all.mjs --login`，扫完它会自己继续，不用重跑 |
| `LOGIN_TIMEOUT` | `--login` 等了 5 分钟还没扫 | 窗口还开着，扫完再跑一次 `--login`；或调大 `WB_LOGIN_TIMEOUT=600` |
| `STATUS_FAIL` | 签到状态接口返回非 0 | 打印 `msg` 原文，多为接口改版或临时故障 |
| `timeout` | CDP 通讯超时 | 页面卡死，关掉该 Chrome 窗口重跑 |

## 二、定时任务没跑

### Linux

```bash
systemctl --user list-timers wb-checkin.timer   # 看 NEXT 是否正确
systemctl --user status wb-checkin.service      # 看上次执行结果
tail -n 50 ~/wb-checkin/log/service.log         # 看脚本输出
loginctl show-user $USER -p Linger              # 应为 Linger=yes
```

- `Linger=no`：用户登出后定时器不跑。执行 `sudo loginctl enable-linger $USER`。
- `NEXT` 显示的时间如果差 8 小时：timer 里的 `Asia/Shanghai` 被删掉了，加回去。
- 机器休眠/关机期间不触发，唤醒后 `Persistent=true` 会补一次。

### Windows

```powershell
schtasks /Query /TN WorkBuddyDailyCheckin /V /FO LIST
Get-Content C:\wb-checkin\log\*.jsonl -Tail 5
```

- 「上次运行结果」不是 `0x0`：看日志。
- 任务存在但从不跑：检查电源设置里有没有允许唤醒定时器，以及任务是不是被设置成「只在空闲时运行」。
- 电脑关机期间不跑，开机后自动补跑。

## 三、页面类问题

**白屏 / 一直 PAGE_NOT_READY**

1. 手动打开那个 Chrome 窗口看一眼，如果停在登录页 → 需要扫码。
2. 如果是空白页 → 关掉这个 profile 对应的所有 Chrome 窗口，重跑。
3. 服务器上无头模式白屏 → 装中文字体，或缺 `--disable-gpu`。
4. 公司网络拦截 → 换网络试。

**二维码扫不出来（云主机 / box）**

一边跑 `node run_all.mjs --login`（它会停住等），另一边跑 `node login-qr.mjs 9222` 生成 `login-qr.png`，把这个文件下载到本地打开再扫。不要在终端里看 base64。

**用户问「自己电脑为什么也要扫码」**

脚本用的是独立 profile，不继承日常 Chrome 的登录态。这句话必须主动解释，否则用户会觉得「我不是登录过了吗」。原话：扫一次，登录状态存在那套配置里，以后不用再扫。

**登录后仍报 NOT_LOGIN**

- 用户扫的是另一个 profile 的二维码（多账号时常见）。确认端口和 profile 的对应关系。
- profile 目录权限不对，Cookie 写不进去。删掉该 profile 目录重来一次。

## 四、接口 404（多半是改版）

整套方案依赖网页版接口。一旦改版：

1. 用探测法确认路由：`node cdp.mjs "fetch('/billing/meter/checkin-activity-status',{method:'POST',credentials:'include'}).then(r=>r.status)"`
2. 返回 404 → 路由变了。去 `references/04-api-contract.md` 最后一节按「GET 探路由 → POST 空 body 探存在」重找。
3. 返回 200/403 → 路由还在，多半是参数或状态问题。
4. 找到新接口后，直接改 `run_all.mjs` 里 `EXPR` 常量的路径字符串，其余逻辑不用动。

## 五、账号相关

| 现象 | 说明 |
|---|---|
| `already: true` 但积分没涨 | 今天确实已领过，正常 |
| `claim_msg` 非 OK | 重复领取被拒，正常 |
| `daily_limit_reached: true` | 今天的派猫次数用完了，明天再来 |
| `travel: "not arrived yet"` | 猫还在路上，等它回来 |
| `travel: "no unclaimed travel"` | 没有待领奖励，正常 |
| 连续天数断了 | 中间漏了一天。提醒用户：漏跑会断连击，`Persistent` 补跑能救回当天 |

## 六、安全与合规（不能省）

- 本套件**只复用浏览器会话**，不读取、不落盘任何密码或 token。如果看到任何方案要求你交出密码，那不是本套件。
- 不要把 `profiles/` 目录、`accounts.json` 分享给别人——里面等于登录凭据。
- 多账号共用同一出口 IP 连续领取，是风控最敏感的形态。建议 2–3 个以内，风险由使用者承担。
- 不要用这套东西做代签、代领、对外售卖账号额度。
