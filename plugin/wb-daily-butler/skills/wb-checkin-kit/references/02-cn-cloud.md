# 方案 B：国内云服务器（约 68 元/年起，手机号可注册）

适合「不想电脑天天开着」的用户。国内主流云厂商都可以，下面以最常见的配置为例。

## 一、买机器

真实价格（2026 年 11 月活动价，供参考，以官网为准）：

| 厂商 / 套餐 | 配置 | 价格 |
|---|---|---|
| 腾讯云轻量 | 2 核 2G / 3M / 40G | **68 元/年**（新客） |
| 腾讯云轻量 | 2 核 2G / 4M / 50G | 99 元/年（买一年送三个月） |
| 腾讯云 学生机 | 2 核 2G | 约 26 元/年（需学生认证） |
| 阿里云免费试用 | 2 核 2G | 免费 1–3 个月，到期需迁 |

> **别选**：腾讯 Cloud Studio（免费额度大，但关掉标签页 10 分钟就停，跑不了定时任务）。

购买时选：
- 镜像：**Ubuntu 22.04 或 24.04**
- 地域：离自己近的（上海 / 广州 / 北京 / 成都）
- 1 核 1G 也能跑，但 Chrome 吃内存，**2G 起更稳**

## 二、装环境

SSH 登录后依次执行：

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # 应输出 v20.x

# Google Chrome（比 snap 版 chromium 稳）
wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb
google-chrome --version

# 中文字体（不装的话页面中文会变方块，影响扫码页显示）
sudo apt install -y fonts-wqy-zenhei fonts-noto-cjk
```

## 三、放脚本、写账号表

```bash
mkdir -p ~/wb-checkin && cd ~/wb-checkin
# 把 scripts/ 里的文件传上来（scp / 宝塔面板 / 直接 vim 粘贴都行）

cat > accounts.json <<'EOF'
[
  { "name": "主账号", "port": 9222 }
]
EOF
```

> 云主机没有桌面，脚本会自动加 `--headless=new`。`profile` 留空即可，会自动建在 `./profiles/主账号`。

## 四、首次登录（关键一步）

云主机没有屏幕，用「截图扫码」。开**两个** SSH 窗口：

```bash
# 窗口 1：启动浏览器并等扫码，这条会停住，不要关
node run_all.mjs --login

# 窗口 2：把登录页截成图片
node login-qr.mjs 9222
```

把 `login-qr.png` 下载到本地打开（scp、宝塔文件管理，或在服务器上 `python3 -m http.server 8000` 临时开个网页），用手机微信扫。

扫完**不用回窗口 1 重跑**，它自己会继续，最后输出：

```json
{ "ok": true, "login": true, "results": [{ "login": "ok", "total_credits": 1400 }] }
```

看到 `"login": "ok"` 就成了。如果 5 分钟没扫完会返回 `LOGIN_TIMEOUT`，窗口还开着，扫完再跑一次 `--login` 即可。

### 如果无头模式扫不了（风控拦截 / 页面空白）

改用虚拟桌面 + VNC，能像真机一样操作：

```bash
sudo apt install -y xvfb x11vnc
Xvfb :0 -screen 0 1440x900x24 &
x11vnc -display :0 -passwd 你的密码 -forever -shared &
```

在云厂商控制台的**安全组**里放行 5900 端口，然后本地用 VNC 客户端连 `服务器IP:5900`，在虚拟桌面里扫码。用完记得把 5900 关掉。

## 五、试跑 + 装定时

```bash
node run_all.mjs           # 真跑，确认 claimed: true
bash install-systemd.sh ~/wb-checkin
```

装完会看到：

```
NEXT   Fri 2026-11-14 01:00:xx UTC    wb-checkin.timer
```

`01:00 UTC` 就是北京时间 09:00，正常。

## 六、这个方案的坑

| 坑 | 说明 |
|---|---|
| 时区 | 云主机默认 UTC。`install-systemd.sh` 里定时已显式写 `Asia/Shanghai`，**不要删**，否则 9 点会变成北京时间 17 点 |
| 内存 | 1G 机器跑 Chrome 可能 OOM。加 2G swap：`sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| 实名 | 国内云主机必须实名认证，这是硬要求 |
| 重启 | 云主机重启后 systemd timer 自动恢复，不用手动拉起 |
| IP | 单机多账号共用出口 IP，风控风险自负 |
