(function bootstrapGoStub() {
    if (typeof window.Go === "function") {
        return;
    }

    window.Go = class GoStub {
        constructor() {
            this.importObject = {};
        }

        run() {
            console.warn("Go wasm runtime not built yet. Run .\\scripts\\build_wasm.ps1 after installing Go.");
        }
    };
})();
