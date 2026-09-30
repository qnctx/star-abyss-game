@echo off
setlocal
set "GAME_DIR=%~dp0godot"
set "ENGINE=D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64.exe"
if not exist "%ENGINE%" (
  where /q godot
  if errorlevel 1 (
    echo Godot 4.6.2 was not found. Open godot\project.godot in your Godot editor.
    pause
    exit /b 1
  )
  set "ENGINE=godot"
)
if not exist "%GAME_DIR%\.godot\imported" (
  "%ENGINE%" --headless --path "%GAME_DIR%" --editor --quit
  if errorlevel 1 (
    echo Godot asset import failed.
    pause
    exit /b 1
  )
)
start "" "%ENGINE%" --path "%GAME_DIR%"
