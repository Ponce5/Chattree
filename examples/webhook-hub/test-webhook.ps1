<#
.SYNOPSIS
  Script de prueba interactivo para enviar un Webhook entrante a Chattree.
.DESCRIPTION
  Envia una solicitud HTTP POST autenticada con Bearer Token y cabecera de idempotencia
  hacia el servidor local de Chattree (127.0.0.1:8765).
  Detecta automaticamente dispositivos Android conectados via ADB y reenvia el puerto.
.PARAMETER Secret
  Token secreto copiado de Chattree: Ajustes -> Plugins -> Webhook Hub -> Webhooks Entrantes.
.PARAMETER Port
  Puerto del InboundHttpServer (por defecto 8765).
.EXAMPLE
  .\test-webhook.ps1 -Secret "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
#>
param(
  [Parameter(Mandatory=$false)]
  [string]$Secret = "",
  [int]$Port = 8765
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   [WEBHOOK] Chattree Inbound Webhook Test Utility        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

if ([string]::IsNullOrWhiteSpace($Secret)) {
  Write-Host "Por favor copia tu token secreto desde:" -ForegroundColor Yellow
  Write-Host "Chattree -> Ajustes -> Plugins -> Webhook Hub -> Webhooks Entrantes" -ForegroundColor DarkGray
  Write-Host ""
  $Secret = Read-Host "Ingresa el Secreto (Bearer Token)"
}

if ([string]::IsNullOrWhiteSpace($Secret)) {
  Write-Error "El secreto es obligatorio para autenticar contra Chattree."
  exit 1
}

# Auto-reenvio de puerto si hay un dispositivo Android conectado por ADB
$adbCandidates = @(
  "adb",
  "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
  "$env:USERPROFILE\AppData\Local\Android\sdk\platform-tools\adb.exe"
)
foreach ($adb in $adbCandidates) {
  $adbCmd = Get-Command $adb -ErrorAction SilentlyContinue
  if ($adbCmd -or (Test-Path $adb)) {
    try {
      & $adb forward tcp:$Port tcp:$Port 2>$null
      Write-Host "[+] ADB detectado: Puerto $Port reenviado al dispositivo Android." -ForegroundColor DarkGray
      break
    } catch {}
  }
}

$url = "http://127.0.0.1:$Port/plugins/com.developer.webhook.hub/alerts"
$deliveryId = [System.Guid]::NewGuid().ToString()

$headers = @{
  "Authorization" = "Bearer $Secret"
  "X-Chattree-Delivery-Id" = $deliveryId
}

$payloadObj = @{
  title = "Alerta de Monitor CI/CD"
  level = "warning"
  message = "Compilacion completada con exito y 0 errores en el pipeline."
  source = "PowerShell-TestRunner"
  timestamp = (Get-Date).ToString("o")
}

$payload = $payloadObj | ConvertTo-Json

Write-Host "[+] Enviando POST a: $url" -ForegroundColor DarkGray
Write-Host "[+] Delivery ID:     $deliveryId" -ForegroundColor DarkGray
Write-Host ""

try {
  $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $payload -ContentType "application/json; charset=utf-8"
  Write-Host "[OK] RESPUESTA EXITOSA DE CHATTREE!" -ForegroundColor Green
  Write-Host "Resultado del servidor:" -ForegroundColor White
  $response | Format-List
  Write-Host ""
  Write-Host "[INFO] Abre Chattree y escribe /webhook last para ver el payload recibido." -ForegroundColor Cyan
} catch {
  Write-Host "[ERROR] No se pudo enviar el webhook a Chattree:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  if ($_.Exception.Response) {
    try {
      $stream = $_.Exception.Response.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $responseBody = $reader.ReadToEnd()
      Write-Host "Respuesta devuelta por Chattree: $responseBody" -ForegroundColor Yellow
    } catch {}
  }
}
