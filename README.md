# TheBell

面向长期备考场景的 **50/10 专注计时、学习计划与倒数日** 应用。以「50 分钟学习 + 10 分钟休息」为默认节奏，把每天的作息、任务、打卡与倒数目标收进一个离线可用的界面。

- Android：原生 APK（Capacitor 7 + 原生 SQLite）
- iPadOS：同一套 Web 代码，仓库内已生成 `ios/App` 工程，需在 macOS 上用 Xcode 构建
- 平板：宽屏使用左侧导航 + 双栏布局；手机使用底部导航
- 数据：全部保存在本地，不联网、不上传、无账号体系

当前版本：**Dev0.4.1**（`versionCode 5`，`pascal.thebell`）。

---

## 目录

- [功能](#功能)
- [技术架构](#技术架构)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [数据模型与备份](#数据模型与备份)
- [权限说明](#权限说明)
- [图标与品牌资产](#图标与品牌资产)
- [版本历史](#版本历史)
- [已知限制](#已知限制)

---

## 功能

### 节奏与倒计时

- **50/10 作息模板**：默认 24 段，含 10 个学习段、8 个休息段与 6 个起居节点；类型、起止时间、内容与顺序均可编辑
- **时长由区间推导**：倒计时时长取 `(end_min - start_min) × 60`，修改作息时间后时长立即跟随，无需手动同步
- **单卡分段倒计时**：左右箭头切换时段，也可从时间线直接选中；支持开始、暂停、重置与标记完成
- **独立计时器**：任意数量的自定义计时器，各自设置时长与颜色，可并行运行且互不干扰
- **双计时系统**：分段倒计时按天保存状态，独立计时器全局保存，两者互不影响
- **自绘时间选择器**：时 / 分双滚轮，带大号时间预览与「使用当前时间」，不依赖系统弹窗
- **结束后衔接**：一段倒计时结束时全屏提示，可一键开始下一段；该提示可在设置中常态关闭

### 首页与任务

- **可配置的首页布局**：卡片支持显示 / 隐藏、整行 / 左栏 / 右栏、栏内排序；默认左栏为「分段倒计时 + 学习任务」，右栏为「今日节奏」
- **可选卡片内容**：指定首页展示哪些独立计时器与倒数日，以及主卡展示哪个倒数日
- **倒数日主卡背景**：紫罗兰 / 日落 / 深海 / 森林 / 午夜 / 樱花六套渐变
- **今日节奏时间线**：按开始时间纵向排列，左侧时间、右侧内容，跨日时间段也能正确排序
- **每日任务**：五个科目分类，逐条勾选划线、编辑、删除，按天独立
- **计划天数**：默认 100 天，范围 1–1000 天；开始日期可改，日期自动顺延
- **主题**：浅色 / 深色 / 跟随系统

### 数据与互操作

- **JSON 导入 / 导出**：包含计划、任务、作息起止时间、打卡状态、分段计时、独立计时器、倒数日、首页布局与偏好设置
- **旧版备份兼容**：同时接受 `thebell/v1` 与旧版「百日冲刺」的 `studyplan/v1`，自动推断作息类型并重建 ID
- **离线持久化**：Android 端写入 SQLite，浏览器预览写入 `localStorage`

---

## 技术架构

| 层 | 选型 |
| --- | --- |
| UI | Vue 3 + TypeScript + Vite，Pinia 状态管理，手写设计系统 |
| 跨平台 | Capacitor 7（Android 真机验证，iOS 工程已生成） |
| 本地存储 | Android 原生 SQLite（自定义 `PascalDb` Capacitor 插件）；浏览器 `localStorage` |
| 备份 | JSON `thebell/v1` |
| 资源生成 | Python（SVG / Android 矢量层）、Node + 无头 Chrome（多密度 PNG） |

业务状态全部保存在 TypeScript 层，原生插件只负责 SQL 执行，便于跨平台迁移与备份格式演进。计时状态只存「剩余秒数 + 结束时间戳」：运行时由 `ends_at` 推算，不每秒写库；暂停时换算回 `remaining_sec`。

平板宽屏适配使用 CSS 容器查询，同一套组件在手机与平板上分别采用底部导航与左侧导航布局，无独立分支。

---

## 快速开始

环境要求：Node.js 20+、JDK 21、Android SDK 35（build-tools 35.0.0）、Gradle 8.11.1。

```bash
npm install
npm run dev          # 浏览器预览（数据存 localStorage）
npm run build        # vue-tsc 类型检查 + Vite 构建
npm run sync         # 构建并同步 Web 资源到 Android 工程
```

### Android

```bash
cd android
./gradlew assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

安装：

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### iPadOS

`ios/App` 已生成并同步插件（Bundle ID `pascal.thebell`，`TARGETED_DEVICE_FAMILY = 1,2`）。在 macOS 上：

```bash
npm install
npm run build
npx cap sync ios
open ios/App/App.xcworkspace
```

在 Xcode 中选择 iPad 模拟器或真机运行。iOS 工程尚未在 macOS 上完成编译与签名验证。

---

## 项目结构

```
src/
  views/                今日 / 计划 / 计时 / 倒数日 / 设置
  components/           首页卡片、时间滚轮选择器、编辑对话框、结束覆盖层
  stores/plan.ts        Pinia 状态：计划、作息、双计时系统与全部业务动作
  lib/
    storage/            StorageDriver：native(SQLite) / web(localStorage)
    backup.ts           JSON 构建、校验与恢复（含旧版兼容）
    seed.ts             默认 100 天计划 + 50/10 作息模板
    segment.ts          时间段换算与格式化
    date.ts             本地日期计算
  types.ts              领域模型与备份结构定义
android/app/src/main/java/pascal/thebell/
  PascalDbPlugin.java   SQLite 桥
ios/App/                         Xcode 工程
resources/                      图标与 logo 源文件、申报图样
scripts/
  logo.py                        生成 SVG 与 Android 自适应图标矢量层
  render_icons.mjs               光栅化多密度 PNG / iOS AppIcon
  generate_assets.py             生成启动图
```

---

## 数据模型与备份

单计划模型，任务、作息与计时均不存 JSON blob：

| 表 | 说明 |
| --- | --- |
| `plan(id=1)` | 名称、开始日期、总天数 |
| `day(idx, date)` | 第 idx 天对应的真实日期 |
| `task(id, day_idx, category, title, done, sort, created_at, done_at)` | 每日任务，含 `idx_task_day` / `idx_task_done` 索引 |
| `routine(id, time_text, start_min, end_min, title, sort, kind, duration_sec)` | 全局作息模板；`kind = routine / study / break`，跨日为 `> 1440` |
| `routine_check(day_idx, routine_id, done)` | 按天打卡，联合主键 |
| `segment_timer(day_idx, routine_id, remaining_sec, ends_at)` | 学习 / 休息段的按天倒计时状态 |
| `custom_timer(id, title, duration_sec, remaining_sec, ends_at, color, created_at)` | 独立计时器 |
| `countdown(id, title, target_date, color, pinned)` | 倒数日 |
| `meta(key, value)` | `theme`、`home_layout`、`alert_on_end` |

旧库中只有 `time_text` 时，首次启动会解析出 `start_min / end_min` 并回写。

### JSON 备份格式

```json
{
  "app": "pascal.thebell",
  "format": "thebell/v1",
  "version": "Dev0.4.1",
  "plan": { "name": "学习计划", "startDate": "2026-11-21", "totalDays": 100 },
  "routine": [
    { "time": "08:00–08:50", "start": "08:00", "end": "08:50", "title": "学习段 1", "kind": "study", "durationSec": 3000 },
    { "time": "08:50–09:00", "start": "08:50", "end": "09:00", "title": "休息 10 分钟", "kind": "break", "durationSec": 600 }
  ],
  "days": [{
    "idx": 1,
    "date": "2026-11-21",
    "tasks": [{ "category": "math", "title": "真题一套", "done": false, "sort": 0 }],
    "routineDone": [0, 2]
  }],
  "customTimers": [
    { "title": "背单词", "durationSec": 1500, "remainingSec": 900, "color": "violet" }
  ],
  "segmentTimers": [
    { "dayIdx": 1, "routineIndex": 1, "remainingSec": 2400 }
  ],
  "countdowns": [{ "title": "目标日", "targetDate": "2027-01-01", "color": "violet", "pinned": true }],
  "home": {
    "cards": [
      { "id": "hero", "visible": true, "zone": "full" },
      { "id": "segment", "visible": true, "zone": "left" },
      { "id": "rhythm", "visible": true, "zone": "right" }
    ],
    "heroCountdownIndex": 0,
    "heroTheme": "sunset",
    "timerIndexes": [0],
    "countdownIndexes": [0]
  },
  "settings": { "theme": "system", "alertOnEnd": true }
}
```

导入时会重新校验日期、科目、作息类型与时长、计时索引，并重建 ID；导出的计时器统一转为暂停状态，避免跨设备恢复时出现负数。旧版 `studyplan/v1` 备份中的作息按标题推断 `study / break / routine`，时长由区间推导。

---

## 权限说明

应用仅声明 `INTERNET`（Capacitor WebView 的基础权限），不申请通知、定位、通讯录或外部存储权限，也不需要运行时授权。所有数据读写都在应用私有目录内完成，应用本身不发起网络请求。

---

## 图标与品牌资产

猫耳时钟：白色底、蓝色圆环、黄色轴心，分针指向 5 点后延伸成猫尾，圆环顶部两只带弧度的猫耳。

- 源文件：`resources/icon.svg`（1024 画布，按部件分组：`ring` / `ear-left` / `ear-right` / `hand-hour` / `hand-minute` / `cat-tail` / `center-pin`）、`icon-square.svg`、`icon-round.svg`、`logo.svg`（透明底）
- 单色与申报图样：`icon-monochrome.svg`、`icon-bw.svg`、`icon-1500.png`、`icon-bw-1500.png`
- 生成：`python scripts/logo.py` 输出 SVG 与 Android 矢量层；`node scripts/render_icons.mjs` 光栅化 `mipmap-*/ic_launcher*.png`、`resources/icon.png` 与 iOS `AppIcon`
- 自适应图标：108dp 画布，纯白 `background` + 矢量 `foreground`，图形控制在中心 66dp 安全区内
- 主题图标（Monet）：`drawable/ic_launcher_monochrome.xml` 提供单色层，Android 13+ 按壁纸取色自动染色
- 配色：蓝 `#2563EB`、黄 `#FBBF24`、白 `#FFFFFF`
- 应用内：侧边栏品牌区、启动加载页、设置「关于」卡片共用 `public/brand-icon.svg`（由 `logo.py` 同步输出，favicon 同源）

---

## 版本历史

| 版本 | 变更 |
| --- | --- |
| **Dev0.4.1** | 分段结束全屏覆盖层与「开始下一段」、结束提示开关（可常态关闭）、正式化项目文档 |
| Dev0.4 | 猫耳时钟 logo、矢量双层自适应图标、Monet 主题图标、应用内品牌统一 |
| Dev0.3 | 自绘时间选择器、首页卡片组件化与布局自定义、倒数日主卡渐变背景 |
| Dev0.2 | 今日节奏时间线、单卡分段倒计时、起止时间驱动时长、作息字段迁移 |
| Dev0.1 | Capacitor + Vue 3 工程、原生 SQLite 存储、JSON 导入导出、平板双栏布局 |

---

## 已知限制

- 单计划模型，不提供多计划切换、账号同步与云备份
- 结束提示依赖应用处于前台或回到前台时触发，不提供系统通知或后台唤醒
- 未实现桌面小组件、Wear OS 磁贴与 iOS Live Activities
- iOS 工程已生成，尚未在 macOS 上完成编译与签名验证
