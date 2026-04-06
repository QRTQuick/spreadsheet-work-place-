use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Stats {
    filled: usize,
    numeric: usize,
    sum: f64,
    max_columns: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HeatCell {
    row: usize,
    col: usize,
    value: f64,
    intensity: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NumericRange {
    min: f64,
    max: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ActiveCell {
    row: usize,
    col: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VisualModel {
    visual_mode: String,
    active: ActiveCell,
    heat_cells: Vec<HeatCell>,
    numeric_range: NumericRange,
}

fn parse_cells(cells_json: &str) -> Vec<Vec<String>> {
    serde_json::from_str::<Vec<Vec<String>>>(cells_json).unwrap_or_default()
}

#[wasm_bindgen]
pub fn compute_stats_json(cells_json: &str) -> String {
    let cells = parse_cells(cells_json);
    let mut filled = 0usize;
    let mut numeric = 0usize;
    let mut sum = 0.0f64;
    let mut max_columns = 0usize;

    for row in &cells {
        if row.len() > max_columns {
            max_columns = row.len();
        }

        for cell in row {
            let trimmed = cell.trim();
            if trimmed.is_empty() {
                continue;
            }

            filled += 1;
            if let Ok(value) = trimmed.parse::<f64>() {
                if value.is_finite() {
                    numeric += 1;
                    sum += value;
                }
            }
        }
    }

    serde_json::to_string(&Stats {
        filled,
        numeric,
        sum: (sum * 100.0).round() / 100.0,
        max_columns,
    })
    .unwrap_or_else(|_| r#"{"filled":0,"numeric":0,"sum":0,"maxColumns":0}"#.to_string())
}

#[wasm_bindgen]
pub fn build_visual_model_json(
    cells_json: &str,
    active_row: usize,
    active_col: usize,
    visual_mode: &str,
) -> String {
    let cells = parse_cells(cells_json);
    let mut numeric_values: Vec<(usize, usize, f64)> = Vec::new();

    for (row_index, row) in cells.iter().enumerate() {
        for (col_index, cell) in row.iter().enumerate() {
            if let Ok(value) = cell.trim().parse::<f64>() {
                if value.is_finite() {
                    numeric_values.push((row_index, col_index, value));
                }
            }
        }
    }

    let (min, max) = if numeric_values.is_empty() {
        (0.0, 1.0)
    } else {
        let min = numeric_values
            .iter()
            .map(|(_, _, value)| *value)
            .fold(f64::INFINITY, f64::min);
        let max = numeric_values
            .iter()
            .map(|(_, _, value)| *value)
            .fold(f64::NEG_INFINITY, f64::max);
        (min, max)
    };

    let range = if (max - min).abs() < f64::EPSILON {
        1.0
    } else {
        max - min
    };

    let heat_cells = numeric_values
        .into_iter()
        .map(|(row, col, value)| HeatCell {
            row,
            col,
            value,
            intensity: ((value - min) / range).clamp(0.0, 1.0),
        })
        .collect::<Vec<_>>();

    serde_json::to_string(&VisualModel {
        visual_mode: visual_mode.to_string(),
        active: ActiveCell {
            row: active_row,
            col: active_col,
        },
        heat_cells,
        numeric_range: NumericRange { min, max },
    })
    .unwrap_or_else(|_| {
        format!(
            r#"{{"visualMode":"{}","active":{{"row":{},"col":{}}},"heatCells":[],"numericRange":{{"min":0,"max":1}}}}"#,
            visual_mode, active_row, active_col
        )
    })
}
