$wasmPack = Get-Command wasm-pack -ErrorAction SilentlyContinue
if (-not $wasmPack) {
    throw "wasm-pack is not installed. Install it first, then rerun this script."
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$crate = Join-Path $root "rust-wasm\sheet_graphics"
$outDir = Join-Path $root "public\static\wasm"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Push-Location $crate
try {
    wasm-pack build --target web --release --out-dir $outDir
}
finally {
    Pop-Location
}
