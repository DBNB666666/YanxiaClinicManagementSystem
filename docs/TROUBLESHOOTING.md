# 启动问题排查：双击 exe 没有窗口

## 症状

双击 `yanxia-clinic.exe`（旧版本为 `燕霞诊所管理系统.exe`）后：

- 任务管理器里没有进程，或进程一闪而过；
- 没有任何错误提示；
- 程序所在目录没有生成 `data/`。

## 本次原因：所在文件夹带“低完整性”标签

不是业务代码崩溃，而是 **Windows 完整性级别** 限制。

本机把软件解压到了：

```text
E:\Users\HP\Desktop\YanxiaClinicManagementSystem-0.5.1-win-x64
```

`E:\Users\HP\Desktop` 被某个沙箱/AI 工具设置了 **Low Mandatory Level（低完整性）**，目录下所有文件继承这个标签。Electron 从低完整性目录启动时，Chromium 沙箱/缓存初始化会失败，进程直接退出，所以看不到窗口。

可用下面的命令确认（普通 PowerShell）：

```powershell
icacls "E:\Users\HP\Desktop"
```

如果输出里有：

```text
Mandatory Label\Low Mandatory Level
```

就是这个原因。

## 解决方案（按推荐顺序）

### 方案 A：解压到普通目录（推荐）

把压缩包解压到 **普通（中完整性）目录**，例如：

```text
C:\Users\HP\Desktop\YanxiaClinicManagementSystem-0.5.1-win-x64
C:\Apps\YanxiaClinicManagementSystem-0.5.1-win-x64
```

再双击 `yanxia-clinic.exe`。开发者已在本机 `C:\Users\HP\Desktop` 验证可正常打开窗口并创建数据库。

### 方案 B：使用包内的启动脚本

直接双击：

```text
启动燕霞诊所管理系统.cmd
```

它会：

1. 把整个程序复制到 `%LOCALAPPDATA%\Programs\YanxiaClinicManagementSystem`（普通目录）；
2. 从该目录启动 `yanxia-clinic.exe`；
3. 数据也保存在该目录的 `data/` 下。

以后每次启动都双击这个 `.cmd` 即可。首次启动需要复制约 170MB，稍等几秒。

### 方案 C：管理员去掉低完整性标签

如果希望继续在原目录运行，可以用**管理员 PowerShell** 执行：

```powershell
icacls "E:\Users\HP\Desktop" /setintegritylevel Medium
```

这需要管理员权限，并且会改变该桌面目录的完整性级别；普通用户优先使用方案 A 或 B。

## 为什么旧版本会完全没有窗口？

Electron 在创建窗口前就要初始化 Chromium 沙箱、GPU 缓存和 crashpad。低完整性目录让这些步骤直接失败，主进程来不及执行任何业务代码，也不会弹错误框，所以表现为“双击无反应”。

## 验证

包级自动化测试：

```powershell
npm run package:win
npm run test:package
```

测试会：

- 把安装包解压到一个带低完整性标签的目录；
- 运行 `启动燕霞诊所管理系统.cmd`；
- 等待 `%LOCALAPPDATA%` 下的程序窗口出现；
- 检查 `data/clinic.db` 是否创建。

通过输出示例：

```text
测试目录为低完整性目录，符合复现条件。
PASS 启动脚本成功从低完整性目录复制并启动：燕霞诊所管理系统
PASS 数据目录：C:\Users\HP\AppData\Local\Temp\yanxia-package-test-target\data
```
