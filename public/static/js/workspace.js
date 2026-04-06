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
    const ribbonTabButtons = [...document.querySelectorAll("[data-ribbon-tab]")];
    const ribbonPanels = [...document.querySelectorAll("[data-ribbon-panel]")];
    const toolButtons = [...document.querySelectorAll("[data-tool]")];
    const formulaActionButtons = [...document.querySelectorAll("[data-formula-action]")];
    const insertActionButtons = [...document.querySelectorAll("[data-insert-action]")];
    const dataActionButtons = [...document.querySelectorAll("[data-data-action]")];
    const reviewActionButtons = [...document.querySelectorAll("[data-review-action]")];
    const onboardingPanel = document.querySelector("[data-onboarding-panel]");
    const onboardingDismissButton = document.querySelector("[data-guide-dismiss]");
    const onboardingStartButton = document.querySelector("[data-guide-start]");

    const minRows = 18;
    const minCols = 8;
    const formulaError = "#ERROR!";
    const formulaCycle = "#CYCLE!";
    const cellRefPattern = /^\$?([A-Z]+)\$?([1-9][0-9]*)$/i;
    const toolTitles = {
        select: "Ready",
        draw: "Fill mode",
        focus: "Focus mode",
        comment: "Note mode",
    };
    const visualModeDescriptions = {
        neon: "Standard worksheet view.",
        heatmap: "Heatmap view for numeric intensity.",
        focus: "Focus view for the active row and column.",
    };

    const state = {
        workspace: bootstrap.workspace,
        cells: normalizeCells(bootstrap.workspace.sheet.cells),
        computed: [],
        active: { row: 0, col: 0 },
        saveTimer: null,
        engine: null,
        tool: "select",
        ribbonTab: "home",
        visualMode: "neon",
        zoom: 100,
        swatch: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1a73e8",
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

    function cellKey(row, col) {
        return `${row}:${col}`;
    }

    function getRawCellValue(row, col) {
        return state.cells[row]?.[col] ?? "";
    }

    function isFormula(rawValue) {
        return String(rawValue ?? "").trim().startsWith("=");
    }

    function parseCellReference(reference) {
        const match = cellRefPattern.exec(String(reference || "").trim().replace(/\$/g, ""));
        if (!match) {
            return null;
        }

        const [, letters, rowDigits] = match;
        let col = 0;
        for (const char of letters.toUpperCase()) {
            col = col * 26 + (char.charCodeAt(0) - 64);
        }

        return {
            row: Number(rowDigits) - 1,
            col: col - 1,
        };
    }

    function formatNumber(value) {
        if (!Number.isFinite(value)) {
            return formulaError;
        }

        if (Number.isInteger(value)) {
            return String(value);
        }

        return String(Number(value.toFixed(6)));
    }

    function formatDisplayValue(value) {
        if (value === null || value === undefined) {
            return "";
        }
        if (Array.isArray(value)) {
            return formulaError;
        }
        if (typeof value === "number") {
            return formatNumber(value);
        }
        return String(value);
    }

    function numericValue(value) {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        const text = String(value ?? "").trim().replace(/,/g, "");
        if (!text || text === formulaError || text === formulaCycle) {
            return null;
        }

        const parsed = Number(text);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function describeCell(rawValue, computedValue) {
        const rawText = String(rawValue ?? "").trim();
        const shownValue = formatDisplayValue(computedValue);

        if (!rawText) {
            return "Empty cell";
        }
        if (shownValue === formulaCycle) {
            return "Formula error: circular reference.";
        }
        if (shownValue === formulaError) {
            return "Formula error.";
        }
        if (isFormula(rawText)) {
            return `Formula result: ${shownValue}`;
        }

        const numeric = numericValue(computedValue);
        if (numeric !== null) {
            return `Numeric value: ${formatNumber(numeric)}`;
        }

        return `Text value: ${shownValue}`;
    }

    function setSaveState(message, tone = "") {
        saveState.textContent = message;
        saveState.className = `save-state ${tone}`.trim();
    }

    function tokenizeFormula(source) {
        const tokens = [];
        let index = 0;

        while (index < source.length) {
            const char = source[index];

            if (/\s/.test(char)) {
                index += 1;
                continue;
            }

            if (/[0-9.]/.test(char)) {
                const match = /^[0-9]+(?:\.[0-9]+)?|^\.[0-9]+/.exec(source.slice(index));
                if (!match) {
                    throw new Error("Invalid number.");
                }
                tokens.push({ type: "number", value: match[0] });
                index += match[0].length;
                continue;
            }

            if (/[$A-Za-z_]/.test(char)) {
                const match = /^[$A-Za-z_][$A-Za-z0-9_.]*/.exec(source.slice(index));
                if (!match) {
                    throw new Error("Invalid identifier.");
                }
                tokens.push({ type: "identifier", value: match[0] });
                index += match[0].length;
                continue;
            }

            if ("+-*/(),:;".includes(char)) {
                const types = {
                    "+": "operator",
                    "-": "operator",
                    "*": "operator",
                    "/": "operator",
                    "(": "lparen",
                    ")": "rparen",
                    ",": "comma",
                    ";": "comma",
                    ":": "colon",
                };
                tokens.push({ type: types[char], value: char });
                index += 1;
                continue;
            }

            throw new Error("Unsupported formula token.");
        }

        return tokens;
    }

    function parseFormula(source) {
        const tokens = tokenizeFormula(source);
        let index = 0;

        function peek() {
            return tokens[index] || null;
        }

        function consume(expectedType, expectedValue = null) {
            const token = tokens[index];
            if (!token || token.type !== expectedType || (expectedValue !== null && token.value !== expectedValue)) {
                throw new Error("Unexpected formula syntax.");
            }
            index += 1;
            return token;
        }

        function parseExpression() {
            return parseAdditive();
        }

        function parseAdditive() {
            let node = parseMultiplicative();
            while (peek()?.type === "operator" && ["+", "-"].includes(peek().value)) {
                const operator = consume("operator").value;
                node = { type: "binary", operator, left: node, right: parseMultiplicative() };
            }
            return node;
        }

        function parseMultiplicative() {
            let node = parseUnary();
            while (peek()?.type === "operator" && ["*", "/"].includes(peek().value)) {
                const operator = consume("operator").value;
                node = { type: "binary", operator, left: node, right: parseUnary() };
            }
            return node;
        }

        function parseUnary() {
            if (peek()?.type === "operator" && ["+", "-"].includes(peek().value)) {
                const operator = consume("operator").value;
                return { type: "unary", operator, argument: parseUnary() };
            }
            return parsePrimary();
        }

        function parsePrimary() {
            const token = peek();
            if (!token) {
                throw new Error("Incomplete formula.");
            }

            if (token.type === "number") {
                consume("number");
                return { type: "number", value: Number(token.value) };
            }

            if (token.type === "identifier") {
                const identifier = consume("identifier").value;

                if (peek()?.type === "lparen") {
                    consume("lparen");
                    const args = [];
                    if (peek()?.type !== "rparen") {
                        while (true) {
                            args.push(parseExpression());
                            if (peek()?.type !== "comma") {
                                break;
                            }
                            consume("comma");
                        }
                    }
                    consume("rparen");
                    return { type: "call", name: identifier.toUpperCase(), args };
                }

                if (parseCellReference(identifier)) {
                    if (peek()?.type === "colon") {
                        consume("colon");
                        const endRef = consume("identifier").value;
                        if (!parseCellReference(endRef)) {
                            throw new Error("Invalid cell range.");
                        }
                        return { type: "range", start: identifier.toUpperCase(), end: endRef.toUpperCase() };
                    }
                    return { type: "ref", ref: identifier.toUpperCase() };
                }

                throw new Error("Unknown name.");
            }

            if (token.type === "lparen") {
                consume("lparen");
                const node = parseExpression();
                consume("rparen");
                return node;
            }

            throw new Error("Unexpected token.");
        }

        const ast = parseExpression();
        if (index < tokens.length) {
            throw new Error("Unexpected trailing tokens.");
        }
        return ast;
    }

    function flattenFormulaValues(values) {
        return values.flatMap((value) => (Array.isArray(value) ? flattenFormulaValues(value) : [value]));
    }

    function evaluateFunction(name, args, stack, cache) {
        const values = flattenFormulaValues(args.map((arg) => evaluateFormulaNode(arg, stack, cache)));
        const numericValues = values.map((value) => numericValue(value)).filter((value) => value !== null);

        switch (name) {
            case "SUM":
                return numericValues.reduce((total, value) => total + value, 0);
            case "PRODUCT":
                return numericValues.length ? numericValues.reduce((total, value) => total * value, 1) : 0;
            case "AVERAGE":
                return numericValues.length
                    ? numericValues.reduce((total, value) => total + value, 0) / numericValues.length
                    : 0;
            case "MIN":
                return numericValues.length ? Math.min(...numericValues) : 0;
            case "MAX":
                return numericValues.length ? Math.max(...numericValues) : 0;
            case "COUNT":
                return numericValues.length;
            default:
                throw new Error("Unknown function.");
        }
    }

    function evaluateRange(startRef, endRef, stack, cache) {
        const start = parseCellReference(startRef);
        const end = parseCellReference(endRef);
        if (!start || !end) {
            throw new Error("Invalid range.");
        }

        const values = [];
        const startRow = Math.min(start.row, end.row);
        const endRow = Math.max(start.row, end.row);
        const startCol = Math.min(start.col, end.col);
        const endCol = Math.max(start.col, end.col);

        for (let row = startRow; row <= endRow; row += 1) {
            for (let col = startCol; col <= endCol; col += 1) {
                values.push(evaluateCell(row, col, stack, cache));
            }
        }

        return values;
    }

    function evaluateFormulaNode(node, stack, cache) {
        switch (node.type) {
            case "number":
                return node.value;
            case "ref": {
                const reference = parseCellReference(node.ref);
                if (!reference) {
                    throw new Error("Invalid cell reference.");
                }
                return evaluateCell(reference.row, reference.col, stack, cache);
            }
            case "range":
                return evaluateRange(node.start, node.end, stack, cache);
            case "call":
                return evaluateFunction(node.name, node.args, stack, cache);
            case "unary": {
                const value = numericValue(evaluateFormulaNode(node.argument, stack, cache)) ?? 0;
                return node.operator === "-" ? -value : value;
            }
            case "binary": {
                const left = numericValue(evaluateFormulaNode(node.left, stack, cache)) ?? 0;
                const right = numericValue(evaluateFormulaNode(node.right, stack, cache)) ?? 0;
                switch (node.operator) {
                    case "+":
                        return left + right;
                    case "-":
                        return left - right;
                    case "*":
                        return left * right;
                    case "/":
                        return right === 0 ? formulaError : left / right;
                    default:
                        throw new Error("Unsupported operator.");
                }
            }
            default:
                throw new Error("Unsupported expression.");
        }
    }

    function evaluateCell(row, col, stack = new Set(), cache = new Map()) {
        const key = cellKey(row, col);
        if (cache.has(key)) {
            return cache.get(key);
        }

        if (stack.has(key)) {
            cache.set(key, formulaCycle);
            return formulaCycle;
        }

        stack.add(key);
        const rawValue = getRawCellValue(row, col);
        const trimmed = String(rawValue ?? "").trim();
        let result = rawValue;

        if (trimmed.startsWith("=")) {
            try {
                const ast = parseFormula(trimmed.slice(1));
                result = evaluateFormulaNode(ast, stack, cache);
                if (Array.isArray(result)) {
                    result = formulaError;
                }
            } catch (error) {
                result = formulaError;
            }
        }

        stack.delete(key);
        cache.set(key, result);
        return result;
    }

    function refreshComputedCells() {
        const cache = new Map();
        state.computed = state.cells.map((row, rowIndex) =>
            row.map((_, colIndex) => evaluateCell(rowIndex, colIndex, new Set(), cache))
        );
    }

    function displayedCellValue(row, col, editing = false) {
        if (editing) {
            return getRawCellValue(row, col);
        }
        return formatDisplayValue(state.computed[row]?.[col] ?? "");
    }

    function updateVisibleCells() {
        sheetGrid.querySelectorAll(".sheet-cell").forEach((input) => {
            const row = Number(input.dataset.row);
            const col = Number(input.dataset.col);
            if (document.activeElement === input) {
                input.value = displayedCellValue(row, col, true);
                return;
            }
            input.value = displayedCellValue(row, col, false);
        });
    }

    function refreshStats() {
        if (!state.engine) {
            return;
        }

        const stats = state.engine.computeStats(state.computed);
        filledNode.textContent = String(stats.filled);
        numericNode.textContent = String(stats.numeric);
        sumNode.textContent = String(stats.sum);
    }

    function updateInspector() {
        const rawValue = getRawCellValue(state.active.row, state.active.col);
        const computedValue = state.computed[state.active.row]?.[state.active.col] ?? "";
        const label = `${columnLabel(state.active.col)}${state.active.row + 1}`;

        activeCellLabel.textContent = label;
        activeSummaryNode.textContent = label;
        activeValueNode.textContent = describeCell(rawValue, computedValue);
        formulaBar.value = rawValue;
        toolLabelNode.textContent = toolTitles[state.tool] || "Ready";
        visualModeLabelNode.textContent = visualModeDescriptions[state.visualMode] || visualModeDescriptions.neon;
        rendererKindNode.textContent = state.engine?.mode || "Loading";
    }

    function setTool(tool) {
        state.tool = tool;
        toolButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.tool === tool);
        });
        toolLabelNode.textContent = toolTitles[tool] || "Ready";
        requestGraphicsRender();
    }

    function setRibbonTab(tab) {
        state.ribbonTab = tab;
        ribbonTabButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.ribbonTab === tab);
        });
        ribbonPanels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.dataset.ribbonPanel === tab);
        });
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

    function selectCell(row, col) {
        state.active = { row, col };
        updateInspector();
        updateCellHighlights();
        updateVisibleCells();
        requestGraphicsRender();
    }

    function focusCell(row, col) {
        const input = sheetGrid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        input?.focus();
        input?.select();
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

    function commitCellValue(row, col, rawValue, keepEditing = false) {
        state.cells[row][col] = rawValue;
        refreshComputedCells();
        updateInspector();
        updateCellHighlights();
        updateVisibleCells();
        scheduleSave();
        refreshStats();
        requestGraphicsRender();

        if (keepEditing) {
            const activeInput = sheetGrid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (activeInput) {
                activeInput.value = rawValue;
            }
        }
    }

    function appendRow() {
        state.cells.push(Array.from({ length: state.cells[0].length }, () => ""));
        renderGrid();
        scheduleSave();
        setSaveState("Row added.");
    }

    function appendColumn() {
        state.cells.forEach((row) => row.push(""));
        renderGrid();
        scheduleSave();
        setSaveState("Column added.");
    }

    function recalculateSheet() {
        refreshComputedCells();
        updateInspector();
        updateCellHighlights();
        updateVisibleCells();
        refreshStats();
        requestGraphicsRender();
        setSaveState("Sheet recalculated.");
    }

    function renderGrid() {
        refreshComputedCells();

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

            row.forEach((_, colIndex) => {
                const td = document.createElement("td");
                const input = document.createElement("input");
                input.className = "sheet-cell";
                input.value = displayedCellValue(rowIndex, colIndex, false);
                input.dataset.row = String(rowIndex);
                input.dataset.col = String(colIndex);

                input.addEventListener("focus", () => {
                    selectCell(rowIndex, colIndex);
                    input.value = displayedCellValue(rowIndex, colIndex, true);
                    input.select();
                });

                input.addEventListener("blur", () => {
                    input.value = displayedCellValue(rowIndex, colIndex, false);
                });

                input.addEventListener("input", (event) => {
                    commitCellValue(rowIndex, colIndex, event.target.value, true);
                    if (state.active.row === rowIndex && state.active.col === colIndex) {
                        formulaBar.value = event.target.value;
                    }
                });

                input.addEventListener("keydown", (event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        input.blur();
                        focusCell(Math.min(rowIndex + 1, state.cells.length - 1), colIndex);
                    }

                    if (event.key === "Tab") {
                        event.preventDefault();
                        input.blur();
                        focusCell(rowIndex, Math.min(colIndex + 1, state.cells[rowIndex].length - 1));
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
        refreshStats();
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
            setSaveState("Spreadsheet imported.");
        } catch (error) {
            setSaveState(error.message);
        }
    }

    function getVisualModel() {
        if (!state.engine || typeof state.engine.buildVisualModel !== "function") {
            return null;
        }

        return state.engine.buildVisualModel(state.computed, state.active, state.visualMode);
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
        gradient.addColorStop(0, "rgba(26, 115, 232, 0.05)");
        gradient.addColorStop(1, "rgba(208, 227, 255, 0.18)");
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

            let fill = `rgba(26, 115, 232, ${0.08 + cell.intensity * 0.22})`;
            if (state.visualMode === "heatmap") {
                fill = `rgba(66, 133, 244, ${0.12 + cell.intensity * 0.22})`;
            }
            if (state.visualMode === "focus") {
                fill = `rgba(26, 115, 232, ${0.05 + cell.intensity * 0.18})`;
            }

            roundedRect(ctx, x, y, width, height, 6);
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
            ctx.shadowBlur = 14;
            ctx.shadowColor = "rgba(26, 115, 232, 0.18)";
            roundedRect(ctx, x - 1, y - 1, width + 2, height + 2, 7);
            ctx.strokeStyle = state.swatch;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
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

    function defaultFormulaRange(action) {
        const activeColumn = columnLabel(state.active.col);
        if (state.active.row > 0) {
            return `=${action}(${activeColumn}1:${activeColumn}${state.active.row})`;
        }
        return `=${action}()`;
    }

    function insertFormula(action) {
        const template = defaultFormulaRange(action);
        commitCellValue(state.active.row, state.active.col, template, true);
        formulaBar.focus();
        formulaBar.value = template;
        const cursorPosition = template.endsWith("()") ? template.length - 1 : template.length;
        formulaBar.setSelectionRange(cursorPosition, cursorPosition);
    }

    formulaBar?.addEventListener("input", (event) => {
        const { row, col } = state.active;
        commitCellValue(row, col, event.target.value, true);
    });

    formulaBar?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            focusCell(state.active.row, state.active.col);
        }
    });

    importInput?.addEventListener("change", (event) => {
        const [file] = event.target.files || [];
        if (file) {
            importSheet(file);
        }
        event.target.value = "";
    });

    addRowButton?.addEventListener("click", () => {
        appendRow();
    });

    addColumnButton?.addEventListener("click", () => {
        appendColumn();
    });

    ribbonTabButtons.forEach((button) => {
        button.addEventListener("click", () => {
            setRibbonTab(button.dataset.ribbonTab);
        });
    });

    toolButtons.forEach((button) => {
        button.addEventListener("click", () => setTool(button.dataset.tool));
    });

    formulaActionButtons.forEach((button) => {
        button.addEventListener("click", () => {
            insertFormula(button.dataset.formulaAction);
        });
    });

    insertActionButtons.forEach((button) => {
        button.addEventListener("click", () => {
            if (button.dataset.insertAction === "row") {
                appendRow();
                return;
            }
            if (button.dataset.insertAction === "column") {
                appendColumn();
            }
        });
    });

    dataActionButtons.forEach((button) => {
        button.addEventListener("click", () => {
            if (button.dataset.dataAction === "open") {
                importInput?.click();
                return;
            }
            if (button.dataset.dataAction === "recalc") {
                recalculateSheet();
            }
        });
    });

    reviewActionButtons.forEach((button) => {
        button.addEventListener("click", () => {
            if (button.dataset.reviewAction === "note") {
                setTool("comment");
                return;
            }
            if (button.dataset.reviewAction === "help") {
                setSaveState("Formula help: =SUM(A1:A3), =A3-A1, =AVERAGE(A1:A3), =PRODUCT(A1:A3)");
                formulaBar.focus();
            }
        });
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

    Promise.resolve(window.initSheetTools ? window.initSheetTools() : null).then((engine) => {
        if (!engine) {
            return;
        }
        state.engine = engine;
        engineModeNode.textContent = engine.mode;
        rendererKindNode.textContent = engine.mode;
        refreshStats();
        updateInspector();
        requestGraphicsRender();
    });

    refreshComputedCells();
    setRibbonTab(state.ribbonTab);
    setTool(state.tool);
    setVisualMode(state.visualMode);
    setZoom(state.zoom);
    renderGrid();
}
