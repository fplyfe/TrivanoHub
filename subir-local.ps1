# Sobe o TrivanoHub no Docker local: http://localhost:3090
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Rand([int]$n) { -join ((48..57) + (65..90) + (97..122) | Get-Random -Count $n | ForEach-Object { [char]$_ }) }

if (-not (Test-Path ".env")) {
    $adminEmail = Read-Host "E-mail do administrador"
    $adminName = Read-Host "Nome do administrador"
    $p1 = Rand 14; $p2 = Rand 14; $p3 = Rand 14
    $secret = [Convert]::ToBase64String((1..48 | ForEach-Object { [byte](Get-Random -Max 256) }))
    @"
POSTGRES_USER=gestorshop
POSTGRES_PASSWORD=$(Rand 32)
POSTGRES_DB=gestorshop
AUTH_SECRET=$secret
USER1_NAME=$adminName
USER1_EMAIL=$adminEmail
USER1_PASSWORD=$p1
USER2_NAME=Usuario 2
USER2_EMAIL=usuario2@gestorshop.local
USER2_PASSWORD=$p2
USER3_NAME=Usuario 3
USER3_EMAIL=usuario3@gestorshop.local
USER3_PASSWORD=$p3
"@ | Set-Content -Encoding ascii ".env"
    @"
TrivanoHub - logins iniciais (troque as senhas depois de entrar e apague este arquivo)
Administrador: $adminEmail  /  $p1
Usuario 2:     usuario2@gestorshop.local  /  $p2
Usuario 3:     usuario3@gestorshop.local  /  $p3
"@ | Set-Content -Encoding utf8 "LOGINS.txt"
    Write-Host ".env criado. Logins salvos em LOGINS.txt" -ForegroundColor Green
}

docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Write-Host "Falhou - veja a mensagem acima." -ForegroundColor Red; exit 1 }
docker compose ps
Write-Host "`nPronto: http://localhost:3090" -ForegroundColor Green
Get-Content LOGINS.txt -ErrorAction SilentlyContinue
