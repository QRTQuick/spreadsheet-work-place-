$go = Get-Command go -ErrorAction SilentlyContinue
if (-not $go) {
    throw "Go is not installed. Install Go first, then rerun this script."
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$wasmDir = Join-Path $root "public\static\wasm"
$wasmTarget = Join-Path $wasmDir "sheet_tools.wasm"
$execTarget = Join-Path $wasmDir "wasm_exec.js"

New-Item -ItemType Directory -Force -Path $wasmDir | Out-Null

$env:GOOS = "js"
$env:GOARCH = "wasm"

go env GOROOT | ForEach-Object {
    $wasmExec = Join-Path $_ "misc\wasm\wasm_exec.js"
    Copy-Item -Force $wasmExec $execTarget
}

Push-Location $root
try {
    go build -o $wasmTarget .\wasm
}
finally {
    Pop-Location
}
