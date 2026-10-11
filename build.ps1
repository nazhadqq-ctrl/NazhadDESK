# NazhadDESK Build Script
Write-Host "Building NazhadDESK Executables..." -ForegroundColor Cyan

$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

# 1. Compile InputInjector.exe
Write-Host "[1/3] Compiling InputInjector.exe..." -ForegroundColor Yellow
& $csc /target:exe /out:InputInjector.exe /optimize /r:System.Windows.Forms.dll InputInjector.cs

# 2. Compile NazhaDesk.exe
Write-Host "[2/3] Compiling NazhaDesk.exe..." -ForegroundColor Yellow
& $csc /target:winexe /out:NazhaDesk.exe /optimize /r:System.Windows.Forms.dll Launcher.cs

# 3. Create payload and compile Setup-NazhaDesk.exe (if node.exe is present)
if (Test-Path "node.exe") {
    Write-Host "[3/3] Packing payload and compiling Setup-NazhaDesk.exe..." -ForegroundColor Yellow
    $files = @(
        "NazhaDesk.exe", "node.exe", "server.js", "InputInjector.exe", "package.json", "NazhaDesk.bat", "README-Kurdish.txt", "public", "node_modules"
    )
    Compress-Archive -Path $files -DestinationPath "payload.zip" -Force
    & $csc /target:winexe /out:Setup-NazhaDesk.exe /optimize /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /res:payload.zip,Payload NazhaDeskSetup.cs
    Remove-Item "payload.zip" -Force -ErrorAction SilentlyContinue
}

Write-Host "Build Complete!" -ForegroundColor Green
