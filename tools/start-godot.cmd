@echo off
setlocal
for %%I in ("%~dp0..\godot") do set "GAME_DIR=%%~fI"
if not exist "%GAME_DIR%\project.godot" (
  echo Current Godot project was not found: %GAME_DIR%
  exit /b 1
)
set "ENGINE=D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64.exe"
if defined GODOT_BIN set "ENGINE=%GODOT_BIN%"
if not exist "%ENGINE%" (
  where /q godot
  if errorlevel 1 (
    echo Godot was not found. Set GODOT_BIN or open godot\project.godot in the editor.
    exit /b 1
  )
  set "ENGINE=godot"
)
if /i "%~1"=="--check" (
  echo Main project: %GAME_DIR%\project.godot
  echo Engine: %ENGINE%
  echo Check only. Engine was not launched; no import cache was written.
  exit /b 0
)
if not exist "%GAME_DIR%\.godot\imported" (
  "%ENGINE%" --headless --path "%GAME_DIR%" --editor --quit
  if errorlevel 1 (
    echo Godot asset import failed.
    exit /b 1
  )
)
start "" "%ENGINE%" --path "%GAME_DIR%"
exit /b %errorlevel%
