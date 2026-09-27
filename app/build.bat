@echo off
setlocal
rem Bien dich runable_g4market.exe bang trinh bien dich .NET Framework co san trong Windows.
rem Khong can Visual Studio hay SDK. Ket qua: ..\runable_g4market.exe (canh trang web de tai ve).
cd /d "%~dp0"

set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" set CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
if not exist "%CSC%" (
  echo Khong tim thay csc.exe - may nay thieu .NET Framework 4.
  exit /b 1
)

set ICON=
if exist icon.ico set ICON=/win32icon:icon.ico

"%CSC%" /nologo /target:winexe /platform:anycpu /optimize+ %ICON% ^
  /out:..\runable_g4market.exe ^
  /reference:System.Management.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll ^
  RunableG4Market.cs
if errorlevel 1 (
  echo Bien dich that bai.
  exit /b 1
)
echo Xong: ..\runable_g4market.exe
