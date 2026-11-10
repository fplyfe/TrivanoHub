# Copia os backups da VPS para o seu PC (ex.: uma pasta do OneDrive, que já sobe para a nuvem).
# Uso no PowerShell:  .\scripts\baixar-backups.ps1 -Servidor 1.2.3.4 -Usuario root
# Dá para agendar no "Agendador de Tarefas" do Windows para rodar todo dia.
param(
  [Parameter(Mandatory = $true)][string]$Servidor,
  [string]$Usuario = "root",
  [string]$PastaRemota = "/opt/trivanohub/backups",
  [string]$Destino = "$env:USERPROFILE\OneDrive\TrivanoHub-backups"
)
New-Item -ItemType Directory -Force -Path $Destino | Out-Null
scp -r "${Usuario}@${Servidor}:${PastaRemota}/*" $Destino
if ($LASTEXITCODE -eq 0) { Write-Host "Backups copiados para $Destino" -ForegroundColor Green }
else { Write-Host "Falhou. Confira o IP, o usuário e a chave SSH." -ForegroundColor Red }
