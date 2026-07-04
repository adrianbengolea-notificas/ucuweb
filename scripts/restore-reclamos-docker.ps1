#!/usr/bin/env pwsh
# Restaura v0021348_ucu_v2-20260703.bak en SQL Server (Docker) y deja listo migrate-reclamos.
$ErrorActionPreference = 'Stop'

$Root = Split-Path $PSScriptRoot -Parent
$BakDir = Join-Path $Root 'imports\reclamos\sql-backup'
$BakFile = Join-Path $BakDir 'v0021348_ucu_v2-20260703.bak'
$Container = 'ucu-reclamos-sql'
$SaPassword = if ($env:RECLAMOS_DOCKER_SA_PASSWORD) { $env:RECLAMOS_DOCKER_SA_PASSWORD } else { 'UcuRestore2026!' }
$DbName = 'v0021348_ucu_v2'

if (-not (Test-Path $BakFile)) {
  Write-Error "No se encontró $BakFile"
}

Write-Host "Iniciando SQL Server en Docker (contenedor: $Container)…"
$existing = docker ps -a --filter "name=$Container" --format '{{.Names}}'
if ($existing -eq $Container) {
  docker rm -f $Container | Out-Null
}

docker run -d `
  --name $Container `
  -e "ACCEPT_EULA=Y" `
  -e "MSSQL_SA_PASSWORD=$SaPassword" `
  -p 1433:1433 `
  -v "${BakDir}:/var/opt/mssql/backup" `
  mcr.microsoft.com/mssql/server:2019-latest | Out-Null

Write-Host "Esperando SQL Server (30-60 s)…"
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 3
  $logs = docker logs $Container 2>&1 | Out-String
  if ($logs -match 'SQL Server is now ready for client connections') {
    $ready = $true
    break
  }
}
if (-not $ready) {
  Write-Warning "Timeout esperando SQL. Revisá: docker logs $Container"
}

Write-Host "Obteniendo nombres lógicos del .bak…"
$fileListRaw = docker exec $Container /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $SaPassword -C -Q `
  "RESTORE FILELISTONLY FROM DISK = N'/var/opt/mssql/backup/v0021348_ucu_v2-20260703.bak';" -s "`t" -W -h -1

$dataRows = $fileListRaw | Where-Object {
  $_ -match '^\S' -and $_ -notmatch '^LogicalName' -and $_ -notmatch '^-+$' -and $_ -notmatch '^\(\d+ rows affected\)'
}
$dataFile = ($dataRows | Select-Object -First 1).Split("`t")[0].Trim()
$logFile = ($dataRows | Select-Object -Skip 1 -First 1).Split("`t")[0].Trim()
if (-not $dataFile -or -not $logFile) {
  Write-Error "No se pudieron leer los nombres lógicos del .bak. Salida:`n$fileListRaw"
}
Write-Host "  Data: $dataFile"
Write-Host "  Log:  $logFile"

Write-Host "Restaurando base $DbName…"
$restoreSql = @"
RESTORE DATABASE [$DbName]
FROM DISK = N'/var/opt/mssql/backup/v0021348_ucu_v2-20260703.bak'
WITH
  MOVE N'$dataFile' TO N'/var/opt/mssql/data/${DbName}.mdf',
  MOVE N'$logFile' TO N'/var/opt/mssql/data/${DbName}_log.ldf',
  REPLACE,
  RECOVERY;
"@

docker exec $Container /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $SaPassword -C -Q $restoreSql

Write-Host ""
Write-Host "Listo. Actualizá .env.local:"
Write-Host "  RECLAMOS_SQL_SERVER=localhost"
Write-Host "  RECLAMOS_SQL_USER=sa"
Write-Host "  RECLAMOS_SQL_PASSWORD=$SaPassword"
Write-Host "  RECLAMOS_SQL_DATABASE=$DbName"
Write-Host ""
Write-Host "Luego: npm run probe:reclamos:sql && npm run migrate:reclamos:sample"
