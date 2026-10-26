param(
  [string]$ZipPath = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $ZipPath) {
  $ZipPath = Join-Path $root "release\YanxiaClinicManagementSystem-0.6.0-win-x64.zip"
}
if (-not (Test-Path -LiteralPath $ZipPath)) {
  throw "找不到安装包：$ZipPath。请先运行 npm run package:win。"
}

$testDir = Join-Path $root ".tmp\package-launch-test"
$target = Join-Path $env:TEMP "yanxia-package-test-target"
$oldLaunchDir = $env:YANXIA_LAUNCH_DIR

function Stop-TestApp {
  Get-Process -Name "yanxia-clinic" -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
  Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -like "$target*" } |
    Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
}

try {
  Stop-TestApp
  if (Test-Path -LiteralPath $testDir) {
    Remove-Item -LiteralPath $testDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $testDir -Force | Out-Null
  Expand-Archive -LiteralPath $ZipPath -DestinationPath $testDir -Force

  $batch = Join-Path $testDir "启动燕霞诊所管理系统.cmd"
  if (-not (Test-Path -LiteralPath $batch)) {
    throw "安装包缺少启动脚本：启动燕霞诊所管理系统.cmd"
  }
  $mainExe = Join-Path $testDir "yanxia-clinic.exe"
  if (-not (Test-Path -LiteralPath $mainExe)) {
    throw "安装包缺少主程序：yanxia-clinic.exe"
  }
  $template = Join-Path $testDir "resources\prescription-template.jpg"
  if (-not (Test-Path -LiteralPath $template)) {
    throw "安装包缺少处方模板图片：resources\prescription-template.jpg"
  }
  Write-Output "PASS 安装包包含处方模板图片：$template"

  $aclText = (icacls $testDir 2>&1 | Out-String)
  if ($aclText -match "Low Mandatory Level") {
    Write-Output "测试目录为低完整性目录，符合复现条件。"
  } else {
    Write-Warning "测试目录不是低完整性目录；本次测试仍验证启动脚本流程。"
  }

  $env:YANXIA_LAUNCH_DIR = $target
  Write-Output "运行启动脚本：$batch"
  & $batch
  if ($LASTEXITCODE -ne 0) {
    throw "启动脚本返回失败：$LASTEXITCODE"
  }

  $deadline = (Get-Date).AddSeconds(90)
  $window = $null
  while ((Get-Date) -lt $deadline) {
    $window = Get-Process -Name "yanxia-clinic" -ErrorAction SilentlyContinue |
      Where-Object { $_.Path -like "$target*" -and $_.MainWindowHandle -ne 0 } |
      Select-Object -First 1
    if ($window -and (Test-Path -LiteralPath (Join-Path $target "data\clinic.db"))) {
      break
    }
    Start-Sleep -Milliseconds 500
  }

  if (-not $window) {
    throw "启动超时：没有看到燕霞诊所窗口。"
  }
  if ($window.MainWindowTitle -notlike "*燕霞诊所*") {
    throw "窗口标题不正确：$($window.MainWindowTitle)"
  }
  $db = Join-Path $target "data\clinic.db"
  if (-not (Test-Path -LiteralPath $db)) {
    throw "启动后没有创建数据库：$db"
  }
  Write-Output "PASS 启动脚本成功从低完整性目录复制并启动：$($window.MainWindowTitle)"
  Write-Output "PASS 数据目录：$(Join-Path $target 'data')"
}
finally {
  Stop-TestApp
  if ($null -eq $oldLaunchDir) {
    Remove-Item Env:YANXIA_LAUNCH_DIR -ErrorAction SilentlyContinue
  } else {
    $env:YANXIA_LAUNCH_DIR = $oldLaunchDir
  }
  if (Test-Path -LiteralPath $testDir) {
    Remove-Item -LiteralPath $testDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
