$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

dotnet --version
dotnet restore .\QuiltStudio.sln
dotnet build .\QuiltStudio.sln -c Release

dotnet publish .\src\QuiltStudio.App\QuiltStudio.App.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:PublishReadyToRun=true -o .\publish\win-x64

Write-Host ""
Write-Host "Build complete: $PSScriptRoot\publish\win-x64\QuiltStudio.exe"
