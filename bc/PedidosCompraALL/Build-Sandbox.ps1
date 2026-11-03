param(
    [Parameter(Mandatory = $true)][string]$OriginalProject,
    [Parameter(Mandatory = $true)][string]$DynasoftSymbols,
    [Parameter(Mandatory = $true)][string]$Compiler,
    [string]$Version = '1.0.7.20261103',
    [string]$OutputPath = (Join-Path $PSScriptRoot 'PedidosCompraALL_SANDBOX_1.0.7.20261103.app')
)
$ErrorActionPreference = 'Stop'
$buildRoot = Join-Path $env:TEMP ('PedidosCompraSandbox-' + [guid]::NewGuid().ToString('N'))
$project = Join-Path $buildRoot 'project'
$cache = Join-Path $buildRoot 'symbols'
New-Item -ItemType Directory -Path $project, $cache | Out-Null

# El sandbox usa los campos de Dynasoft. La fuente de produccion y su
# dependencia CamposESTEL se conservan; la conversion es solo de este paquete.
foreach ($source in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.al') {
    $text = [IO.File]::ReadAllText($source.FullName)
    $text = $text.Replace('ALXProyecto', '"DynES EST Proyecto"').Replace('ALXTarea', '"DynES EST Tarea"')
    [IO.File]::WriteAllText((Join-Path $project $source.Name), $text, [Text.UTF8Encoding]::new($false))
}
$manifest = [IO.File]::ReadAllText((Join-Path $OriginalProject 'app.json')) | ConvertFrom-Json
$manifest.version = $Version
$manifest.dependencies = @([PSCustomObject]@{
    id = '92b6a001-3a09-441e-aea0-9cbf29caabd7'
    name = 'Estel Customization'
    publisher = 'Dynasoft Spain SLU'
    version = '1.6.8.20260727'
})
[IO.File]::WriteAllText((Join-Path $project 'app.json'), ($manifest | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))

# No usar el fichero local de igual version: sus simbolos difieren de los
# descargados del sandbox. Se usa explicitamente el paquete real del entorno.
Get-ChildItem -LiteralPath (Join-Path $OriginalProject '.alpackages') -Filter 'Microsoft*.app' | Copy-Item -Destination $cache
Copy-Item -LiteralPath $DynasoftSymbols -Destination (Join-Path $cache 'Dynasoft_Sandbox_1.6.8.20260727.app')
& $Compiler "/project:$project" "/packagecachepath:$cache" "/out:$OutputPath"
if ($LASTEXITCODE -ne 0) { throw 'La compilacion sandbox ha fallado; no instalar el paquete.' }
Write-Output "Paquete sandbox: $OutputPath"
