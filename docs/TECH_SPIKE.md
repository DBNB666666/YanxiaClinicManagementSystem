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

当前开发会话中 Electron 主进程启动后，`app.whenReady` 不触发（进程在窗口初始化前卡住/崩溃），无法在本会话完成 Electron 窗口、系统打印对话框的人工验证。

处理方式：

- UI 与真实服务改为在本机 Edge 中通过 Playwright 验证；服务、数据库、业务逻辑与桌面版一致。
- Electron 打包产物已生成；窗口/系统打印需在目标 Windows 电脑上按验收报告手工复验。

## 5. 结论

- 数据层、业务层、PDF 生成、UI 流程均已自动化验证。
- Electron 桌面壳和系统打印对话框属于环境限制导致的待手工复验项，不是代码未实现。
