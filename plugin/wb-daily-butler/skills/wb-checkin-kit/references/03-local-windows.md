# 方案 A：本机 Windows（0 元，无需注册，默认首选）

优点：不用注册任何账号、不用花钱、扫码时浏览器窗口就在眼前。缺点：**电脑得开着**（睡眠也能跑，关机不行）。

## 一、装两个东西

1. **Node.js**：https://nodejs.org → 下 LTS 版 → 一路下一步。
   装完打开「命令提示符」（Win+R 输入 `cmd`）敲 `node -v`，能看到 `v20.x` 就成。
2. **Chrome**：大概率已经有了。没有就装一个（Edge 也能被自动识别）。

## 二、建目录放脚本

```cmd
mkdir C:\wb-checkin
```

把 `scripts\` 里的**全部文件**复制进 `C:\wb-checkin`。

## 三、写账号表

在 `C:\wb-checkin` 下新建 `accounts.json`：

```json
[
  { "name": "主账号", "port": 9222 }
]
```

多账号就多加几条，`port` 依次 9222、9223、9224：

```json
[
  { "name": "账号A", "port": 9222 },
  { "name": "账号B", "port": 9223 }
]
```

`profile` 不用写，会自动建到 `C:\wb-checkin\profiles\账号名`。

## 四、首次登录（扫一次，之后不用再扫）

```cmd
cd /d C:\wb-checkin
node run_all.mjs --login
```

会发生三件事：

1. 弹出一个 **新的 Chrome 窗口**，停在 WorkBuddy 登录页。
2. 命令停在那里等你，终端里显示「等待扫码…」。
3. **用手机微信扫窗口里的二维码。**

扫完**不需要重跑命令**，它自己会继续，终端最后输出：

```json
{ "ok": true, "login": true, "results": [{ "name": "主账号", "login": "ok", "total_credits": 1400 }] }
```

看到 `"login": "ok"` 和 `total_credits` 有具体数字，登录态就存下来了。

> **为什么自己的电脑也要扫码？** 脚本用的是一套**独立的浏览器配置**（在 `C:\wb-checkin\profiles\` 下），不碰你平时用的 Chrome。所以它第一次得知道你是谁。扫一次，登录状态就存在那套配置里，以后每次它自己用，不用再扫。
>
> 那个窗口可以直接关掉，下次脚本会自己重新拉起来。

如果 5 分钟没扫完，命令会返回 `LOGIN_TIMEOUT`——窗口还开着，扫完再跑一次 `node run_all.mjs --login` 就行，不用重装任何东西。

## 五、真跑一次

```cmd
node run_all.mjs
```

正常输出长这样：

```json
{
  "ok": true,
  "results": [{
    "name": "主账号",
    "already": false,
    "claimed": true,
    "claim_code": 0,
    "after_total": 1500,
    "travel_state": "idle",
    "travel_depart": "departed",
    "travel_loc": "Coffee Shop",
    "travel_hours": 4
  }]
}
```

`claimed: true` = 今天的分真领到了；`travel_depart: departed` = 猫派出去了。
再跑一次应该变成 `already: true`、`travel_depart: skip:traveling`——这是对的，不是错误。

## 六、装定时（以后不用管了）

用**管理员身份**打开 PowerShell（右键开始菜单 → 终端(管理员)），执行：

```powershell
cd C:\wb-checkin
powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
```

装完会提示 `Installed: task 'WorkBuddyDailyCheckin' (09:00 / 18:00)`。

想立刻验证一次：

```powershell
schtasks /Run /TN WorkBuddyDailyCheckin
```

## 七、这个方案的坑

| 坑 | 处理 |
|---|---|
| 电脑关机 | 那天就不跑。开机后任务会自动补跑一次（脚本设了 `StartWhenAvailable`） |
| 睡眠 | 睡眠中不跑。设成「从不睡眠」或接受漏跑补跑：设置 → 系统 → 电源 → 屏幕和睡眠 → 睡眠改成「从不」 |
| 弹出 Chrome 窗口 | 定时跑的时候会闪一个窗口，是正常的。首次扫码后可以给账号加 `"headless": true` 让它在后台跑 |
| 公司电脑 | 部分公司电脑策略禁止计划任务，会提示权限不足 |
| 杀毒软件 | 可能拦截 Chrome 带调试端口启动。加到白名单即可 |

## 八、不想让电脑开着？

那就是方案 B（国内云服务器，68 元/年起）。本机方案省下的钱，换来的就是「电脑得开着」。
