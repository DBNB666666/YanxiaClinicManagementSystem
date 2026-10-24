# 燕霞诊所管理系统

Windows 绿色免安装单机版，版本 **0.3.0**。三个模块：处方（含详情页）、药房、财务，另有库存预警通知。

技术栈：Electron + React + TypeScript + electron-vite + sql.js（SQLite WASM）+ pdf-lib。

## 运行

```powershell
npm install
npm run dev
```

首次启动会在软件目录下创建 `data/`，包含数据库、备份、日志和运行时缓存。

### 解压后双击 exe 没窗口？

如果软件被解压到带“低完整性”标签的目录（某些沙箱/AI 工具创建的桌面目录），Electron 会直接退出。请把压缩包解压到 `C:\Users\HP\Desktop` 或 `C:\Apps` 这类普通目录，或直接双击包内的 `启动燕霞诊所管理系统.cmd`。

详细原因和验证步骤见 [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)。

## 构建与打包

```powershell
npm run build
npm run package:win
```

打包产物在 `release/`：解压 zip 后双击 `yanxia-clinic.exe`；如果目录受低完整性限制，双击 `启动燕霞诊所管理系统.cmd`。

## 测试

```powershell
npm run verify      # 类型检查 + lint + 单元/集成测试 + 构建
npm run test:e2e    # 构建后启动测试服务，用本机 Edge 跑 UI 测试
npm run test:package # 解压安装包，从低完整性目录启动并验证
```

- 单元/集成：金额、日期、校验、SQLite 持久化、处方/库存/财务/通知、PDF、备份。
- UI 测试：Playwright + 本机 Edge，连接真实 `ClinicService` 和 sql.js 测试数据库。
- 测试数据：`YANXIA_DATA_DIR` 指向临时目录；不会碰真实诊所数据。

## 目录

- `src/main`：主进程、数据库、业务服务、IPC、打印/PDF。
- `src/preload`：`contextBridge` 白名单 API。
- `src/renderer`：React 页面与三套主题。
- `src/shared`：类型、校验、金额、日期、打印模板。
- `tests`：Vitest 与 Playwright。
- `docs`：使用说明、验收报告、已知问题、技术验证记录。

## 文档

- [PRD](PRD.md)
- [开发计划](DEVELOPMENT_PLAN.md)
- [使用说明](docs/USER_GUIDE.md)
- [启动问题排查](docs/TROUBLESHOOTING.md)
- [验收报告](docs/ACCEPTANCE_REPORT.md)
- [已知问题](docs/KNOWN_ISSUES.md)

## 说明

当前版本是本机单用户、离线软件；没有登录、云同步、手机版或自动更新。数据全部在 `data/`，搬走整个软件文件夹即搬走全部数据。
