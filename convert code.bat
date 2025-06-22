@echo off
setlocal EnableDelayedExpansion

set "basePath=%CD%"
set "outputFile=all_code.md"

echo Membuat %outputFile% ...
> "%outputFile%" echo # All JavaScript Code Files

rem ===== Loop semua file .js secara rekursif
for /R %%f in (*.js) do (
    set "fullPath=%%f"

    rem ===== Lewati file dari folder node_modules
    echo !fullPath! | findstr /I "node_modules" >nul
    if errorlevel 1 (

        rem ===== Buat relative path
        set "relPath=!fullPath:%basePath%=.!"

        rem ===== Escape karakter ~
        set "relPath=!relPath:~=~!"

        rem ===== Tulis ke file markdown
        >> "%outputFile%" echo.
        >> "%outputFile%" echo ## File %%~nxf
        >> "%outputFile%" echo _Path: !relPath!_
        >> "%outputFile%" echo.
        >> "%outputFile%" echo \`\`\`javascript
        type "%%f" >> "%outputFile%"
        >> "%outputFile%" echo \`\`\`
        >> "%outputFile%" echo.
    )
)

echo Membuat PDF dari %outputFile% ...
pandoc "%outputFile%" -o project_code.pdf --highlight-style=tango

echo.
echo ✅ PDF berhasil dibuat: project_code.pdf
pause
