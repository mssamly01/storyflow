@echo off
title StoryFlow Server Starter
color 0b
cls

echo ===================================================
echo       STORYFLOW STUDIO - SERVER STARTER
echo ===================================================
echo.
echo  [*] Thu muc dang dung: %~dp0
echo  [*] Dang kiem tra moi truong...
echo.

cd /d "%~dp0"

:: Kiem tra node_modules
if not exist node_modules (
    echo  [!] Khong tim thay thu muc node_modules.
    echo  [*] Dang tien hanh cai dat dependencies [npm install]...
    call npm install
    if %errorlevel% neq 0 (
        color 0c
        echo  [X] Cai dat dependencies that bai. Vui long kiem tra lai Node.js!
        pause
        exit /b
    )
    echo  [+] Cai dat hoan tat!
    echo.
)

:: Khoi dong local server va Vite frontend
echo  [*] Dang khoi dong StoryFlow server + Vite frontend...
echo  [*] Vui long mo trinh duyet theo URL hien thi phia duoi.
echo  ===================================================
echo.

call npm run dev

if %errorlevel% neq 0 (
    color 0c
    echo.
    echo  [X] Co loi xay ra khi khoi dong server.
    pause
)
