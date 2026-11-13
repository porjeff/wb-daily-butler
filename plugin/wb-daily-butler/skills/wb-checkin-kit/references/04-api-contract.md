# 接口契约（网页版实测）

所有请求都在 `https://www.workbuddy.cn` 同源下发出，靠浏览器 Cookie 鉴权。脚本通过 CDP 在页面上下文里 `fetch(..., {credentials:'include'})`，因此**不需要任何 token**。

统一响应结构：

```json
{ "code": 0, "msg": "OK", "requestId": "...", "data": { } }
```

`code: 0` 表示成功。`code: -1` 是本套件约定的「未登录」标记（由 HTTP 401 或 `msg: "not login"` 映射而来）。

---

## 1. 查签到状态

```
POST /billing/meter/checkin-activity-status
Content-Type: application/json
body: {}
```

返回 `data`：

```json
{
  "today_checked_in": true,
  "streak_days": 14,
  "today_credit": 100,
  "total_credits": 1400
}
```

- `today_checked_in: true` → 今天已领，直接跳过
- `streak_days` → 连续天数（第 7 天有额外奖励）

## 2. 领取签到

```
POST /billing/meter/daily-checkin
body: {}
```

成功：`code: 0`，`data` 里带本次积分。重复领取会返回非 0 的业务码（不是错误，说明已领过）。

**幂等策略**：先查状态，`today_checked_in === false` 才调领取。不要无脑调。

## 3. 查猫的状态

```
GET /activity/growth/buddy/travel/status
```

返回 `data`：

```json
{
  "state": "idle",
  "buddy_id": 20994165,
  "record_id": 0,
  "location": null,
  "depart_at": 0,
  "arrive_at": 0,
  "server_now": 1794529842,
  "letter": null,
  "use_deeplink": ""
}
```

`state` 观测值：

| 值 | 含义 |
|---|---|
| `idle` | 猫在家，可以派出去 |
| `traveling` | 出行中，不能重复派 |

> 其余枚举值（如「已回来待领奖」）实测中未出现，因为回到 `idle` 前会先能领奖。判断时以 `state === 'idle'` 才派猫，其他值一律跳过，这样最安全。

`arrive_at` 是 Unix 秒，用来算还剩几分钟：`(arrive_at - server_now) / 60`。

## 4. 派猫出发

```
POST /activity/growth/buddy/travel/depart
body: {"location_id": 1}
```

成功返回：

```json
{
  "state": "traveling",
  "buddy_id": 20994165,
  "record_id": 55775217,
  "location": { "id": 1, "code": "coffee", "name": "Coffee Shop", "duration_hours": 4 },
  "depart_at": 1794529861,
  "arrive_at": 1794544261,
  "daily_limit_reached": false
}
```

- `daily_limit_reached: true` 表示今天次数已满，不是错误
- body 为空对象会返回 **400 `invalid request`**——这个 400 可以用来自检「路由是否存在」

## 5. 领回旅行奖励

```
POST /activity/growth/buddy/travel/claim
body: {}
```

不同情况下的返回：

| 情况 | 返回 |
|---|---|
| 有奖励待领 | `code: 0`，领取成功 |
| 猫还在路上 | `msg: "not arrived yet"` |
| 没有待领的 | HTTP 403 `msg: "no unclaimed travel"` |

**这不是错误，是正常状态**，脚本里已按状态翻译。

## 6. 可选：地点列表与猫信息

```
GET /activity/growth/buddy/travel/config   → 4 个地点
GET /activity/growth/buddy/info            → 猫的名字 / 人格 / 稀有度
```

`config.data.locations[]` 每项：

```json
{ "id": 1, "code": "coffee", "name": "Coffee Shop",
  "duration_hours_min": 1, "duration_hours_max": 4,
  "reward_credit_min": 5, "reward_credit_max": 10 }
```

四个地点 id 依次为 1–4，耗时 1–4 小时，奖励 5–10 分。想换地点改 `depart` 的 `location_id`。

---

## 探测新接口的方法（接口改版时用）

1. **GET 候选路径**：返回 404 → 路由不存在；返回 200/403/405 → 路由存在。
2. **POST 空 body**：返回 400 `invalid request` → 路由存在，只是缺参数；返回 404 → 不存在。
3. 找到存在但报参数错的接口后，按业务含义猜字段名（`location_id`、`buddy_id`），一次只加一个参数试。
