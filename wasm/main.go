package main

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"
	"syscall/js"
)

func sheetToolStats(this js.Value, args []js.Value) any {
	if len(args) == 0 {
		return js.ValueOf(`{"filled":0,"numeric":0,"sum":0,"maxColumns":0}`)
	}

	var cells [][]string
	if err := json.Unmarshal([]byte(args[0].String()), &cells); err != nil {
		return js.ValueOf(`{"filled":0,"numeric":0,"sum":0,"maxColumns":0}`)
	}

	filled := 0
	numeric := 0
	sum := 0.0
	maxColumns := 0

	for _, row := range cells {
		if len(row) > maxColumns {
			maxColumns = len(row)
		}

		for _, cell := range row {
			value := strings.TrimSpace(cell)
			if value == "" {
				continue
			}

			filled++
			if number, err := strconv.ParseFloat(value, 64); err == nil && !math.IsNaN(number) {
				numeric++
				sum += number
			}
		}
	}

	response, _ := json.Marshal(map[string]any{
		"filled":     filled,
		"numeric":    numeric,
		"sum":        math.Round(sum*100) / 100,
		"maxColumns": maxColumns,
	})

	return js.ValueOf(string(response))
}

func main() {
	done := make(chan struct{}, 0)
	js.Global().Set("sheetToolStats", js.FuncOf(sheetToolStats))
	<-done
}
