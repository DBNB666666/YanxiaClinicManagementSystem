# 燕霞诊所管理系统 · 开发计划（DEVELOPMENT_PLAN）

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v1.0 |
| 编写日期 | 2026-10-23 |
| 需求依据 | `PRD.md` v1.1（含 103 条验收用例） |
| 目标平台 | Windows 10 / 11 64 位，绿色免安装、离线单机 |
| 执行方式 | 由开发 agent 按 M0–M10 顺序执行；每个里程碑一个可验收提交 |
| 当前状态 | 待你确认后开始执行 |

> **使用说明**
>
> - 本计划是“怎么建”的执行手册；需求、规则和验收标准以 `PRD.md` 为准，两者冲突时先改 PRD 再改本计划。
> - 每个里程碑结束必须通过该阶段的“验证命令 + 验收点”，并提交 Git；不通过不进入下一阶段。
> - 文中命令均在项目根目录 `E:\Users\HP\Desktop\YanxiaClinicManagementSystem` 执行。
> - 标“默认”的地方，未收到你的修改意见就按默认执行。
> - 技术验证门（M1）如果失败，会启用文中写好的回退方案，不会带病往下做。

---

## 0. 执行约定

1. **需求冻结**：第一版按 PRD 第三章执行；“暂时不做”的功能不写。
2. **先验证后扩展**：M1 先验证两件最容易返工的事——sql.js 单文件持久化和 A5 中文 PDF；验证通过再进入数据层。
3. **一个里程碑一个提交**：提交信息见各阶段；每个提交必须能 `npm run verify` 通过。
4. **自动化优先**：金额、库存、财务、通知必须有自动化测试；打印版式、主题、可访问性保留人工验收。
5. **数据安全优先**：任何破坏性测试都用 `YANXIA_DATA_DIR` 指向临时目录，不碰真实数据。
6. **范围变更**：新增需求先记到 PRD 第九章变更记录，评估后再决定是否进入第一版。

### 0.1 开始前需要你确认的默认值

PRD 第八章的 5 个待确认点，未收到修改意见时按以下默认执行：

| 编号 | 默认 |
| --- | --- |
| Q1 打印抬头 | 只印“燕霞诊所”+ 横线 + 医师签名线 |
| Q2 处方纸费用 | 印药品金额 / 注射费 / 合计 |
| Q3 批量导出 | 合并成一个 PDF，每张从新页开始 |
| Q4 已用药品删除 | 只能停用，不物理删除 |
| Q5 年龄输入 | 文本框，可填“62”或“8个月” |

---

## 1. 交付目标

### 1.1 最终交付物

- 可运行的 Windows 绿色版程序：解压后双击即用，不安装、不联网。
- 源代码（Electron + React + TypeScript）与完整构建脚本。
- `PRD.md`、`DEVELOPMENT_PLAN.md`。
- `docs/USER_GUIDE.md`：数据目录、备份/恢复、打印设置。
- `docs/ACCEPTANCE_REPORT.md`：按 PRD 7.8 模板填写的测试记录。
- `docs/KNOWN_ISSUES.md`：已知问题与规避方案。
- 打包产物：`release/YanxiaClinicManagementSystem-1.0.0-win-x64.zip`。

### 1.2 第一版功能（与 PRD 第三章一致）

- 处方：列表/卡片、搜索、增删改、打印、单张/批量 PDF、用药从药房选、数量/用法/频率、金额与成本自动算、扣库存。
- 药房：列表/卡片、搜索、增删改、详情、开药次数、进货、预警库存、停用/恢复。
- 财务：日/周/月/年账本、收入/成本/盈利、趋势图、期间明细。
- 通知：铃铛、未读红点/数量、抽屉、点击跳药品详情、补货自动已读。
- 通用：三套主题、卡片/列表、本地保存、自动备份、打印预览。

### 1.3 明确不做

- 登录、云同步、手机版、多设备、多人协作。
- 患者档案、病历、预约、药品批次/效期/条码、退药退款、Excel 导入导出。
- 自定义打印模板、自动更新、安装程序、系统托盘常驻。
- 其他见 PRD 3.2。

---

## 2. 技术方案

### 2.1 选型表

| 层 | 选型 | 版本 | 说明 |
| --- | --- | --- | --- |
| 桌面容器 | Electron | 45.0.0 | 绿色免安装、系统打印、`printToPDF`、Windows 原生窗口 |
| 构建 | electron-vite | 6.0.0 | main / preload / renderer 三端统一构建 |
| 构建 | Vite | 8.3.5 | 渲染进程构建 |
| UI | React + React DOM | 19.3.1 | 组件化页面 |
| 路由 | react-router-dom | 7.18.4 | `HashRouter`，打包后 `file://` 可用 |
| 语言 | TypeScript | 7.0.2 | 严格模式 |
| 样式 | CSS Modules + CSS 变量 | — | 三套主题、无 UI 框架，保证克制风格 |
| 图标 | lucide-react | 1.61.0 | 1.5px 线条图标 |
| 数据库 | sql.js | 1.15.1 | SQLite WASM；无原生模块，测试与 Electron 同引擎；内存库 + 原子写单文件 |
| 原子写 | write-file-atomic | 7.0.1 | 数据文件 temp + rename，防半截写 |
| 校验 | zod | 4.6.7 | 主进程 IPC 入参和表单共用 schema |
| PDF | Electron `printToPDF` | 内置 | A5、中文、批量分页 |
| PDF 测试 | pdf-lib / pdfjs-dist | 1.17.1 / 6.4.299 | 测页面尺寸、页数、文字 |
| 日志 | electron-log | 5.4.4 | 写 `data/logs/main.log` |
| 打包 | electron-builder | 26.15.3 | `zip` 目标，绿色版 |
| 单元/集成测试 | Vitest | 5.0.5 | Node 环境，临时数据库 |
| E2E | @playwright/test | 1.64.1 | 启动 Electron 做真实 UI 测试 |
| 可访问性 | @axe-core/playwright | 4.14.0 | 自动跑对比度/表单标签 |
| 本机工具 | Node / npm / VS / Python | 24.18.0 / 11.16.0 / VS Community 2026 / 3.12.10 | 已确认可用 |

### 2.2 为什么这样选

- **Electron**：Windows 绿色版最直接；`webContents.printToPDF` 能稳定输出 A5 中文 PDF；系统打印对话框开箱即用；不需要另装 WebView 运行时。
- **sql.js**：SQLite 的 WASM 版本，主进程和 Node 测试用同一个引擎，**不需要为 Electron 重新编译原生模块**；单用户、数据量小，采用“内存库 + 每次写后原子导出单文件”，配合每日备份足够稳。数据量将来很大时，可在 Repository 接口后换成 better-sqlite3，不影响页面。
- **不引入 UI 框架**：PRD 要求克制、严肃、三套主题；自己写 CSS 变量和少量组件，比套现成组件更容易控制密度和颜色。
- **HashRouter**：打包后是 `file://`，Hash 路由最稳。
- **Zod**：主进程不能信任渲染进程传来的数据；同一套 schema 也用于表单校验。
- **Vitest + Playwright**：金额/库存/财务用集成测试锁住；关键流程用真实 Electron E2E 锁住。

### 2.3 架构

```text
┌──────────────────────── Renderer（React） ────────────────────────┐
│  页面 / 组件 / 主题 / Toast / 通知抽屉 / 打印预览                  │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ window.api（contextBridge，类型化）
┌──────────────────────────────▼─────────────────────────────────────┐
│  Preload：只暴露白名单方法，不暴露 ipcRenderer / Node              │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ ipcRenderer.invoke
┌──────────────────────────────▼─────────────────────────────────────┐
│  Main：IPC 校验 → Service（事务）→ Repository → SQLite             │
│        备份 / 打印 / PDF / 日志 / 单实例 / 数据目录检查            │
└────────────────────────────────────────────────────────────────────┘
```

- 渲染进程不直接读写文件、不直接连数据库、不直接调打印。
- 所有业务写操作在主进程用事务完成，成功后返回结果；失败返回统一错误对象。
- 通知生成、库存扣减、财务重算都在主进程服务层完成，渲染进程只负责展示和刷新。

### 2.4 数据目录

```text
<软件目录>/
  燕霞诊所管理系统.exe
  data/
    clinic.db                 # SQLite 主数据
    backups/
      clinic-2026-10-23.db    # 每天一份，保留 7 份
    logs/
      main.log
    runtime/                  # Chromium 的 userData，避免缓存污染 data 根目录
```

规则：

- 打包后：`<exe 所在目录>/data`。
- 开发时：`<项目根>/.dev-data`，避免和打包数据混在一起。
- 测试时：环境变量 `YANXIA_DATA_DIR` 指向临时目录，优先级最高。
- 启动时做一次写权限探测；不可写则弹窗说明并退出，不带着坏路径继续跑。
- 单实例锁：第二次启动聚焦已有窗口，避免两个进程同时写库。

### 2.5 安全约定

- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。
- 禁止窗口跳转到外部 URL；`setWindowOpenHandler` 一律拒绝。
- 生产环境 CSP：`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'`。
- 不加载远程页面、不发网络请求、不做遥测。
- IPC 全部 Zod 校验；错误只返回业务错误码和人话，不返回堆栈。

### 2.6 技术验证门（M1 必须通过）

| 验证 | 方法 | 通过标准 | 失败回退 |
| --- | --- | --- | --- |
| SQLite 持久化（sql.js） | `npx electron scripts/check-sqljs.cjs` | 建表、插入、`db.export()`、原子写盘、重新打开、查询全部通过，打印 `sql.js ok` | 改用 `sql-asm.js`（无 wasm）；仍不行再评估 better-sqlite3 |
| A5 中文 PDF | `npx electron scripts/spike-print.cjs` | 输出 `spike-a5.pdf`，页面 148×210mm，中文不丢字 | 改用 `pdf-lib` + 内置 Noto Sans SC 字体，手绘版式 |
| 打印对话框 | 上述 PDF 用系统打印预览打开 | 能正常调起 Windows 打印 | 先保证 PDF，打印用 `webContents.print` 另测 |

> sql.js 持久化和 PDF 版式是最大返工点，必须在写业务代码前验证；验证结果写入 `docs/TECH_SPIKE.md`。

---

## 3. 目录结构

```text
.
├─ package.json
├─ package-lock.json
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ tsconfig.json
├─ tsconfig.node.json
├─ tsconfig.web.json
├─ vitest.config.ts
├─ playwright.config.ts
├─ eslint.config.js
├─ .prettierrc
├─ .editorconfig
├─ .gitignore
├─ PRD.md
├─ DEVELOPMENT_PLAN.md
├─ docs/
│  ├─ TECH_SPIKE.md
│  ├─ ACCEPTANCE_REPORT.md
│  ├─ KNOWN_ISSUES.md
│  └─ USER_GUIDE.md
├─ scripts/
│  ├─ check-sqljs.cjs
│  ├─ spike-print.cjs
│  ├─ seed-test-data.ts
│  └─ seed-perf-data.ts
├─ src/
│  ├─ main/
│  │  ├─ index.ts
│  │  ├─ window.ts
│  │  ├─ env.ts
│  │  ├─ logger.ts
│  │  ├─ db/
│  │  │  ├─ paths.ts
│  │  │  ├─ connection.ts
│  │  │  ├─ schema.ts
│  │  │  └─ migrate.ts
│  │  ├─ repositories/
│  │  │  ├─ drugRepository.ts
│  │  │  ├─ purchaseRepository.ts
│  │  │  ├─ prescriptionRepository.ts
│  │  │  ├─ financeRepository.ts
│  │  │  ├─ notificationRepository.ts
│  │  │  └─ settingsRepository.ts
│  │  ├─ services/
│  │  │  ├─ drugService.ts
│  │  │  ├─ prescriptionService.ts
│  │  │  ├─ financeService.ts
│  │  │  ├─ notificationService.ts
│  │  │  ├─ settingsService.ts
│  │  │  ├─ backupService.ts
│  │  │  ├─ printService.ts
│  │  │  └─ pdfService.ts
│  │  ├─ ipc/
│  │  │  ├─ index.ts
│  │  │  ├─ drugHandlers.ts
│  │  │  ├─ prescriptionHandlers.ts
│  │  │  ├─ financeHandlers.ts
│  │  │  ├─ notificationHandlers.ts
│  │  │  ├─ settingsHandlers.ts
│  │  │  └─ printHandlers.ts
│  │  └─ seed/
│  │     └─ testData.ts
│  ├─ preload/
│  │  └─ index.ts
│  ├─ renderer/
│  │  ├─ index.html
│  │  └─ src/
│  │     ├─ main.tsx
│  │     ├─ App.tsx
│  │     ├─ router.tsx
│  │     ├─ styles/
│  │     │  ├─ tokens.css
│  │     │  ├─ themes.css
│  │     │  └─ global.css
│  │     ├─ app/
│  │     │  ├─ AppShell.tsx
│  │     │  ├─ TopBar.tsx
│  │     │  ├─ StatusBar.tsx
│  │     │  ├─ ThemeMenu.tsx
│  │     │  └─ NotificationButton.tsx
│  │     ├─ components/
│  │     │  ├─ Button.tsx
│  │     │  ├─ IconButton.tsx
│  │     │  ├─ Input.tsx
│  │     │  ├─ Textarea.tsx
│  │     │  ├─ NumberInput.tsx
│  │     │  ├─ Select.tsx
│  │     │  ├─ Combobox.tsx
│  │     │  ├─ DateInput.tsx
│  │     │  ├─ SegmentedControl.tsx
│  │     │  ├─ Checkbox.tsx
│  │     │  ├─ Tag.tsx
│  │     │  ├─ Card.tsx
│  │     │  ├─ DataTable.tsx
│  │     │  ├─ Pagination.tsx
│  │     │  ├─ EmptyState.tsx
│  │     │  ├─ Skeleton.tsx
│  │     │  ├─ Dialog.tsx
│  │     │  ├─ Drawer.tsx
│  │     │  ├─ Toast.tsx
│  │     │  ├─ SearchInput.tsx
│  │     │  ├─ ViewToggle.tsx
│  │     │  ├─ PageHeader.tsx
│  │     │  ├─ Toolbar.tsx
│  │     │  ├─ FormField.tsx
│  │     │  ├─ MoneyText.tsx
│  │     │  ├─ StatCard.tsx
│  │     │  ├─ GroupedBarChart.tsx
│  │     │  └─ ConfirmDialog.tsx
│  │     ├─ pages/
│  │     │  ├─ prescriptions/
│  │     │  │  ├─ PrescriptionListPage.tsx
│  │     │  │  ├─ PrescriptionEditPage.tsx
│  │     │  │  ├─ DrugPickerDialog.tsx
│  │     │  │  └─ PrescriptionPrintPage.tsx
│  │     │  ├─ pharmacy/
│  │     │  │  ├─ PharmacyListPage.tsx
│  │     │  │  ├─ DrugEditPage.tsx
│  │     │  │  ├─ DrugDetailPage.tsx
│  │     │  │  └─ PurchaseDialog.tsx
│  │     │  ├─ finance/
│  │     │  │  └─ FinancePage.tsx
│  │     │  └─ notifications/
│  │     │     └─ NotificationDrawer.tsx
│  │     ├─ hooks/
│  │     │  ├─ useIpcQuery.ts
│  │     │  ├─ usePrescriptions.ts
│  │     │  ├─ useDrugs.ts
│  │     │  ├─ useFinance.ts
│  │     │  └─ useNotifications.ts
│  │     └─ context/
│  │        ├─ SettingsProvider.tsx
│  │        ├─ ToastProvider.tsx
│  │        └─ NotificationProvider.tsx
│  └─ shared/
│     ├─ types/
│     │  ├─ drug.ts
│     │  ├─ prescription.ts
│     │  ├─ finance.ts
│     │  ├─ notification.ts
│     │  ├─ settings.ts
│     │  ├─ ipc.ts
│     │  └─ result.ts
│     ├─ validation/
│     │  ├─ drugSchema.ts
│     │  ├─ prescriptionSchema.ts
│     │  └─ purchaseSchema.ts
│     ├─ money.ts
│     ├─ date.ts
│     ├─ printTemplate.ts
│     ├─ constants.ts
│     └─ testIds.ts
├─ tests/
│  ├─ unit/
│  │  ├─ money.test.ts
│  │  ├─ date.test.ts
│  │  └─ validation.test.ts
│  ├─ integration/
│  │  ├─ repositories/
│  │  └─ services/
│  └─ e2e/
│     ├─ helpers/
│     │  ├─ launch.ts
│     │  └─ seed.ts
│     ├─ pharmacy.spec.ts
│     ├─ prescription.spec.ts
│     ├─ finance.spec.ts
│     ├─ notification.spec.ts
│     ├─ print.spec.ts
│     └─ theme.spec.ts
└─ release/
```

---

## 4. 数据模型

### 4.1 Schema（v1）

金额全部用**整数分**存储，杜绝浮点误差；日期用 `YYYY-MM-DD` 字符串；时间戳用 ISO 字符串。

```sql
CREATE TABLE IF NOT EXISTS drugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  inbound_date TEXT NOT NULL,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  warning_qty INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  indications TEXT NOT NULL DEFAULT '',
  cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stopped')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
  purchase_date TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_cost_cents INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('男', '女')),
  age TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  rp TEXT NOT NULL,
  doctor TEXT NOT NULL,
  drug_amount_cents INTEGER NOT NULL,
  injection_fee_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
  drug_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  usage TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  unit_price_cents INTEGER NOT NULL,
  unit_cost_cents INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  drug_name TEXT NOT NULL,
  stock_qty INTEGER NOT NULL,
  warning_qty INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT 'stock_low',
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drugs_status_name ON drugs(status, name);
CREATE INDEX IF NOT EXISTS idx_drugs_low ON drugs(status, stock_qty, warning_qty);
CREATE INDEX IF NOT EXISTS idx_prescriptions_issue_date ON prescriptions(issue_date);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_name);
CREATE INDEX IF NOT EXISTS idx_items_prescription ON prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_items_drug ON prescription_items(drug_id);
CREATE INDEX IF NOT EXISTS idx_purchases_drug_date ON purchases(drug_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_notifications_drug_read ON notifications(drug_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
```

### 4.2 约定

- 打开时执行 `PRAGMA foreign_keys = ON`；sql.js 是内存库，不使用 WAL。
- 每次事务提交后 `db.export()` 得到完整 SQLite 字节，用 `write-file-atomic` 写 `clinic.db`；单进程、单实例、写操作串行。
- 金额 cents：`18.00 元 = 1800`；显示时 `Intl.NumberFormat('zh-CN')`。
- 数量整数；库存允许负数（PRD 已确认）。
- `age` 存文本，允许“62”“8个月”。
- `prescription_items` 存药品名称、单位、单价、成本快照；旧处方不受改价影响。
- 删除处方：级联删除明细；删除前先按明细退回库存。
- 删除已用药品：服务层拒绝，改为停用；未用药品可物理删除。
- `settings` 存 JSON 字符串：主题、上次医师、视图偏好、上次导出目录。

### 4.3 迁移

- `PRAGMA user_version` 作为 schema 版本，v1 = 1。
- `migrate.ts`：读版本 → 事务执行对应迁移 → 更新版本。
- 迁移前先做一次数据库备份；迁移失败回滚并保留原库。
- 第一版只建 v1；后续新增字段走 v2，不删旧列。

### 4.4 sql.js 持久化

- `src/main/db/store.ts` 统一封装：
  - `open(dbPath)`：读文件字节（不存在则空库）→ `initSqlJs({ locateFile })` → `new SQL.Database(bytes)` → `PRAGMA foreign_keys = ON` → 迁移。
  - `transaction(fn)`：`BEGIN IMMEDIATE` → 执行 → `COMMIT` → `persist()`；异常 `ROLLBACK`。
  - `persist()`：`db.export()` → `writeFileAtomic.sync(dbPath, Buffer.from(bytes))`；记录 `lastPersistedAt`。
  - `exportBytes()`：备份用，返回当前完整 SQLite 字节。
  - `reloadFromDisk()`：写盘失败时丢弃内存改动，重新加载磁盘版本，保证内存与文件一致。
- 所有 prepared statement 在事务内用完即 `free()`，避免 `db.export()` 时仍持有语句。
- wasm 路径：开发时 `node_modules/sql.js/dist/sql-wasm.wasm`；打包后 `process.resourcesPath/sql-wasm.wasm`；Vitest/tsx 测试进程指向 `node_modules/sql.js/dist/sql-wasm.wasm`；由 electron-builder `extraResources` 复制。
- **写盘失败处理**：提交后 `persist()` 失败 → `reloadFromDisk()` → 返回 `DATA_DIR_UNWRITABLE`；界面保留表单内容，提示重试或换目录。
- **启动损坏处理**：DB 文件打不开 → 重命名为 `clinic.corrupt-<时间>.db` → 尝试最近备份 → 成功则提示“已从备份恢复”，失败则给明确错误。
- 数据量目标：1000 张处方时单次保存 ≤1 秒；若明显超限，再评估 better-sqlite3（Repository 接口不变）。

### 4.5 测试种子

- `scripts/seed-test-data.ts --data-dir <dir>`：写入 PRD 7.3 的 D1–D6、P1–P3。
- `scripts/seed-perf-data.ts --data-dir <dir> --prescriptions 1000 --drugs 500`：造性能数据。
- E2E 每个 spec 用独立临时目录，启动前 seed，结束后删除。
- 生产首启为空，不预置测试数据。

---

## 5. 关键业务实现

### 5.1 处方保存 / 编辑 / 删除

**创建**（主进程事务）：

```text
BEGIN IMMEDIATE
1. Zod 校验输入。
2. 逐条加载药品：必须存在且 active；取当前 price_cents / cost_cents 作为快照。
3. 计算每条 amount_cents = qty * unit_price_cents；
   计算 drug_amount_cents = Σ amount；
   若传了 manualDrugAmountCents，则用它，并记录 manual=true。
4. injection_fee_cents 校验 >= 0；total = drug_amount + injection。
5. 库存检查：qty > stock_qty 的药品收集为 warnings。
   若 warnings 非空且 allowNegativeStock != true → 返回 STOCK_INSUFFICIENT。
6. INSERT prescriptions；last_insert_rowid 得 id。
7. 逐条 INSERT prescription_items（含快照）。
8. UPDATE drugs SET stock_qty = stock_qty - qty。
9. 对受影响药品执行 notificationService.sync(drugId)。
10. INSERT 操作日志（可选）。
COMMIT
返回 { id, warnings }
```

**编辑**：

- 加载旧明细；渲染进程为每行带 `itemId`，新行为空。
- 旧行：保留原 `unit_price_cents` / `unit_cost_cents`；数量变化只改 qty 和 amount。
- 删除的旧行：库存加回 qty，删除明细。
- 新增行：按当前药价/成本快照，扣库存。
- 修改行：库存按 `qty_old - qty_new` 调整（正数退回，负数扣减）。
- 更新处方汇总；重算 manual 金额（若手动值沿用）。
- 全程一个事务；任何一步失败回滚。

**删除**：

- 加载明细 → 每味药库存加回 qty → 删除处方（明细级联）→ 对受影响药品 sync 通知 → 财务自动重算。
- 二次确认由渲染进程负责；主进程只接受已确认的删除请求。

**金额规则**：

- 药品金额默认自动汇总；手动调整只改 `drug_amount_cents` 和 `total_cents`，不改明细成本。
- 成本永远按 `Σ(qty * unit_cost_cents)` 计算。
- 财务盈利 = 药品金额 + 注射费 − 成本。

### 5.2 进货

```text
BEGIN IMMEDIATE
1. 校验日期、数量 > 0、单位成本 >= 0。
2. INSERT purchases（total = qty * unit_cost）。
3. UPDATE drugs SET stock_qty = stock_qty + qty,
                   cost_cents = unit_cost_cents,
                   updated_at = now。
4. notificationService.sync(drugId)：库存恢复则自动已读。
COMMIT
```

- 进货记录只追加；第一版不提供编辑/删除。
- 历史处方成本不受影响（明细有快照）。

### 5.3 通知

`sync(drugId)`：

```text
加载药品；停用则直接返回。
若 stock_qty > warning_qty：
  UPDATE notifications SET read_at = now
   WHERE drug_id = ? AND read_at IS NULL;
  返回。
若 stock_qty <= warning_qty：
  若存在未读通知 → 返回（不重复）。
  若该药今天已有通知（created_at 的本地日期 = 今天）→ 返回。
  INSERT notifications（药名/库存/预警快照）。
```

- 启动时对全部 active 且低库存的药执行一次 `sync`，实现“次日提醒”。
- 补货后库存高于预警值：未读自动已读，红点消失；历史保留。
- 停用药不生成新通知；旧通知保留，点击仍可进详情。
- 通知抽屉点击一条：`markRead` → 跳 `/pharmacy/:drugId`。

### 5.4 财务查询

- 期间：日 / 周（周一到周日）/ 月 / 年；按 `issue_date` 归期。
- 汇总 SQL 思路：

```sql
SELECT
  COUNT(*) AS count,
  COALESCE(SUM(p.drug_amount_cents + p.injection_fee_cents), 0) AS revenue_cents,
  COALESCE(SUM((
    SELECT SUM(i.unit_cost_cents * i.qty)
    FROM prescription_items i
    WHERE i.prescription_id = p.id
  )), 0) AS cost_cents
FROM prescriptions p
WHERE p.issue_date BETWEEN ? AND ?;
```

- 盈利 = revenue − cost。
- 明细行：
  - 日：每张处方一行。
  - 周/月：按天分组；年：按月分组。
- 返回 `revenue_cents / cost_cents / profit_cents / count`，渲染进程格式化。

### 5.5 备份与日志

- 启动：确保目录 → 打开 DB → 迁移 → 当日备份。
- 备份用 `store.exportBytes()` + `write-file-atomic` 写备份文件；文件名 `clinic-YYYY-MM-DD.db`；保留 7 份。
- `app:getInfo` 返回 `lastBackupAt`、`dataDir`、版本。
- 日志：`electron-log` 写 `data/logs/main.log`；渲染进程未捕获错误通过 IPC 记录。
- 备份失败：状态栏红色提示；不阻塞主流程，但写入日志。

### 5.6 打印 / PDF

- `src/shared/printTemplate.ts` 导出 `buildPrescriptionHtml(data, mode)`：
  - 输入一张或多张处方 + 明细。
  - 输出完整 HTML：A5 CSS、中文字体（宋体正文/黑体标题）、页眉、患者信息、Rp、用药表、费用、签名线、打印时间、页码。
  - 批量：每张处方一个 `.page`，`break-after: page`。
- 主进程 `printService`：
  - 隐藏 `BrowserWindow`（`show:false`），加载 HTML（临时文件放 `data/runtime/`，用完删除）。
  - 等 `document.fonts.ready`。
  - 打印：`webContents.print({ silent:false, printBackground:true, pageSize:'A5' })`。
  - PDF：`webContents.printToPDF({ pageSize:'A5', printBackground:true, preferCSSPageSize:true })`；若当前 Electron 不接受 `'A5'` 字符串，改用 `{ width: 148000, height: 210000 }`（微米）。
  - 保存：`dialog.showSaveDialog`；默认文件名按 PRD 7.4.6。
- 渲染进程预览：同一份 HTML 放进 `iframe srcDoc`，按 A5 宽度显示；打印/导出按钮调 IPC。
- 打印/导出期间显示进度；失败返回 `PRINT_FAILED` / `EXPORT_FAILED`。

---

## 6. IPC 契约

所有通道通过 `ipcRenderer.invoke`；返回统一包装：

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; details?: unknown } };
```

| 通道 | 请求 | 返回 |
| --- | --- | --- |
| `app:getInfo` | — | `{ version, dataDir, lastBackupAt }` |
| `settings:get` | — | `Settings` |
| `settings:set` | `Partial<Settings>` | `Settings` |
| `drugs:list` | `{ query?, status?, page, pageSize }` | `{ items, total }` |
| `drugs:get` | `{ id }` | `DrugDetail` |
| `drugs:create` | `DrugInput` | `{ id }` |
| `drugs:update` | `{ id, ...DrugInput }` | `{ id }` |
| `drugs:setStatus` | `{ id, status }` | `{ id, status }` |
| `drugs:delete` | `{ id }` | `{ id }` |
| `drugs:purchase` | `{ drugId, date, qty, unitCostCents }` | `{ purchaseId, stockQty, costCents }` |
| `drugs:lowStockCount` | — | `{ count }` |
| `prescriptions:list` | `{ query?, dateFrom?, dateTo?, page, pageSize }` | `{ items, total }` |
| `prescriptions:get` | `{ id }` | `PrescriptionDetail` |
| `prescriptions:create` | `PrescriptionInput` | `{ id, warnings }` |
| `prescriptions:update` | `{ id, ...PrescriptionInput }` | `{ warnings }` |
| `prescriptions:delete` | `{ id, allowNegativeStock? }` | `{ id }` |
| `finance:summary` | `{ period, anchorDate }` | `{ summary, chart, rows }` |
| `finance:details` | `{ period, anchorDate, rowKey }` | `{ items }` |
| `notifications:list` | — | `{ items, unreadCount }` |
| `notifications:unreadCount` | — | `{ count }` |
| `notifications:markRead` | `{ id }` | `{ unreadCount }` |
| `notifications:markAllRead` | — | `{ unreadCount }` |
| `print:printPrescription` | `{ ids }` | `{ ok }` |
| `print:exportPdf` | `{ ids }` | `{ path }` |

错误码：`VALIDATION_ERROR`、`NOT_FOUND`、`DRUG_IN_USE`、`STOCK_INSUFFICIENT`、`DATA_DIR_UNWRITABLE`、`DB_ERROR`、`PRINT_FAILED`、`EXPORT_FAILED`。

Preload：

```ts
window.api = {
  app: { getInfo },
  settings: { get, set },
  drugs: { list, get, create, update, setStatus, delete, purchase, lowStockCount },
  prescriptions: { list, get, create, update, delete },
  finance: { summary, details },
  notifications: { list, unreadCount, markRead, markAllRead },
  print: { printPrescription, exportPdf },
};
```

---

## 7. 前端实现

### 7.1 路由

| 路由 | 页面 |
| --- | --- |
| `/` | 重定向 `/prescriptions` |
| `/prescriptions` | 处方首页（卡片/列表） |
| `/prescriptions/new` | 新建处方 |
| `/prescriptions/:id/edit` | 编辑处方 |
| `/prescriptions/print?ids=1,2` | 打印预览（单张/批量） |
| `/pharmacy` | 药房首页 |
| `/pharmacy/new` | 新建药品 |
| `/pharmacy/:id` | 药品详情 |
| `/pharmacy/:id/edit` | 编辑药品 |
| `/finance` | 财务首页 |

- 通知抽屉全局，不占路由。
- 返回按钮用 `navigate(-1)` 或明确路径；未保存修改先确认。

### 7.2 主题与全局状态

- `SettingsProvider`：主题、上次医师、卡片/列表偏好、上次导出目录；启动加载，修改即 IPC 保存。
- `data-theme="light|dark|reading"` 挂在 `<html>`；CSS 变量见 PRD 附录 A 第 3 节。
- 阅读模式：`body` 加 `reading` 类；正文 15px、行高 1.7、表格行 48px。
- `ToastProvider`：右下角，3.5 秒，支持“撤销”。
- `NotificationProvider`：未读数、抽屉开关、刷新。
- 页面数据用 `useIpcQuery`：`data / loading / error / refresh`；写操作后手动 refresh。

### 7.3 组件与页面

- 通用组件按目录结构实现；所有交互元素带 `data-testid`。
- 药房：卡片/列表、搜索、状态筛选、低库存提示、详情、进货弹窗、停用/恢复、删除。
- 处方：卡片/列表、搜索/时间筛选、编辑表单、药品选择弹窗（多选）、费用面板、库存提示、保存/编辑/删除、批量选择。
- 财务：四个账本、日期导航、四个汇总卡、分组柱图、期间明细抽屉。
- 通知：380px 抽屉、未读红点、点击跳转、全部已读。
- 打印预览：iframe + 工具栏（打印/导出/返回），纸张 A5 缩放。
- 表单：Zod 校验 + 就地错误；金额输入以元显示、内部转分；日期 `YYYY-MM-DD`。
- 格式化：`MoneyText` 统一 `¥1,234.00`；`AgeText` 原样显示。
- 空状态/错误/骨架屏按 PRD 4.10。

### 7.4 可访问性

- 焦点环 2px；所有图标按钮有 `aria-label` / tooltip。
- 弹窗焦点锁定；Esc 关闭；关闭后焦点回到触发元素。
- 颜色不是唯一信号：预警带文字/图标，盈亏带正负号。
- 125% / 150% 缩放；1024×700 不横向滚动。
- 支持 `prefers-reduced-motion`。

---

## 8. 里程碑总表

| 里程碑 | 交付 | 依赖 | 估算 | 验证门 |
| --- | --- | --- | --- | --- |
| M0 | 基线、Git、忽略文件、Q1–Q5 默认确认 | — | 0.5 天 | 首次提交成功 |
| M1 | 工程脚手架、依赖、三端可启动、sql.js/打印 spike | M0 | 1.5 天 | `npm run verify`；sql.js/PDF spike 通过 |
| M2 | 数据层、迁移、Repository、种子、单元/集成测试 | M1 | 2 天 | 数据测试通过 |
| M3 | Service、IPC、Preload、业务集成测试 | M2 | 2 天 | 服务测试通过 |
| M4 | 设计系统、三主题、App Shell、通用组件 | M3 | 2 天 | 壳可运行、主题切换 |
| M5 | 药房全部页面与流程 | M4 | 2 天 | 药房 E2E 通过 |
| M6 | 处方全部页面与流程 | M5 | 3 天 | 处方 E2E 通过 |
| M7 | 财务页面与图表 | M6 | 2 天 | 财务 E2E 通过 |
| M8 | 通知抽屉与触发联动 | M7 | 1 天 | 通知 E2E 通过 |
| M9 | 打印预览、打印、单张/批量 PDF | M6 | 2 天 | PDF 尺寸/页数/文字测试通过 |
| M10 | 备份、单实例、打包、验收、文档 | M7/M8/M9 | 3 天 | 打包运行 + 验收报告 |

- 合计约 **21 个开发日**；加 20% 缓冲约 **25 个开发日**。
- M5/M6/M7/M8 严格串行；M9 可在 M6 后并行准备，但仍按顺序提交。
- 每个里程碑结束运行 `npm run verify`；E2E 从 M5 开始逐步加入。

---

## 9. 分阶段执行

### M0 基线准备（0.5 天）

**目标**：把需求、计划、Git 和忽略规则定下来。

**步骤**：

1. 确认 PRD 第八章 Q1–Q5 默认值；如无修改，写入 `DEVELOPMENT_PLAN.md` 的“默认确认”备注。
2. 创建 `.gitignore`：

```gitignore
node_modules/
out/
dist/
release/
coverage/
test-results/
playwright-report/
.dev-data/
data/
*.log
.env
.DS_Store
```

3. 创建 `.editorconfig`：UTF-8、LF、2 空格、末尾换行。
4. 运行：

```powershell
git status
git add PRD.md DEVELOPMENT_PLAN.md .gitignore .editorconfig
git commit -m "docs: establish PRD and development plan baseline"
```

**验收**：

- `git log --oneline` 至少一条提交。
- 工作区干净；`PRD.md`、`DEVELOPMENT_PLAN.md` 已跟踪。

**提交**：`docs: establish PRD and development plan baseline`

---

### M1 工程脚手架 + 技术验证（1.5 天）

**目标**：Electron + React + TypeScript 能启动；sql.js 单文件持久化和 A5 中文 PDF 验证通过。

**步骤**：

1. 创建 `package.json`（名称 `yanxia-clinic-management-system`，版本 `1.0.0`，`private: true`，`main: "./out/main/index.js"`，`description: "燕霞诊所管理系统"`，`author: "DB"`，`license: "UNLICENSED"`）。
2. 安装运行时依赖：

```powershell
npm install --save-exact react@19.3.1 react-dom@19.3.1 react-router-dom@7.18.4 sql.js@1.15.1 write-file-atomic@7.0.1 zod@4.6.7 lucide-react@1.61.0 electron-log@5.4.4
```

3. 安装开发依赖：

```powershell
npm install --save-dev --save-exact electron@45.0.0 electron-vite@6.0.0 vite@8.3.5 @vitejs/plugin-react@6.1.2 typescript@7.0.2 @types/node@24 @types/react@latest @types/react-dom@latest @types/sql.js@1.4.11 @types/write-file-atomic@4.0.3 vitest@5.0.5 @playwright/test@1.64.1 @axe-core/playwright@4.14.0 electron-builder@26.15.3 pdf-lib@1.17.1 pdfjs-dist@6.4.299 eslint@10.13.0 @eslint/js@latest typescript-eslint@latest eslint-plugin-react-hooks@latest globals@latest prettier@3.9.10 tsx@4.23.15
```

4. 创建 `scripts/check-sqljs.cjs`：初始化 sql.js → 建表/插入 → `db.export()` → 用 `write-file-atomic` 写临时文件 → 重新打开 → 查询 → 打印 `sql.js ok`。然后分别用 Node 和 Electron 跑：

```powershell
node scripts/check-sqljs.cjs
npx electron scripts/check-sqljs.cjs
```

5. 创建 `electron.vite.config.ts`、`tsconfig*.json`、`eslint.config.js`、`.prettierrc`、`vitest.config.ts`、`playwright.config.ts`、`electron-builder.yml`。
6. 创建最小三端：

- `src/main/index.ts`：创建 1280×820 窗口，`minWidth:1024`、`minHeight:700`。
- `src/preload/index.ts`：`contextBridge.exposeInMainWorld('api', { ping })`。
- `src/renderer/index.html` + `src/main.tsx` + `App.tsx`：显示“燕霞诊所管理系统”。
- `src/shared/ipc.ts`：通道常量。

7. 数据目录逻辑（先做最小版）：`src/main/env.ts` 计算 `dataDir`；`YANXIA_DATA_DIR` 优先；开发用 `.dev-data`；设置 `app.setPath('userData', <dataDir>/runtime)`。
8. 单实例锁 + 写权限探测（sql.js 检查已在第 4 步完成）。
9. 打印 spike `scripts/spike-print.cjs`：加载一段中文 A5 HTML，调 `printToPDF`，输出 `spike-a5.pdf`，用 `pdf-lib` 读页面尺寸。
10. `package.json` scripts：

```json
{
  "dev": "electron-vite dev",
  "build": "electron-vite build",
  "preview": "electron-vite preview",
  "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
  "lint": "eslint .",
  "format": "prettier --write .",
  "test": "vitest run --passWithNoTests",
  "test:watch": "vitest",
  "test:e2e": "npm run build && playwright test",
  "seed:test": "tsx scripts/seed-test-data.ts",
  "package:win": "npm run build && electron-builder --win zip",
  "verify": "npm run typecheck && npm run lint && npm run test && npm run build"
}
```

**验证**：

```powershell
npm run dev
npm run verify
npx electron scripts/check-sqljs.cjs
npx electron scripts/spike-print.cjs
```

- 窗口打开、显示标题。
- `sql.js ok`。
- `spike-a5.pdf` 存在，页面 148×210mm，中文可见。
- `docs/TECH_SPIKE.md` 记录结果。

**失败回退**：

- sql.js wasm 加载/原子写失败：先用 `sql-asm.js`（无 wasm）；仍不行再评估 better-sqlite3 + electron-rebuild，Repository 接口不变；记录到 `TECH_SPIKE.md`。
- printToPDF 中文/A5 失败：改用 `pdf-lib` + 内置 Noto Sans SC；版式逻辑不变。

**提交**：`chore: scaffold electron app and verify sql.js + a5 pdf`

---

### M2 数据层（2 天）

**目标**：schema、迁移、Repository、种子、测试全部跑通。

**文件**：

- `src/main/db/paths.ts`、`store.ts`、`connection.ts`、`schema.ts`、`migrate.ts`。
- `src/main/repositories/*Repository.ts`。
- `src/shared/types/*`、`money.ts`、`date.ts`、`validation/*`。
- `src/main/seed/testData.ts`、`scripts/seed-test-data.ts`、`scripts/seed-perf-data.ts`。
- `tests/unit/money.test.ts`、`date.test.ts`、`validation.test.ts`。
- `tests/integration/repositories/*.test.ts`。

**实施要点**：

- `money.ts`：`yuanToCents`、`centsToYuan`、`formatCents`、`mulCents(qty, unitCents)`；全部整数运算。
- `date.ts`：今天、未来判断、周一起点、周/月/年范围、本地日期比较。
- `connection.ts`：初始化 sql.js、读取/校验数据库文件、设置外键、迁移、暴露 store（transaction/persist/exportBytes）。
- `drugRepository`：list/get/create/update/setStatus/delete/purchase/lowStockCount。
- `prescriptionRepository`：list/get/create/update/delete；事务；快照；库存差额。
- `financeRepository`：summary/rows/details。
- `notificationRepository`：list/unreadCount/markRead/markAllRead/sync。
- `settingsRepository`：get/set。
- 测试用 `createTestDb()` 指向临时目录；每个测试独立库。

**验证**：

```powershell
npm test -- tests/unit tests/integration/repositories
```

覆盖：金额换算、日期边界、Zod、药品 CRUD、进货、处方创建/编辑/删除、库存差额、价格快照、财务汇总、通知去重。

**提交**：`feat: add sqlite schema repositories and data tests`

---

### M3 业务服务 + IPC（2 天）

**目标**：主进程服务层和渲染进程可调用的 IPC 全部就绪。

**文件**：

- `src/main/services/drugService.ts`、`prescriptionService.ts`、`financeService.ts`、`notificationService.ts`、`settingsService.ts`、`backupService.ts`。
- `src/main/ipc/*Handlers.ts`、`index.ts`。
- `src/preload/index.ts`、`src/shared/types/ipc.ts`。
- `tests/integration/services/*.test.ts`。

**实施要点**：

- 所有写操作在 Service 内开事务；Repository 只做 SQL。
- 处方服务实现 PRD 5.1 的创建/编辑/删除；库存不足返回 `warnings` + `STOCK_INSUFFICIENT`，除非 `allowNegativeStock`。
- 进货服务更新库存和成本，触发通知同步。
- 通知服务实现“未读去重 + 今天不重复 + 补货已读 + 启动补提醒”。
- 财务服务按日/周/月/年返回汇总、图表行、明细。
- IPC 做 Zod 校验；错误统一 `Result`。
- Preload 只暴露白名单，不暴露 `ipcRenderer`。
- 备份服务：启动确保目录、迁移前备份、每日备份、保留 7 份。

**验证**：

```powershell
npm test -- tests/integration/services
```

覆盖 PRD 7.4 的 P0 数据链路：RS-01/10/11/12/13/14、PHA-06/12、FIN-01/02/10/13、NOT-01/02/06/07。

**提交**：`feat: implement clinic services and typed ipc bridge`

---

### M4 设计系统 + App Shell（2 天）

**目标**：三套主题、顶栏/状态栏、路由、基础组件、Toast/Dialog/Drawer 可用。

**文件**：

- `src/renderer/src/styles/tokens.css`、`themes.css`、`global.css`。
- `src/renderer/src/app/*`、`components/*`、`context/*`、`router.tsx`。
- 页面先用占位组件。

**实施要点**：

- 按 PRD 附录 A 第 3 节实现三套 CSS 变量；`data-theme` 切换。
- 顶栏 56px：诊所名、三模块、外观、通知。
- 状态栏 24px：保存状态、备份时间。
- 按钮/输入/表格/卡片/标签/弹窗/抽屉/Toast/空状态/分页。
- `HashRouter`；路由占位。
- `SettingsProvider` 读取主题/偏好；`ToastProvider`；`NotificationProvider`（先空实现）。
- 阅读模式：15px/1.7/表格 48px。
- 1024×700、125%/150% 下不横向滚动。

**验证**：

```powershell
npm run dev
```

- 三套主题切换、刷新后保留。
- 顶栏/状态栏/弹窗/Toast 正常。
- 用 Playwright 截图 `tests/e2e/theme.spec.ts`（可先手动）。

**提交**：`feat: add design tokens themes and application shell`

---

### M5 药房页面（2 天）

**目标**：药房首页、编辑、详情、进货、删除/停用/恢复全部可用。

**文件**：

- `pages/pharmacy/PharmacyListPage.tsx`、`DrugEditPage.tsx`、`DrugDetailPage.tsx`、`PurchaseDialog.tsx`。
- `hooks/useDrugs.ts`。
- `tests/e2e/pharmacy.spec.ts`。

**实施要点**：

- 列表/卡片、搜索名称/分类/供应商、状态筛选、低库存横幅、分页。
- 新建/编辑表单：全部字段、单位候选、预警库存、毛利提示、校验。
- 详情：库存卡、基本信息、适应症、开药次数、进货记录、低库存提示、停用/恢复。
- 进货弹窗：日期/数量/单位成本/本次金额/库存预览；成功后刷新。
- 删除规则：未用可删；已用只能停用；停用可撤销/恢复。
- 空状态、错误、加载骨架。

**验证**：

```powershell
npx playwright test tests/e2e/pharmacy.spec.ts
```

覆盖 AC-PHA-01 至 14。

**提交**：`feat: implement pharmacy pages and purchase flow`

---

### M6 处方页面（3 天）

**目标**：处方列表、编辑、药品选择、库存/金额联动、删除全部可用。

**文件**：

- `pages/prescriptions/PrescriptionListPage.tsx`、`PrescriptionEditPage.tsx`、`DrugPickerDialog.tsx`。
- `hooks/usePrescriptions.ts`。
- `tests/e2e/prescription.spec.ts`。

**实施要点**：

- 列表/卡片字段严格按 PRD；搜索姓名/诊断；时间筛选；分页；批量选择跨页。
- 编辑页：患者信息、Rp 500 字计数、用药表、费用面板、库存提示、底部操作栏。
- 药品选择：搜索、多选、已添加禁用、库存/标价显示、库存不足警告。
- 金额：数量 × 标价；手动调整药品金额；成本不变；恢复自动。
- 保存：校验 → 库存不足弹窗 → 允许负数 → 事务保存 → Toast；保存并打印。
- 编辑：旧行保留快照；数量差额扣/退；增删药调整库存。
- 删除：确认 → 退库存 → 财务移除。
- 未保存离开确认；Ctrl+S / Ctrl+P。
- 空状态、错误。

**验证**：

```powershell
npx playwright test tests/e2e/prescription.spec.ts
```

覆盖 AC-RX-01 至 23 中可自动化的 P0（打印相关留给 M9）。

**提交**：`feat: implement prescription list editor and stock linkage`

---

### M7 财务页面（2 天）

**目标**：日/周/月/年账本、图表、明细抽屉。

**文件**：

- `pages/finance/FinancePage.tsx`、`components/GroupedBarChart.tsx`、`StatCard.tsx`。
- `hooks/useFinance.ts`。
- `tests/e2e/finance.spec.ts`。

**实施要点**：

- 四个账本切换；‹ › 翻页；“回到今天/本周/本月/今年”。
- 四个汇总卡；盈利正负颜色/符号。
- 分组柱状图：收入/成本/盈利；负值向下；tooltip；图例。
- 日账本列处方；周/月/年按天/月汇总；行点击抽屉。
- 空周期、金额格式。
- 删除处方/改价后刷新正确。

**验证**：

```powershell
npx playwright test tests/e2e/finance.spec.ts
```

覆盖 AC-FIN-01 至 14。

**提交**：`feat: implement finance ledgers and charts`

---

### M8 通知（1 天）

**目标**：铃铛、抽屉、未读数、点击跳转、补货自动已读。

**文件**：

- `app/NotificationButton.tsx`、`pages/notifications/NotificationDrawer.tsx`。
- `context/NotificationProvider.tsx`。
- `tests/e2e/notification.spec.ts`。

**实施要点**：

- 顶栏铃铛 + 红点/数量；380px 抽屉；未读/已读样式。
- 点击一条：markRead → 关闭 → `/pharmacy/:id`。
- 全部已读。
- 库存变化后刷新未读数；服务层已在 M3 完成触发。
- 空状态；Esc/遮罩关闭。

**验证**：

```powershell
npx playwright test tests/e2e/notification.spec.ts
```

覆盖 AC-NOT-01 至 11（次日提醒可用改系统日期手工验证）。

**提交**：`feat: add notification drawer and unread badge`

---

### M9 打印 / PDF（2 天）

**目标**：A5 预览、系统打印、单张/批量 PDF 全部可用。

**文件**：

- `src/shared/printTemplate.ts`。
- `src/main/services/printService.ts`、`pdfService.ts`、`printHandlers.ts`。
- `pages/prescriptions/PrescriptionPrintPage.tsx`。
- `tests/e2e/print.spec.ts`。

**实施要点**：

- HTML 模板：A5、页边距、抬头、患者、诊断、Rp、药表、费用、签名、打印时间、页码。
- 长内容续页；批量每张从新页开始。
- 预览 iframe；打印/导出按钮调 IPC。
- 单张文件名 `处方_姓名_日期.pdf`；批量 `处方导出_日期_共N张.pdf`。
- 打印始终白底黑字，不随主题。
- 失败提示、可重试。

**验证**：

```powershell
npx playwright test tests/e2e/print.spec.ts
```

自动化检查：PDF 存在、页面 148×210mm、批量页数、关键文字（姓名/金额/Rp）。打印对话框手工确认。

**提交**：`feat: implement a5 print preview and pdf export`

---

### M10 打包、备份、验收（3 天）

**目标**：绿色 zip 可运行；备份/恢复/持久化通过；完成 PRD 验收。

**步骤**：

1. 完成启动检查：数据目录写权限、单实例、日志、迁移备份。
2. 完成每日备份 + 保留 7 份；状态栏显示上次备份。
3. `electron-builder.yml`：

```yaml
appId: com.yanxia.clinic
productName: 燕霞诊所管理系统
directories:
  output: release
files:
  - out/**/*
  - package.json
asar: true
extraResources:
  - from: node_modules/sql.js/dist/sql-wasm.wasm
    to: sql-wasm.wasm
win:
  target:
    - target: zip
      arch: [x64]
  artifactName: YanxiaClinicManagementSystem-${version}-win-x64.${ext}
```

> 打包后必须检查 `resources/sql-wasm.wasm` 和 `app.asar` 内的 `node_modules/sql.js`、`node_modules/write-file-atomic` 是否都在；若缺失，调整 `extraResources`/`files` 并重新打包，不能只测开发环境。

4. 打包：

```powershell
npm run package:win
```

5. 解压到新目录运行，确认：

- 不安装、不要管理员、无联网。
- `data/` 在 exe 同级，关闭/重启数据仍在。
- 打印/PDF/备份正常。
- 1024×700、125%/150% 正常。

6. 执行 PRD 第七章：P0 全跑，P1 至少 90%；记录到 `docs/ACCEPTANCE_REPORT.md`。
7. 性能测试：`seed-perf-data` 造 1000 处方/500 药品；测启动/搜索/保存/批量导出。
8. 写 `docs/USER_GUIDE.md`、`docs/KNOWN_ISSUES.md`。
9. 打 tag：

```powershell
git tag v1.0.0
```

**验收**：

- 打包程序在干净目录可运行。
- PRD 7.7 通过条件满足。
- 验收报告、已知问题、使用说明齐全。

**提交**：`chore: package portable windows build and acceptance docs`

---

## 10. 测试计划

### 10.1 测试层次

| 层次 | 工具 | 范围 | 命令 |
| --- | --- | --- | --- |
| 单元 | Vitest | 金额、日期、Zod、纯函数 | `npm test -- tests/unit` |
| 集成 | Vitest | Repository + Service + 临时 SQLite | `npm test -- tests/integration` |
| E2E | Playwright + Electron | 真实 UI、IPC、数据库 | `npm run build && npm run test:e2e` |
| 手工 | 清单 | 打印版式、视觉、缩放、可访问性、Windows 版本 | 按 PRD 7.4/7.5 |

E2E 启动约定（示例，放在 `tests/e2e/helpers/launch.ts`）：

```ts
import { _electron as electron } from 'playwright';
import os from 'node:os';
import path from 'node:path';

const dataDir = path.join(os.tmpdir(), `yanxia-e2e-${Date.now()}`);
const app = await electron.launch({
  args: ['.'],
  env: { ...process.env, YANXIA_DATA_DIR: dataDir, NODE_ENV: 'test' },
});
const page = await app.firstWindow();
```

- 每个 spec 用独立 `YANXIA_DATA_DIR`，启动前 seed，结束后删除。
- 构建后启动（`npm run build`），不要用 dev server 跑 E2E。
- 单跑某个 spec 前先 `npm run build`；或直接用 `npm run test:e2e`。

### 10.2 自动化覆盖（至少）

| Spec | 覆盖 |
| --- | --- |
| `money/date/validation` | 金额分/元、周一起点、日期边界、字段校验 |
| `repositories` | 药品/进货/处方/财务/通知 SQL 与事务 |
| `services` | 创建/编辑/删除处方、库存差额、快照、进货、通知、财务 |
| `pharmacy.spec` | PHA-01 至 14 |
| `prescription.spec` | RX-01 至 23 中除打印外的 P0/P1 |
| `finance.spec` | FIN-01 至 14 |
| `notification.spec` | NOT-01 至 11（次日提醒可手工） |
| `print.spec` | PRT-01/02/03/05/06/08/09 |
| `theme.spec` | UI-01/02/03/06/09/15 |

### 10.3 手工验收

- 打印对话框、实体打印机、A5 纸张。
- 三套主题逐页走查；阅读模式字号/行高/底色。
- 125%/150% 缩放；Windows 10/11 各一次。
- 对比度取色器；Narrator 读表单。
- 断电/强杀、只读目录、备份恢复。
- PRD 7.4/7.5 全量清单。

### 10.4 验收记录

- 每个用例记录：编号、版本、日期、执行人、环境、结果、证据、缺陷编号。
- 汇总 P0/P1 通过率；未通过项写入 `KNOWN_ISSUES.md`。
- 只有 PRD 7.7 通过条件满足才可交付。

---

## 11. 打包与发布

- 目标：`release/YanxiaClinicManagementSystem-1.0.0-win-x64.zip`。
- 解压后目录包含 exe、`resources/`、`data/`（首次运行创建）。
- 不写注册表业务数据、不写 Program Files、不要求管理员。
- 不签名：Windows SmartScreen 可能提示“未知发布者”；自用可接受，写入使用说明。
- 不自动更新、不联网。
- 打包后必须重跑 E1–E11 冒烟 + 打印/PDF/备份。

---

## 12. 风险与回退

| 风险 | 概率 | 影响 | 触发信号 | 回退/处理 |
| --- | --- | --- | --- | --- |
| sql.js 整库导出写盘慢 | 中 | 保存变慢 | 1000 条后保存 >1 秒 | 先优化批量/压缩；仍超限换 better-sqlite3（Repository 不变） |
| printToPDF 中文/A5 异常 | 中 | 打印不可用 | spike PDF 缺字/尺寸错 | 改 `pdf-lib` + Noto Sans SC |
| Electron/electron-vite 版本不兼容 | 低中 | 无法启动 | dev/build 报错 | 回退到 electron-vite 模板锁定版本，记录到 TECH_SPIKE |
| 批量 PDF 分页错 | 中 | 打印错页 | PDF 页数不对 | 调整 `.page` CSS + `preferCSSPageSize`，逐张验证 |
| 数据目录不可写 | 低 | 无法保存 | 启动探测失败 | 弹窗说明；不启动；提示换目录 |
| 125%/150% 布局溢出 | 中 | 可用性差 | 截断/横向滚动 | 用相对尺寸/最小宽度；逐页测 |
| 1000 条性能不达标 | 低 | 体验差 | 搜索/滚动卡顿 | 加索引、分页、避免全量渲染 |
| sql-wasm.wasm 未打包 | 中 | 打包版启动失败 | `resources` 下找不到 wasm | `extraResources` + 打包后必测；回退 `sql-asm.js` |
| 原子写失败/断电 | 低 | 丢最后一次保存 | 临时文件残留/库损坏 | `write-file-atomic` + 每日备份 + 启动校验；提示从备份恢复 |
| 打印字体不一致 | 低 | 版式偏差 | 不同机器字体差异 | 打印模板优先系统宋体/黑体；必要时内置字体 |

---

## 13. 命令速查

```powershell
# 安装
npm install

# 开发
npm run dev

# 质量门
npm run verify

# 单元/集成
npm test

# E2E（先构建）
npm run build
npm run test:e2e

# 测试数据
npm run seed:test -- --data-dir .tmp/test-data
npx tsx scripts/seed-perf-data.ts --data-dir .tmp/perf-data --prescriptions 1000 --drugs 500

# sql.js / 打印 spike
node scripts/check-sqljs.cjs
npx electron scripts/check-sqljs.cjs
npx electron scripts/spike-print.cjs

# 打包
npm run package:win

# 查看产物
dir release
```

---

## 14. 完成定义（与 PRD 7.9 对齐）

- PRD 第三章“第一版要做”全部可用；“暂时不做”未被加入。
- PRD 7.7 通过条件全部满足：P0 100%、P1 ≥90%、无阻断/严重问题。
- 金额/库存/财务/通知四条链路一致。
- 三套主题、A5 打印、单张/批量 PDF、备份恢复、强杀恢复通过。
- 打包后的 zip 在干净目录可运行；数据在 `data/`。
- `docs/ACCEPTANCE_REPORT.md`、`docs/KNOWN_ISSUES.md`、`docs/USER_GUIDE.md` 完成。
- Git 打 tag `v1.0.0`。

---

## 15. 下一步

你确认本计划后，我按以下顺序开始：

1. **M0**：提交 PRD/计划基线，确认 Q1–Q5 默认。
2. **M1**：安装依赖、搭脚手架，先跑 sql.js 单文件持久化和 A5 PDF 两个 spike。
3. 把 spike 结果和截图/PDF 给你看；两项都通过才进入 M2。

如果 spike 失败，我会先执行回退方案（`sql-asm.js` / `pdf-lib`），把影响和新的估算告诉你，不会直接硬写业务代码。
