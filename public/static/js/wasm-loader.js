function fallbackStats(cells) {
    const flat = cells.flat();
    const filled = flat.filter((value) => String(value || "").trim() !== "").length;
    const numericValues = flat
        .map((value) => Number(String(value).trim()))
        .filter((value) => Number.isFinite(value));

    return {
        filled,
        numeric: numericValues.length,
        sum: Number(numericValues.reduce((total, value) => total + value, 0).toFixed(2)),
        maxColumns: Math.max(...cells.map((row) => row.length), 0),
    };
}

function fallbackVisualModel(cells, active, visualMode) {
    const numericEntries = [];
    cells.forEach((row, rowIndex) => {
        row.forEach((value, colIndex) => {
            const number = Number(String(value).trim());
            if (Number.isFinite(number)) {
                numericEntries.push({ row: rowIndex, col: colIndex, value: number });
            }
        });
    });

    const values = numericEntries.map((entry) => entry.value);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    const range = max - min || 1;

    return {
        visualMode,
        active,
        heatCells: numericEntries.map((entry) => ({
            ...entry,
            intensity: Math.max(0, Math.min(1, (entry.value - min) / range)),
        })),
        numericRange: { min, max },
    };
}

const fallbackSheetTools = {
    mode: "JavaScript Canvas Fallback",
    computeStats: fallbackStats,
    buildVisualModel: fallbackVisualModel,
};

async function initRustSheetTools() {
    try {
        const module = await import("/static/wasm/rust_sheet_graphics.js");
        await module.default("/static/wasm/rust_sheet_graphics_bg.wasm");

        return {
            mode: "Rust WebAssembly",
            computeStats(cells) {
                return JSON.parse(module.compute_stats_json(JSON.stringify(cells)));
            },
            buildVisualModel(cells, active, visualMode) {
                return JSON.parse(
                    module.build_visual_model_json(
                        JSON.stringify(cells),
                        active.row,
                        active.col,
                        visualMode
                    )
                );
            },
        };
    } catch (error) {
        return null;
    }
}

async function initGoSheetTools() {
    if (typeof window.Go !== "function") {
        return null;
    }

    try {
        const response = await fetch("/static/wasm/sheet_tools.wasm", { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Compiled Go wasm bundle not found.");
        }

        const go = new window.Go();
        const source = await response.arrayBuffer();
        const result = await WebAssembly.instantiate(source, go.importObject);
        go.run(result.instance);

        if (typeof window.sheetToolStats !== "function") {
            throw new Error("Go sheet tool was not registered.");
        }

        return {
            mode: "Go WebAssembly + JS Graphics",
            computeStats(cells) {
                return JSON.parse(window.sheetToolStats(JSON.stringify(cells)));
            },
            buildVisualModel: fallbackVisualModel,
        };
    } catch (error) {
        return null;
    }
}

window.initSheetTools = async function initSheetTools() {
    return (await initRustSheetTools()) || (await initGoSheetTools()) || fallbackSheetTools;
};
