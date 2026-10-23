@echo off
setlocal
title Yanxia Clinic
set "SRC=%~dp0"
set "DST=%LOCALAPPDATA%\Programs\YanxiaClinicManagementSystem"
if defined YANXIA_LAUNCH_DIR set "DST=%YANXIA_LAUNCH_DIR%"
if not exist "%DST%" mkdir "%DST%"
echo Preparing Yanxia Clinic...
robocopy "%SRC%." "%DST%" /E /XO /R:1 /W:1 /XD data /XF "launcher.log" /NFL /NDL /NJH /NJS /NP
if exist "%SRC%data" if not exist "%DST%\data" robocopy "%SRC%data" "%DST%\data" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP
if not exist "%DST%\yanxia-clinic.exe" (
  echo Failed to prepare the application files.
  pause
  exit /b 1
)
set ELECTRON_RUN_AS_NODE=
start "" "%DST%\yanxia-clinic.exe"