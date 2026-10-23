# 技术验证记录（M1）

## 1. 环境

- Node：v24.18.0
- npm：11.16.0
- Electron：45.0.0（本机缓存二进制）
- Windows：11 build 26200
- 浏览器：Microsoft Edge（Playwright channel=msedge）

## 2. sql.js 单文件持久化

命令：`node scripts/check-sqljs.cjs`

结果：**通过**，输出 `sql.js ok`。

验证内容：初始化 WASM → 建表 → 插入 → `db.export()` → `write-file-atomic` 写盘 → 重新打开 → 查询。

## 3. A5 中文 PDF

实际生产路径：`src/main/services/pdfService.ts`（pdf-lib + `@pdf-lib/fontkit` + 系统 SimHei）。

自动化验证：`tests/integration/pdf.test.ts`、`tests/e2e/print.spec.ts`

结果：**通过**。

- 单张 PDF：A5（148×210mm），1 页。
- 批量 PDF：每张处方从新页开始。
- 中文患者/药品/金额正常输出。
- 页脚包含打印时间和页码。

## 4. Electron 窗口验证

最初 Electron 从 `E:\Users\HP\Desktop\...` 启动时在 `app.whenReady` 前崩溃（crashpad `not connected`，Windows 事件 `0xc0000005`）。进一步排查发现：

- `E:\Users\HP\Desktop` 带有 **Low Mandatory Level（低完整性）** 标签；
- 该目录下的 `electron.exe` 被 Windows 以低完整性运行，Chromium 沙箱/缓存初始化失败；
- 把同一份程序复制到 `C:\Users\HP\Desktop` 或 `%TEMP%`（普通目录）后，`app.whenReady` 正常触发，窗口标题“燕霞诊所管理系统”，并创建 `data/clinic.db`。

处理方式：

- 发布包改为 `yanxia-clinic.exe` + `启动燕霞诊所管理系统.cmd`；
- 启动脚本把程序复制到 `%LOCALAPPDATA%\Programs\YanxiaClinicManagementSystem` 再启动；
- `npm run test:package` 在低完整性目录解压并验证窗口/数据库创建；
- 系统打印对话框仍需目标机器手工复验。

## 5. 结论

- 数据层、业务层、PDF 生成、UI 流程、打包后窗口启动均已自动化验证。
- 启动失败的根因是目录低完整性标签，不是业务代码；两种规避方式已写入使用说明。
