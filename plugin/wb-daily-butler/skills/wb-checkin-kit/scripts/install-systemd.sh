#!/bin/bash
# 在 Linux（含云主机 / box）上安装定时任务：每天 09:00 与 18:00 自动签到 + 派猫
# 用法：bash install-systemd.sh [工作目录]
set -e

WB_HOME="${1:-$(cd "$(dirname "$0")" && pwd)}"
NODE="${WB_NODE:-$(command -v node)}"

if [ -z "$NODE" ]; then
  echo "找不到 node，请先安装 Node.js 18+（建议用 nvm 或系统包管理器）"
  exit 1
fi

mkdir -p "$WB_HOME/log" "$HOME/.config/systemd/user"

cat > "$HOME/.config/systemd/user/wb-checkin.service" <<EOF
[Unit]
Description=WorkBuddy daily check-in + buddy travel
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$WB_HOME
Environment=WB_HOME=$WB_HOME
Environment=HOME=$HOME
Environment=DISPLAY=:0
ExecStart=$NODE $WB_HOME/run_all.mjs
StandardOutput=append:$WB_HOME/log/service.log
StandardError=append:$WB_HOME/log/service.log
TimeoutStartSec=600
EOF

cat > "$HOME/.config/systemd/user/wb-checkin.timer" <<'EOF'
[Unit]
Description=Run WorkBuddy check-in three times a day

[Timer]
OnCalendar=*-*-* 09:00:00 Asia/Shanghai
OnCalendar=*-*-* 18:00:00 Asia/Shanghai
Persistent=true
RandomizedDelaySec=180
Unit=wb-checkin.service

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now wb-checkin.timer
loginctl enable-linger "$USER" 2>/dev/null || echo "提示：enable-linger 需要 sudo，未开启时桌面未登录不会触发"

echo "--- 已安装 ---"
systemctl --user list-timers wb-checkin.timer --no-pager
echo "工作目录：$WB_HOME"
echo "日志：$WB_HOME/log/service.log"
