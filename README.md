# 百日冲刺 · StudyPlan

一个可自定义天数的学习计划 / 倒数日应用。**Dev0.1**。

- Android：原生 APK（Capacitor 7 + 原生 SQLite）
- iPadOS：同一套 Web 代码，已生成 `ios/App` 工程（需在 macOS 上用 Xcode 构建）
- 宽屏：平板横屏使用左侧导航 + 双栏布局；手机使用底部导航
- 数据：全部本地存储，不联网、不上传
- 仓库不含任何个人计划 / 考试日期 / 科目偏好，首次启动生成中性的 100 天空白计划

## 功能

- **计划天数自定义**：默认 100 天，范围 1–1000 天；开始日期可改，日期自动顺延
- **每日任务**：数学 / 专业课 / 英语 / 政治 / 其他五个科目；逐条勾选划线、编辑、删除；按天独立
- **每日作息**：时间段与内容均可编辑，支持上下移动排序；每天独立打卡
- **倒数日**：主倒数 + 多个目标日，支持颜色与置顶
- **JSON 导入 / 导出**：包含计划、每天任务、作息时间段、打卡状态、倒数日、主题
- **主题**：浅色 / 深色 / 跟随系统
- **版本**：`versionName = Dev0.1`，包名 `pascal.studyplan`

## 技术栈

| 层 | 选型 |
|---|---|
| UI | Vue 3 + TypeScript + Vite，手写 HeroUI 风格设计系统 |
| 跨平台 | Capacitor 7（Android 已跑通，iOS 工程已生成） |
| 本地数据库 | Android 原生 SQLite（自定义 `PascalDb` 插件） |
| 备份 | JSON `studyplan/v1` |

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
# 或使用本机已安装的 Gradle：
# JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" \
#   "D:/Grandle/gradle-8.11.1/bin/gradle.bat" assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

> 本项目固定 `buildToolsVersion 35.0.0`，并在根 `build.gradle` 中统一所有子模块（含 Capacitor 库模块）的 build-tools，避免本机损坏的 34.0.0 影响构建。

### iPadOS

`ios/App` 已生成并同步插件（Bundle ID `pascal.studyplan`，`TARGETED_DEVICE_FAMILY = 1,2`）。在 macOS 上：

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
  views/            今日 / 计划 / 倒数日 / 设置
  components/       弹层、任务行、进度环、各类编辑对话框
  stores/plan.ts    Pinia 状态与全部业务动作
  lib/
    storage/        StorageDriver：native(SQLite) / web(localStorage)
    backup.ts       JSON 构建、校验与恢复
    seed.ts         默认 100 天计划与中性作息模板（不含个人数据）
    date.ts         本地日期计算（UTC 计算避免时区偏移）
android/
  app/src/main/java/pascal/studyplan/PascalDbPlugin.java
ios/App/            Xcode 工程
scripts/generate_assets.py  图标 / 启动图生成
```

## SQLite 结构

单计划模型，表之间用 `day_idx` / `routine_id` 关联，任务与打卡不存 JSON blob：

| 表 | 说明 |
|---|---|
| `plan(id=1)` | 名称、开始日期、总天数 |
| `day(idx, date)` | 第 idx 天对应的真实日期 |
| `task(id, day_idx, category, title, done, sort, created_at, done_at)` | 每日任务，`idx_task_day` / `idx_task_done` 索引 |
| `routine(id, time_text, title, sort)` | 全局作息模板 |
| `routine_check(day_idx, routine_id, done)` | 按天打卡，联合主键 |
| `countdown(id, title, target_date, color, pinned)` | 倒数日 |
| `meta(key, value)` | 主题等键值设置 |

## JSON 备份格式

```json
{
  "app": "pascal.studyplan",
  "format": "studyplan/v1",
  "version": "Dev0.1",
  "plan": { "name": "我的百日计划", "startDate": "2026-11-19", "totalDays": 100 },
  "routine": [{ "time": "8:30–12:30", "title": "数学 4h" }],
  "days": [{
    "idx": 1,
    "date": "2026-11-19",
    "tasks": [{ "category": "math", "title": "真题一套", "done": false, "sort": 0 }],
    "routineDone": [0, 2]
  }],
  "countdowns": [{ "title": "目标日", "targetDate": "2027-01-01", "color": "violet", "pinned": true }],
  "settings": { "theme": "system" }
}
```

导入时会重新校验日期、科目、天数与打卡索引，并重建 ID；不会直接信任外部 JSON 的日期字段。

## Dev0.1 已知边界

- 单计划模型（不做多计划切换 / 账号同步 / 云备份）
- 暂无通知提醒、桌面小组件、重复任务
- iOS 工程已生成但未在 macOS 上编译验证
