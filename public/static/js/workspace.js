const workspaceNode = document.getElementById("workspace-data");

if (workspaceNode) {
    const bootstrap = JSON.parse(workspaceNode.textContent);
    const saveState = document.querySelector("[data-save-state]");
    const activeCellLabel = document.querySelector("[data-active-cell]");
    const formulaBar = document.getElementById("formula-bar");
    const sheetGrid = document.querySelector("[data-sheet-grid]");
    const sheetFrame = document.querySelector("[data-sheet-frame]");
    const sheetCanvas = document.querySelector("[data-sheet-canvas]");
    const importInput = document.querySelector("[data-import-input]");
    const addRowButton = document.querySelector("[data-add-row]");
    const addColumnButton = document.querySelector("[data-add-column]");
    const filledNode = document.querySelector("[data-sheet-filled]");
    const numericNode = document.querySelector("[data-sheet-numeric]");
    const sumNode = document.querySelector("[data-sheet-sum]");
    const engineModeNode = document.querySelector("[data-engine-mode]");
    const rendererKindNode = document.querySelector("[data-renderer-kind]");
    const visualModeLabelNode = document.querySelector("[data-visual-mode-label]");
    const activeSummaryNode = document.querySelector("[data-active-summary]");
    const activeValueNode = document.querySelector("[data-active-value]");
    const toolLabelNode = document.querySelector("[data-tool-label]");
    const visualModeSelect = document.querySelector("[data-visual-mode]");
    const zoomSlider = document.querySelector("[data-zoom-slider]");
    const zoomValueNode = document.querySelector("[data-zoom-value]");
    const toolButtons = [...document.querySelectorAll("[data-tool]")];
    const swatchButtons = [...document.querySelectorAll("[data-swatch]")];
    const onboardingPanel = document.querySelector("[data-onboarding-panel]");
    const onboardingDismissButton = document.querySelector("[data-guide-dismiss]");
    const onboardingStartButton = document.querySelector("[data-guide-start]");

    const minRows = 18;
    const minCols = 8;
    const toolTitles = {
        select: "Selection tool active",
        draw: "Draw tool active",
        focus: "Focus tool active",
        comment: "Comment tool active",
    };
    const visualModeDescriptions = {
        neon: "Neon Studio mode with live graphics.",
        heatmap: "Heatmap mode highlights numeric intensity.",
        focus: "Focus Grid mode isolates your active row and column.",
    };

    const state = {
        workspace: bootstrap.workspace,
        cells: normalizeCells(bootstrap.workspace.sheet.cells),
        active: { row: 0, col: 0 },
        saveTimer: null,
        engine: null,
        tool: "select",
        visualMode: "neon",
        zoom: 100,
        swatch: "#78ffd6",
        renderQueued: false,
    };

    function normalizeCells(cells) {
        const rows = Array.isArray(cells) ? cells.map((row) => [...row]) : [];
        const width = Math.max(...rows.map((row) => row.length), minCols);
        while (rows.length < minRows) {
            rows.push(Array.from({ length: width }, () => ""));
        }
        rows.forEach((row) => {
            while (row.length < width) {
                row.push("");
            }
        });
        return rows;
    }

    function columnLabel(index) {
        let current = index;
        let label = "";
        while (current >= 0) {
            label = String.fromCharCode(65 + (current % 26)) + label;
            current = Math.floor(current / 26) - 1;
        }
        return label;
    }

    function setSaveState(message, tone = "") {
        saveState.textContent = message;
        saveState.className = `save-state ${tone}`.trim();
    }

    function describeCell(value) {
        const text = String(value || "").trim();
        if (!text) {
            return "Empty cell";
        }
        if (text.startsWith("=")) {
            return `Formula-like value: ${text}`;
        }
        const numeric = Number(text);
        if (Number.isFinite(numeric)) {
            return `Numeric value: ${numeric}`;
        }
        return `Text value: ${text}`;
    }

    function setTool(tool) {
        state.tool = tool;
        toolButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.tool === tool);
        });
        toolLabelNode.textContent = toolTitles[tool] || "Selection tool active";
        requestGraphicsRender();
    }

    function setVisualMode(mode) {
        state.visualMode = mode;
        if (visualModeSelect) {
            visualModeSelect.value = mode;
        }
        visualModeLabelNode.textContent = visualModeDescriptions[mode] || visualModeDescriptions.neon;
        updateCellHighlights();
        requestGraphicsRender();
    }

    function setZoom(zoom) {
        state.zoom = zoom;
        if (zoomSlider) {
            zoomSlider.value = String(zoom);
        }
        if (zoomValueNode) {
            zoomValueNode.textContent = `${zoom}%`;
        }
        sheetFrame?.style.setProperty("--sheet-scale", String(zoom / 100));
        window.setTimeout(requestGraphicsRender, 30);
    }

    function setSwatch(color) {
        state.swatch = color;
        swatchButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.swatch === color);
        });
        sheetFrame?.style.setProperty("--sheet-accent", color);
        requestGraphicsRender();
    }

    function updateInspector() {
        const value = state.cells[state.active.row][state.active.col] || "";
        const label = `${columnLabel(state.active.col)}${state.active.row + 1}`;
        activeCellLabel.textContent = label;
        activeSummaryNode.textContent = label;
        activeValueNode.textContent = describeCell(value);
        formulaBar.value = value;
        toolLabelNode.textContent = toolTitles[state.tool] || "Selection tool active";
        visualModeLabelNode.textContent = visualModeDescriptions[state.visualMode] || visualModeDescriptions.neon;
        rendererKindNode.textContent = state.engine?.mode || "Loading";
    }

    function selectCell(row, col) {
        state.active = { row, col };
        updateInspector();
        updateCellHighlights();
        requestGraphicsRender();
    }

    function focusCell(row, col) {
        const input = sheetGrid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        input?.focus();
    }

    function dismissOnboarding(shouldFocus = false) {
        if (!onboardingPanel) {
            return;
        }

        onboardingPanel.remove();
        const url = new URL(window.location.href);
        url.searchParams.delete("created");
        window.history.replaceState({}, "", url);

        if (shouldFocus) {
            window.setTimeout(() => focusCell(0, 0), 30);
        }
    }

    function updateCellHighlights() {
        sheetGrid.querySelectorAll(".sheet-cell").forEach((input) => {
            const row = Number(input.dataset.row);
            const col = Number(input.dataset.col);
            const isFocusCross = state.visualMode === "focus" && (row === state.active.row || col === state.active.col);
            const isActive = row === state.active.row && col === state.active.col;
            input.classList.toggle("is-highlighted", isActive || isFocusCross);
        });
    }

    function renderGrid() {
        const table = document.createElement("table");
        table.className = "sheet-table";

        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        const corner = document.createElement("th");
        corner.className = "sheet-col-head";
        headRow.appendChild(corner);

        for (let col = 0; col < state.cells[0].length; col += 1) {
            const th = document.createElement("th");
            th.className = "sheet-col-head";
            th.textContent = columnLabel(col);
            headRow.appendChild(th);
        }

        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        state.cells.forEach((row, rowIndex) => {
            const tr = document.createElement("tr");
            const rowHead = document.createElement("th");
            rowHead.className = "sheet-row-head";
            rowHead.textContent = String(rowIndex + 1);
            tr.appendChild(rowHead);

            row.forEach((value, colIndex) => {
                const td = document.createElement("td");
                const input = document.createElement("input");
                input.className = "sheet-cell";
                input.value = value;
                input.dataset.row = String(rowIndex);
                input.dataset.col = String(colIndex);

                input.addEventListener("focus", () => selectCell(rowIndex, colIndex));
                input.addEventListener("input", (event) => {
                    state.cells[rowIndex][colIndex] = event.target.value;
                    if (state.active.row === rowIndex && state.active.col === colIndex) {
                        formulaBar.value = event.target.value;
                    }
                    updateInspector();
                    updateCellHighlights();
                    scheduleSave();
                    refreshStats();
                    requestGraphicsRender();
                });
                input.addEventListener("keydown", (event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        focusCell(Math.min(rowIndex + 1, state.cells.length - 1), colIndex);
                    }
                    if (event.key === "Tab" && colIndex + 1 < state.cells[rowIndex].length) {
                        event.preventDefault();
                        focusCell(rowIndex, colIndex + 1);
                    }
                });

                td.appendChild(input);
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        sheetGrid.innerHTML = "";
        sheetGrid.appendChild(table);
        updateInspector();
        updateCellHighlights();
        requestGraphicsRender();
    }

    function scheduleSave() {
        setSaveState("Saving changes…");
        clearTimeout(state.saveTimer);
        state.saveTimer = window.setTimeout(saveSheet, 750);
    }

    async function saveSheet() {
        try {
            const response = await fetch(`/api/workspaces/${state.workspace.id}/sheet`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cells: state.cells }),
            });
            const data = await response.json();
            if (!response.ok || !data.ok) {
                throw new Error(data.error || "Unable to save the spreadsheet.");
            }
            setSaveState("All changes saved.");
        } catch (error) {
            setSaveState(error.message);
        }
    }

    async function importSheet(file) {
        const formData = new FormData();
        formData.append("sheet", file);
        setSaveState("Importing spreadsheet…");

        try {
            const response = await fetch(`/api/workspaces/${state.workspace.id}/import`, {
                method: "POST",
                body: formData,
            });
            const data = await response.json();
            if (!response.ok || !data.ok) {
                throw new Error(data.error || "Import failed.");
            }

            state.workspace = data.workspace;
            state.cells = normalizeCells(data.workspace.sheet.cells);
            state.active = { row: 0, col: 0 };
            renderGrid();
            refreshStats();
            setSaveState("Spreadsheet imported.");
        } catch (error) {
            setSaveState(error.message);
        }
    }

    function refreshStats() {
        if (!state.engine) {
            return;
        }

        const stats = state.engine.computeStats(state.cells);
        filledNode.textContent = String(stats.filled);
        numericNode.textContent = String(stats.numeric);
        sumNode.textContent = String(stats.sum);
    }

    function getVisualModel() {
        if (!state.engine || typeof state.engine.buildVisualModel !== "function") {
            return null;
        }

        return state.engine.buildVisualModel(state.cells, state.active, state.visualMode);
    }

    function roundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    function drawGraphics() {
        if (!sheetCanvas || !sheetFrame) {
            return;
        }

        const model = getVisualModel();
        if (!model) {
            return;
        }

        const rect = sheetFrame.getBoundingClientRect();
        if (!rect.width || !rect.height) {
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        sheetCanvas.width = Math.floor(rect.width * dpr);
        sheetCanvas.height = Math.floor(rect.height * dpr);
        sheetCanvas.style.width = `${rect.width}px`;
        sheetCanvas.style.height = `${rect.height}px`;

        const ctx = sheetCanvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);

        const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
        gradient.addColorStop(0, "rgba(120, 255, 214, 0.10)");
        gradient.addColorStop(0.5, "rgba(67, 187, 255, 0.05)");
        gradient.addColorStop(1, "rgba(255, 155, 113, 0.08)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, rect.width, rect.height);

        model.heatCells.forEach((cell) => {
            const input = sheetGrid.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
            if (!input) {
                return;
            }
            const cellRect = input.getBoundingClientRect();
            const x = cellRect.left - rect.left;
            const y = cellRect.top - rect.top;
            const width = cellRect.width;
            const height = cellRect.height;

            if (x + width < 0 || y + height < 0 || x > rect.width || y > rect.height) {
                return;
            }

            const alpha = 0.10 + cell.intensity * 0.28;
            let fill = `rgba(120, 255, 214, ${alpha})`;
            if (state.visualMode === "heatmap") {
                fill = `rgba(255, 155, 113, ${0.08 + cell.intensity * 0.34})`;
            }
            if (state.visualMode === "focus") {
                fill = `rgba(67, 187, 255, ${0.06 + cell.intensity * 0.26})`;
            }

            roundedRect(ctx, x, y, width, height, 12);
            ctx.fillStyle = fill;
            ctx.fill();
        });

        const activeInput = sheetGrid.querySelector(`[data-row="${state.active.row}"][data-col="${state.active.col}"]`);
        if (activeInput) {
            const activeRect = activeInput.getBoundingClientRect();
            const x = activeRect.left - rect.left;
            const y = activeRect.top - rect.top;
            const width = activeRect.width;
            const height = activeRect.height;

            ctx.save();
            ctx.shadowBlur = 28;
            ctx.shadowColor = state.swatch;
            roundedRect(ctx, x - 3, y - 3, width + 6, height + 6, 16);
            ctx.strokeStyle = state.swatch;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            if (state.visualMode === "focus") {
                ctx.fillStyle = "rgba(120, 255, 214, 0.07)";
                ctx.fillRect(0, y, rect.width, height);
                ctx.fillRect(x, 0, width, rect.height);
            }
        }
    }

    function requestGraphicsRender() {
        if (state.renderQueued) {
            return;
        }

        state.renderQueued = true;
        window.requestAnimationFrame(() => {
            state.renderQueued = false;
            drawGraphics();
        });
    }

    formulaBar?.addEventListener("input", (event) => {
        const { row, col } = state.active;
        state.cells[row][col] = event.target.value;
        const input = sheetGrid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (input) {
            input.value = event.target.value;
        }
        updateInspector();
        updateCellHighlights();
        scheduleSave();
        refreshStats();
        requestGraphicsRender();
    });

    importInput?.addEventListener("change", (event) => {
        const [file] = event.target.files || [];
        if (file) {
            importSheet(file);
        }
        event.target.value = "";
    });

    addRowButton?.addEventListener("click", () => {
        state.cells.push(Array.from({ length: state.cells[0].length }, () => ""));
        renderGrid();
        refreshStats();
        scheduleSave();
    });

    addColumnButton?.addEventListener("click", () => {
        state.cells.forEach((row) => row.push(""));
        renderGrid();
        refreshStats();
        scheduleSave();
    });

    toolButtons.forEach((button) => {
        button.addEventListener("click", () => setTool(button.dataset.tool));
    });

    swatchButtons.forEach((button) => {
        button.addEventListener("click", () => setSwatch(button.dataset.swatch));
    });

    visualModeSelect?.addEventListener("change", (event) => {
        setVisualMode(event.target.value);
    });

    zoomSlider?.addEventListener("input", (event) => {
        setZoom(Number(event.target.value));
    });

    onboardingDismissButton?.addEventListener("click", () => {
        dismissOnboarding(false);
    });

    onboardingStartButton?.addEventListener("click", () => {
        dismissOnboarding(true);
    });

    sheetFrame?.addEventListener("scroll", requestGraphicsRender);
    window.addEventListener("resize", requestGraphicsRender);

    window.initSheetTools?.().then((engine) => {
        state.engine = engine;
        engineModeNode.textContent = `${engine.mode} active for spreadsheet summaries and graphics.`;
        rendererKindNode.textContent = engine.mode;
        refreshStats();
        updateInspector();
        requestGraphicsRender();
    });

    setTool(state.tool);
    setVisualMode(state.visualMode);
    setZoom(state.zoom);
    setSwatch(state.swatch);
    renderGrid();
}
