# TheBell

一个以 **50 分钟学习 + 10 分钟休息** 为节奏的学习时钟、计划与倒数日应用。**Dev0.1**。

适用于考研、自学考试、语言考试、职业资格考试，以及任何需要长时间专注的场景。

- Android：原生 APK（Capacitor 7 + 原生 SQLite）
- iPadOS：同一套 Web 代码，已生成 `ios/App` 工程（需在 macOS 上用 Xcode 构建）
- 宽屏：平板横屏使用左侧导航 + 双栏布局；手机使用底部导航
- 数据：全部本地存储，不联网、不上传

## 功能

- **50/10 节奏模板**：默认只保留早 / 午 / 晚起居节点，其余时间切成 50 分钟学习 + 10 分钟休息；时间段类型、时长、内容、顺序均可编辑
- **分段倒计时**：每个学习 / 休息段都是可暂停、可重置的秒级倒计时小卡片，按天独立保存
- **独立计时页**：可创建任意数量的自定义计时器，各自设置时长与颜色，可同时运行、互不冲突
- **计划天数自定义**：默认 100 天，范围 1–1000 天；开始日期可改，日期自动顺延
- **每日任务**：数学 / 专业课 / 外语 / 公共课 / 其他五个科目；逐条勾选划线、编辑、删除；按天独立
- **倒数日**：主倒数 + 多个目标日，支持颜色与置顶
- **JSON 导入 / 导出**：包含计划、任务、作息时间段、打卡状态、分段计时、独立计时器、倒数日、主题
- **主题**：浅色 / 深色 / 跟随系统
- **版本**：`versionName = Dev0.1`，包名 `pascal.thebell`

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
  components/       分段卡片、计时器弹窗、任务行、进度环、各类编辑对话框
  stores/plan.ts    Pinia 状态：计划、作息、双计时系统与全部业务动作
  lib/
    storage/        StorageDriver：native(SQLite) / web(localStorage)
    backup.ts       JSON 构建、校验与恢复
    seed.ts         默认 100 天计划 + 50/10 节奏模板
    date.ts         本地日期计算
android/
  app/src/main/java/pascal/thebell/PascalDbPlugin.java
ios/App/            Xcode 工程
scripts/generate_assets.py  图标 / 启动图生成
```

## SQLite 结构

单计划模型，任务、作息、计时都不存 JSON blob：

| 表 | 说明 |
|---|---|
| `plan(id=1)` | 名称、开始日期、总天数 |
| `day(idx, date)` | 第 idx 天对应的真实日期 |
| `task(id, day_idx, category, title, done, sort, created_at, done_at)` | 每日任务，`idx_task_day` / `idx_task_done` 索引 |
| `routine(id, time_text, title, sort, kind, duration_sec)` | 全局作息模板；`kind = routine / study / break` |
| `routine_check(day_idx, routine_id, done)` | 按天打卡，联合主键 |
| `segment_timer(day_idx, routine_id, remaining_sec, ends_at)` | 学习 / 休息段的按天倒计时状态 |
| `custom_timer(id, title, duration_sec, remaining_sec, ends_at, color, created_at)` | 独立计时器 |
| `countdown(id, title, target_date, color, pinned)` | 倒数日 |
| `meta(key, value)` | 主题等键值设置 |

计时状态只存「剩余秒数 + 结束时间戳」：运行时由 `ends_at` 推算，不每秒写库；暂停时换算回 `remaining_sec`。因此切后台、杀进程后恢复仍能继续。

## JSON 备份格式

```json
{
  "app": "pascal.thebell",
  "format": "thebell/v1",
  "version": "Dev0.1",
  "plan": { "name": "我的学习计划", "startDate": "2026-11-21", "totalDays": 100 },
  "routine": [
    { "time": "08:00–08:50", "title": "学习段 1", "kind": "study", "durationSec": 3000 },
    { "time": "08:50–09:00", "title": "休息 10 分钟", "kind": "break", "durationSec": 600 }
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
  "settings": { "theme": "system" }
}
```

导入时会重新校验日期、科目、作息类型与时长、计时索引，并重建 ID；导出的计时器统一转为暂停状态，避免跨设备恢复时出现负数。

## Dev0.1 已知边界

- 单计划模型（不做多计划切换 / 账号同步 / 云备份）
- 暂无通知提醒、桌面小组件、后台常驻计时（切后台后按时间戳继续，但不会发系统通知）
- iOS 工程已生成但未在 macOS 上编译验证
