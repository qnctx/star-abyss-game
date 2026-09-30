@echo off
rem Historical browser test lab. Current game: tools\start-godot.cmd
"D:\NodeJS\node.exe" "%~dp0tools\start-local-preview.cjs"
if errorlevel 1 pause
