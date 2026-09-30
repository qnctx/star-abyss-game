@echo off
cd /d "%~dp0"
node tools\start-playtest.cjs
if errorlevel 1 pause
