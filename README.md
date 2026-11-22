# TheBell_Dev

一个以 **50 分钟学习 + 10 分钟休息** 为节奏的学习时钟、计划与倒数日应用。**Dev0.4.2203**。

本仓库是 TheBell 的**开发版主线**（项目名 `TheBell_Dev`），面向用户安装的软件名为 **TheBell Beta**；稳定版本在独立的稳定版分支仓库中整理发布，本仓库的变更经真机验证后再汇入。

适用于考研、自学考试、语言考试、职业资格考试，以及任何需要长时间专注的场景。

- Android：原生 APK（Capacitor 7 + 原生 SQLite）
- iPadOS：同一套 Web 代码，已生成 `ios/App` 工程（需在 macOS 上用 Xcode 构建）
- 宽屏：平板横屏使用左侧导航 + 双栏布局；手机使用底部导航
- 数据：全部本地存储，不联网、不上传

## 功能

- **50/10 节奏模板**：默认只保留早 / 午 / 晚起居节点，其余时间切成 50 分钟学习 + 10 分钟休息；时间段类型、起止时间、内容、顺序均可编辑
- **时间线节奏**：今日节奏按开始时间排成一条纵向时间线，左侧时间、右侧内容，一眼看清一天的走向
- **单卡倒计时**：左栏顶部（与学习任务同宽）只有一张倒计时卡，与右侧时间线并排；左右箭头切换时段（也可直接点时间线），支持开始 / 暂停 / 重置 / 本段完成
- **首页布局自定义**：卡片可显示/隐藏、整行/左栏/右栏、栏内上下排序；可选首页展示哪些独立计时器与倒数日
- **倒数日主卡背景**：紫罗兰 / 日落 / 深海 / 森林 / 午夜 / 樱花六套渐变，可指定主卡展示哪个倒数日
- **时长随时间走**：倒计时时长由起止时间自动推导，改成 10:00–10:30 就是 30 分钟，不会停留在旧的 50 分钟
- **自绘时间选择器**：时 / 分双滚轮，带大号预览与「使用当前时间」，比系统弹窗更贴合应用视觉
- **独立计时页**：可创建任意数量的自定义计时器，各自设置时长与颜色，可同时运行、互不冲突
- **计划天数自定义**：默认 100 天，范围 1–1000 天；开始日期可改，日期自动顺延
- **每日任务**：数学 / 专业课 / 外语 / 公共课 / 其他五个科目；逐条勾选划线、编辑、删除；按天独立
- **倒数日**：主倒数 + 多个目标日，支持颜色与置顶
- **JSON 导入 / 导出**：包含计划、任务、作息起止时间、打卡状态、分段计时、独立计时器、倒数日、主题
- **主题**：浅色 / 深色 / 跟随系统
- **版本**：`versionName = Dev0.4.2203`，软件名 TheBell Beta，包名 `pascal.thebell`

## 技术栈

| 层 | 选型 |
|---|---|
| UI | Vue 3 + TypeScript + Vite，手写 HeroUI 风格设计系统 |
| 跨平台 | Capacitor 7（Android 真机验证，iOS 工程已生成） |
| 本地数据库 | Android 原生 SQLite（自定义 `PascalDb` 插件） |
| 备份 | JSON `thebell/v1` |

选择 Capacitor 而不是 Flutter：现有业务是 Web 技术栈，一次开发即可同时产出 Android 与 iPadOS 工程，平板宽屏用 CSS 容器查询适配成本最低。

## 本地开发

环境：Node 20+、JDK 21、Android SDK 35。

```bash
npm install
npm run dev          # 浏览器预览（数据存 localStorage）
npm run build        # 类型检查 + 构建
npx cap sync android # 同步 Web 资源到 Android 工程
```

### Android 构建

```bash
cd android
./gradlew assembleDebug
# Windows 本机也可用已安装的 Gradle：
# JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" \
#   "D:/Grandle/gradle-8.11.1/bin/gradle.bat" assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

> 本项目固定 `buildToolsVersion 35.0.0`，并在根 `build.gradle` 中统一所有子模块（含 Capacitor 库模块）的 build-tools，避免损坏的 34.0.0 影响构建。

### iPadOS

`ios/App` 已生成并同步插件（Bundle ID `pascal.thebell`，`TARGETED_DEVICE_FAMILY = 1,2`）。在 macOS 上：

```bash
npm install
npm run build
npx cap sync ios
open ios/App/App.xcworkspace
```

用 Xcode 选择 iPad 模拟器或真机运行。需要 CocoaPods（`pod install` 由 `cap sync` 调用）。当前 Windows 环境无法编译/签名 iOS，属于未验证项。

## 项目结构

```
src/
  views/            今日 / 计划 / 计时 / 倒数日 / 设置
  components/       首页卡片组件（Hero/统计/倒计时/任务/节奏/计时器/倒数日）、时间滚轮选择器、各类编辑对话框
  stores/plan.ts    Pinia 状态：计划、作息、双计时系统与全部业务动作
  lib/
    storage/        StorageDriver：native(SQLite) / web(localStorage)
    backup.ts       JSON 构建、校验与恢复
    seed.ts         默认 100 天计划 + 50/10 节奏模板
    date.ts         本地日期计算
android/
  app/src/main/java/pascal/thebell/PascalDbPlugin.java
ios/App/            Xcode 工程
scripts/
  logo.py           生成 logo SVG 与 Android 自适应图标矢量层
  render_icons.mjs  用无头 Chrome 把 SVG 光栅化成各密度 PNG / iOS 图标
  generate_assets.py 生成启动图
```

## SQLite 结构

单计划模型，任务、作息、计时都不存 JSON blob：

| 表 | 说明 |
|---|---|
| `plan(id=1)` | 名称、开始日期、总天数 |
| `day(idx, date)` | 第 idx 天对应的真实日期 |
| `task(id, day_idx, category, title, done, sort, created_at, done_at)` | 每日任务，`idx_task_day` / `idx_task_done` 索引 |
| `routine(id, time_text, start_min, end_min, title, sort, kind, duration_sec)` | 全局作息模板；`kind = routine / study / break`，`start_min / end_min` 为分钟数（跨日为 `>1440`） |
| `routine_check(day_idx, routine_id, done)` | 按天打卡，联合主键 |
| `segment_timer(day_idx, routine_id, remaining_sec, ends_at)` | 学习 / 休息段的按天倒计时状态 |
| `custom_timer(id, title, duration_sec, remaining_sec, ends_at, color, created_at)` | 独立计时器 |
| `countdown(id, title, target_date, color, pinned)` | 倒数日 |
| `meta(key, value)` | 主题与首页布局（`home_layout` JSON） |

`duration_sec` 由起止时间推导（`(end_min - start_min) × 60`），因此改时间就是改倒计时；旧库只有 `time_text` 时，首次启动会解析成 `start_min / end_min` 并回写。

计时状态只存「剩余秒数 + 结束时间戳」：运行时由 `ends_at` 推算，不每秒写库；暂停时换算回 `remaining_sec`。因此切后台、杀进程后恢复仍能继续。

## JSON 备份格式

```json
{
  "app": "pascal.thebell",
  "format": "thebell/v1",
  "version": "Dev0.4.2203",
  "plan": { "name": "我的学习计划", "startDate": "2026-11-21", "totalDays": 100 },
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
  "settings": { "theme": "system" }
}
```

导入时会重新校验日期、科目、作息类型与时长、计时索引，并重建 ID；导出的计时器统一转为暂停状态，避免跨设备恢复时出现负数。

## 图标与 Logo

猫耳时钟：白色底、黑色圆环、暗金色轴心，分针指向 5 点后延伸成猫尾巴，圆环顶部两只带弧度的猫耳。

- 源文件：`resources/icon.svg`（1024，白色圆角底，按部件分组：ring / ear-left / ear-right / hand-hour / hand-minute / cat-tail / center-pin）、`icon-square.svg`、`icon-round.svg`、`logo.svg`（透明底）、`icon-monochrome.svg`（单色剪影）、`icon-bw.svg`（黑白墨稿）
- 申报图样：`icon-1500.png`（彩色）、`icon-bw-1500.png`（黑白），打包件 `D:/TheBell-icon-source.zip`
- 生成：`python scripts/logo.py` 输出 SVG 与 Android 矢量层；`node scripts/render_icons.mjs` 光栅化 `mipmap-*/ic_launcher*.png`、`resources/icon.png` 与 iOS `AppIcon`
- 自适应图标：108dp 画布，纯白 `background` + 矢量 `foreground`，图形控制在中心 66dp 安全区内，耳朵 / 尾巴不会被任何遮罩裁掉
- 主题图标（Monet）：额外提供 `drawable/ic_launcher_monochrome.xml` 单色层，Android 13+ 会按壁纸取色自动染色
- 配色：黑 `#000000`、暗金 `#B8860B`、白 `#FFFFFF`
- 应用内：侧边栏品牌区、启动加载页、设置「关于」卡片共用 `public/brand-icon.svg`（由 `logo.py` 随 SVG 一起同步，favicon 同源）

## Dev0.4.2203 变更

- 品牌：LOGO 蓝色圆环 / 猫耳 / 指针 / 猫尾全部改为黑色，中心轴心改为暗金色（`#000000` / `#B8860B`），应用图标、Web 角标、favicon、Android 矢量层与多密度 PNG、iOS 图标同步重生成
- 名称体系：项目名 `TheBell_Dev`（本仓库为 TheBell 开发版主线），软件名改为 **TheBell Beta**（桌面名称、应用内品牌、窗口标题、备份分享标题），包名保持 `pascal.thebell`
- 版本 Dev0.4.2203（versionCode 8）

## Dev0.4.2202 变更

- 设置「关于」的平台一行改为运行时获取：显示真实 Android 版本与小米 HyperOS / MIUI 大版本（原生 `DeviceInfo` 插件读取系统属性，无需权限，网页端降级为 User-Agent 解析）
- 学习任务新增顺延模式设置（默认自动顺延）：自动 = 之前未完成任务自动出现在今天；手动 = 任务留在原定日期，切换到那一天后自行顺延
- 首页「继承任务」区支持点击折叠 / 展开
- 今日节奏支持收起已勾选完成的项，一键展开
- 设置页新增「学习任务」卡片；版本 Dev0.4.2202（versionCode 7）

## Dev0.4 变更

- 新 logo：猫耳时钟，蓝色圆环 / 黄色轴心 / 5 点分针延伸成猫尾 / 带弧度的猫耳
- Android 自适应图标改为矢量双层：白色背景 + 前景矢量，并新增 monochrome 层支持主题图标
- 旧版方形 / 圆形 / 自适应 PNG、iOS 图标、favicon、启动图全部换用新 logo
- 清理 Capacitor 模板遗留的 `drawable-v24/ic_launcher_foreground.xml`（会覆盖新前景）
- 版本升级 Dev0.4（versionCode 4）

## Dev0.3 变更

- 自绘时间选择器：时 / 分双滚轮 + 大号预览 + 「使用当前时间」，替换系统时间弹窗
- 首页卡片拆成独立组件，支持显示/隐藏、整行/左栏/右栏、栏内上下排序
- 默认布局：左栏「分段倒计时 + 学习任务」，右栏「今日节奏」，倒计时卡与任务卡等宽
- 倒数日主卡支持 6 套渐变背景，并可选展示哪个倒数日
- 新增「独立计时器」「倒数日清单」两张可选卡片，自由勾选要展示的条目
- 首页布局存于 SQLite `meta.home_layout`，并写入 JSON 备份（按索引保存选择）

## Dev0.2 变更

- 今日节奏改为纵向时间线：左侧起止时间、右侧内容，按开始时间排列，跨日的时间段也能正确排序
- 取消「每段一张计时卡」，改为学习任务上方一张倒计时卡：左右箭头切换时段，或直接点时间线选中
- 修复：修改起止时间后倒计时仍停留在旧时长；现在时长由区间推导，改完立即重置
- 时间段编辑改用原生时间选择器（`input[type=time]`），并保留手输规整（830 → 08:30）
- 新增 10 / 25 / 30 / 50 分钟快捷时长，一键把结束时间设为开始 + N 分钟
- SQLite 新增 `routine.start_min / end_min`，旧数据自动解析迁移；JSON 备份新增 `start` / `end`

## Dev0.4 已知边界

- 单计划模型（不做多计划切换 / 账号同步 / 云备份）
- 暂无通知提醒、桌面小组件、后台常驻计时（切后台后按时间戳继续，但不会发系统通知）
- iOS 工程已生成但未在 macOS 上编译验证
