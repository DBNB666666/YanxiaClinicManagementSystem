# 验收报告（v0.1.0）

日期：2026-10-24
版本：0.1.0
环境：Windows 11 build 26200 / Node 24.18 / Edge headless / sql.js 1.15.1

## 1. 自动化结果

### 1.1 单元与集成（Vitest）

命令：`npm test`

结果：**7 个测试文件、37 条用例全部通过**。

| 文件 | 覆盖 |
| --- | --- |
| `tests/unit/money.test.ts` | 元/分转换、金额格式、盈利符号、整数运算 |
| `tests/unit/date.test.ts` | 周一为周起点、日/周/月/年范围、周期翻页、日期校验 |
| `tests/unit/validation.test.ts` | 药品/处方/进货必填、未来日期、Rp 500、数量/成本校验 |
| `tests/integration/clinicService.test.ts` | 药品增改查、进货、停用/删除规则、处方创建/编辑/删除、库存差额、价格快照、手动金额、财务日/周/月/年、负盈利、通知触发/去重/恢复、设置 |
| `tests/integration/backup.test.ts` | 每日备份、7 份保留 |
| `tests/integration/pdf.test.ts` | 图片 HTML 模板、130×190mm 单张 PDF、模板图片嵌入、批量 PDF 页数 |
| `tests/integration/persistence.test.ts` | 关闭后重新打开数据仍在 |

### 1.2 UI 流程（Playwright + Edge + 真实服务）

命令：`npm run test:e2e`

结果：**17 条 UI 用例全部通过**。

| 文件 | 覆盖 |
| --- | --- |
| `theme.spec.ts` | 处方首页、三套主题切换、重启后保留 |
| `pharmacy.spec.ts` | 列表/搜索/筛选/视图、新增药品、进货、停用、已用药品删除转停用 |
| `prescription.spec.ts` | 列表/搜索/视图、卡片/列表进入详情、详情编辑/打印/删除、编辑扣库存、新建处方、库存不足确认、删除退库存 |
| `finance.spec.ts` | 日/周/月/年汇总、图表、期间明细抽屉 |
| `notification.spec.ts` | 未读红点、通知抽屉、跳转药品详情、已读消红点 |
| `print.spec.ts` | 图片模板预览、130×190mm 单张 PDF、批量导出多页、页面尺寸 |

### 1.3 打包启动（低完整性目录）

命令：`npm run package:win` 后执行 `npm run test:package`

结果：**通过**。

- 把 v0.1.0 zip 解压到 `E:\Users\HP\Desktop\YanxiaClinicManagementSystem\.tmp\package-launch-test`（继承 Low Mandatory Level）；
- 运行 `启动燕霞诊所管理系统.cmd`；
- 脚本把程序复制到 `%TEMP%\yanxia-package-test-target`（普通完整性目录）；
- 12–20 秒内出现窗口“燕霞诊所管理系统”，并创建 `data/clinic.db`；
- 测试结束后清理测试进程和临时目录。

### 1.4 质量门

命令：`npm run verify`

结果：**通过**（typecheck + lint + 37 条测试 + 构建）。

## 2. 与 PRD 验收标准的对应

- 已验证核心数据链路：处方创建/编辑/删除、库存扣减/差额/退回、价格快照、财务汇总、负盈利、通知触发/去重/恢复。
- 已验证三套主题、卡片/列表、搜索、分页、空状态、库存不足确认、已用药品停用。
- 已验证图片模板预览、130×190mm 正32开 PDF、批量多页、文件导出和打印预览。
- Electron 窗口已在 `npm run test:package` 中实际打开（标题“燕霞诊所管理系统”），并创建数据库；低完整性目录问题已定位并给出启动脚本方案。
- 以下 PRD 用例仍属于**手工验收**：
  - 系统打印对话框、实体打印机、正32开纸张。
  - Windows 10/11 双系统、125%/150% 缩放下的窗口实测。
  - 强杀进程后重开、只读目录、真实备份恢复。
  - 读屏软件/Narrator、真实物理打印机。

## 3. 已知问题

见 [KNOWN_ISSUES.md](KNOWN_ISSUES.md)。

## 4. 交付物

- 源代码（Electron + React + TypeScript）。
- 绿色版 zip：`release/YanxiaClinicManagementSystem-0.1.0-win-x64.zip`。
- 使用说明、已知问题、技术验证记录。
- 本报告。

## 5. 结论

自动化范围（37 + 17 + 1 打包启动）全部通过；核心业务、处方详情、UI 流程、图片模板 PDF、打包后窗口启动已具备交付条件。系统打印/实体打印机属于目标机器手工复验项。
