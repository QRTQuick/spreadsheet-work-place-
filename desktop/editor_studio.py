from __future__ import annotations

import csv
import sys
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QAction, QColor, QFont
from PySide6.QtWidgets import (
    QApplication,
    QDockWidget,
    QFileDialog,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSizePolicy,
    QTableWidget,
    QTableWidgetItem,
    QToolBar,
    QVBoxLayout,
    QWidget,
)


class SpreadsheetStudio(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("электронная таблица Studio")
        self.resize(1480, 920)

        self.table = QTableWidget(24, 12)
        self.table.setAlternatingRowColors(True)
        self.table.setHorizontalHeaderLabels([self.column_label(index) for index in range(self.table.columnCount())])
        self.table.verticalHeader().setDefaultSectionSize(34)
        self.table.horizontalHeader().setDefaultSectionSize(140)
        self.table.currentCellChanged.connect(self.on_current_cell_changed)
        self.table.itemChanged.connect(self.on_item_changed)

        self.formula_bar = QLineEdit()
        self.formula_bar.setPlaceholderText("Type a value or formula-like text")
        self.formula_bar.returnPressed.connect(self.commit_formula)

        self.active_cell_label = QLabel("A1")
        self.active_value_label = QLabel("Empty cell")
        self.renderer_label = QLabel("PySide6 desktop studio")
        self.zoom_label = QLabel("100%")
        self.visual_label = QLabel("Neon Studio")
        self._suspend_formula_sync = False

        self.setup_toolbar()
        self.setup_central()
        self.setup_left_dock()
        self.setup_right_dock()
        self.apply_theme()
        self.seed_sample_data()
        self.on_current_cell_changed(0, 0, -1, -1)

    def setup_toolbar(self) -> None:
        toolbar = QToolBar("Main")
        toolbar.setMovable(False)
        self.addToolBar(toolbar)

        import_action = QAction("Import CSV", self)
        import_action.triggered.connect(self.import_csv)
        toolbar.addAction(import_action)

        export_action = QAction("Export CSV", self)
        export_action.triggered.connect(self.export_csv)
        toolbar.addAction(export_action)

        add_row_action = QAction("Add Row", self)
        add_row_action.triggered.connect(self.add_row)
        toolbar.addAction(add_row_action)

        add_column_action = QAction("Add Column", self)
        add_column_action.triggered.connect(self.add_column)
        toolbar.addAction(add_column_action)

    def setup_central(self) -> None:
        shell = QWidget()
        layout = QVBoxLayout(shell)
        layout.setContentsMargins(18, 18, 18, 18)
        layout.setSpacing(14)

        hero = QFrame()
        hero_layout = QHBoxLayout(hero)
        hero_layout.setContentsMargins(18, 18, 18, 18)
        hero_layout.setSpacing(18)

        title_wrap = QVBoxLayout()
        eyebrow = QLabel("Creative Spreadsheet Studio")
        eyebrow.setObjectName("eyebrow")
        title = QLabel("Photoshop-inspired spreadsheet editor shell")
        title.setObjectName("heroTitle")
        subtitle = QLabel(
            "This native PySide6 view is a desktop companion for richer editor experiments, "
            "separate from the Vercel-hosted web app."
        )
        subtitle.setWordWrap(True)
        subtitle.setObjectName("heroText")
        title_wrap.addWidget(eyebrow)
        title_wrap.addWidget(title)
        title_wrap.addWidget(subtitle)

        metrics_wrap = QHBoxLayout()
        for label, value in [("Rows", "24"), ("Columns", "12"), ("Mode", "Studio")]:
            card = QFrame()
            card.setObjectName("metricCard")
            card_layout = QVBoxLayout(card)
            metric_value = QLabel(value)
            metric_value.setObjectName("metricValue")
            metric_label = QLabel(label)
            metric_label.setObjectName("metricLabel")
            card_layout.addWidget(metric_value)
            card_layout.addWidget(metric_label)
            metrics_wrap.addWidget(card)

        hero_layout.addLayout(title_wrap, 2)
        hero_layout.addLayout(metrics_wrap, 1)

        formula_wrap = QHBoxLayout()
        formula_wrap.setSpacing(10)
        self.active_cell_label.setObjectName("activeCell")
        formula_wrap.addWidget(self.active_cell_label)
        formula_wrap.addWidget(self.formula_bar, 1)

        layout.addWidget(hero)
        layout.addLayout(formula_wrap)
        layout.addWidget(self.table, 1)
        self.setCentralWidget(shell)

    def setup_left_dock(self) -> None:
        dock = QDockWidget("Tools", self)
        dock.setFeatures(QDockWidget.NoDockWidgetFeatures)

        tool_list = QListWidget()
        for tool in ["Select", "Draw", "Focus", "Comment"]:
            QListWidgetItem(tool, tool_list)
        tool_list.setCurrentRow(0)

        dock.setWidget(tool_list)
        self.addDockWidget(Qt.LeftDockWidgetArea, dock)

    def setup_right_dock(self) -> None:
        dock = QDockWidget("Inspector", self)
        dock.setFeatures(QDockWidget.NoDockWidgetFeatures)

        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        layout.addWidget(self.inspector_card("Active Value", self.active_value_label))
        layout.addWidget(self.inspector_card("Renderer", self.renderer_label))
        layout.addWidget(self.inspector_card("Zoom", self.zoom_label))
        layout.addWidget(self.inspector_card("Visual Mode", self.visual_label))

        spacer = QWidget()
        spacer.setSizePolicy(QSizePolicy.Preferred, QSizePolicy.Expanding)
        layout.addWidget(spacer)

        action_row = QHBoxLayout()
        add_row_button = QPushButton("Add Row")
        add_row_button.clicked.connect(self.add_row)
        add_col_button = QPushButton("Add Column")
        add_col_button.clicked.connect(self.add_column)
        action_row.addWidget(add_row_button)
        action_row.addWidget(add_col_button)
        layout.addLayout(action_row)

        dock.setWidget(panel)
        self.addDockWidget(Qt.RightDockWidgetArea, dock)

    def inspector_card(self, title: str, value_label: QLabel) -> QFrame:
        card = QFrame()
        card.setObjectName("inspectorCard")
        layout = QVBoxLayout(card)
        title_label = QLabel(title)
        title_label.setObjectName("inspectorTitle")
        value_label.setWordWrap(True)
        value_label.setObjectName("inspectorValue")
        layout.addWidget(title_label)
        layout.addWidget(value_label)
        return card

    def apply_theme(self) -> None:
        self.setStyleSheet(
            """
            QMainWindow {
                background: #08111c;
                color: #eff6ff;
            }
            QToolBar {
                spacing: 10px;
                padding: 10px 18px;
                background: rgba(11, 20, 36, 0.95);
                border: 0;
                border-bottom: 1px solid rgba(148, 180, 214, 0.14);
            }
            QToolButton, QPushButton {
                background: rgba(255, 255, 255, 0.05);
                color: #eff6ff;
                border: 1px solid rgba(148, 180, 214, 0.16);
                border-radius: 14px;
                padding: 10px 14px;
                font-weight: 700;
            }
            QToolButton:hover, QPushButton:hover {
                border-color: rgba(120, 255, 214, 0.36);
            }
            QFrame#metricCard, QFrame#inspectorCard {
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid rgba(148, 180, 214, 0.14);
                border-radius: 20px;
            }
            QDockWidget {
                color: #eff6ff;
                font-weight: 700;
            }
            QDockWidget::title {
                text-align: left;
                padding: 12px 16px;
                background: rgba(11, 20, 36, 0.95);
                border-bottom: 1px solid rgba(148, 180, 214, 0.14);
            }
            QListWidget, QTableWidget, QLineEdit {
                background: rgba(7, 15, 27, 0.96);
                color: #eff6ff;
                border: 1px solid rgba(148, 180, 214, 0.14);
                border-radius: 18px;
                gridline-color: rgba(148, 180, 214, 0.08);
                selection-background-color: rgba(120, 255, 214, 0.18);
            }
            QHeaderView::section {
                background: rgba(8, 17, 31, 0.98);
                color: #78ffd6;
                border: 0;
                border-right: 1px solid rgba(148, 180, 214, 0.08);
                border-bottom: 1px solid rgba(148, 180, 214, 0.08);
                padding: 8px;
                font-weight: 700;
            }
            QLabel#eyebrow {
                color: #78ffd6;
                font-size: 12px;
                letter-spacing: 2px;
                text-transform: uppercase;
            }
            QLabel#heroTitle {
                font-size: 32px;
                font-weight: 800;
            }
            QLabel#heroText, QLabel#metricLabel, QLabel#inspectorTitle {
                color: #96aac4;
            }
            QLabel#metricValue {
                font-size: 26px;
                font-weight: 800;
            }
            QLabel#activeCell {
                min-width: 72px;
                padding: 12px 14px;
                border-radius: 16px;
                background: rgba(120, 255, 214, 0.1);
                color: #78ffd6;
                font-family: 'Consolas';
                font-weight: 800;
            }
            QLabel#inspectorValue {
                font-size: 15px;
                font-weight: 700;
            }
            """
        )
        self.table.setFont(QFont("Segoe UI", 10))

    def seed_sample_data(self) -> None:
        rows = [
            ["Month", "MRR", "Leads", "Owner"],
            ["Jan", "14200", "381", "Ops"],
            ["Feb", "18900", "452", "Growth"],
            ["Mar", "21450", "510", "Sales"],
        ]
        for row_index, row in enumerate(rows):
            for col_index, value in enumerate(row):
                self.table.setItem(row_index, col_index, QTableWidgetItem(value))

    def on_current_cell_changed(self, current_row: int, current_col: int, *_args) -> None:
        if current_row < 0 or current_col < 0:
            return
        self.active_cell_label.setText(f"{self.column_label(current_col)}{current_row + 1}")
        item = self.table.item(current_row, current_col)
        value = item.text() if item else ""
        self._suspend_formula_sync = True
        self.formula_bar.setText(value)
        self._suspend_formula_sync = False
        self.active_value_label.setText(value or "Empty cell")

    def on_item_changed(self, item: QTableWidgetItem) -> None:
        if self._suspend_formula_sync:
            return
        if item.row() == self.table.currentRow() and item.column() == self.table.currentColumn():
            self.active_value_label.setText(item.text() or "Empty cell")

    def commit_formula(self) -> None:
        row = self.table.currentRow()
        col = self.table.currentColumn()
        if row < 0 or col < 0:
            return
        self._suspend_formula_sync = True
        item = self.table.item(row, col) or QTableWidgetItem()
        item.setText(self.formula_bar.text())
        self.table.setItem(row, col, item)
        self._suspend_formula_sync = False
        self.active_value_label.setText(self.formula_bar.text() or "Empty cell")

    def add_row(self) -> None:
        self.table.insertRow(self.table.rowCount())

    def add_column(self) -> None:
        self.table.insertColumn(self.table.columnCount())
        self.table.setHorizontalHeaderItem(
            self.table.columnCount() - 1,
            QTableWidgetItem(self.column_label(self.table.columnCount() - 1)),
        )

    def import_csv(self) -> None:
        path, _ = QFileDialog.getOpenFileName(self, "Import CSV", "", "CSV Files (*.csv)")
        if not path:
            return

        with open(path, "r", encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.reader(handle))

        self.table.setRowCount(max(len(rows), 1))
        self.table.setColumnCount(max((len(row) for row in rows), default=1))
        self.table.setHorizontalHeaderLabels([self.column_label(index) for index in range(self.table.columnCount())])

        for row_index, row in enumerate(rows):
            for col_index, value in enumerate(row):
                self.table.setItem(row_index, col_index, QTableWidgetItem(value))

    def export_csv(self) -> None:
        path, _ = QFileDialog.getSaveFileName(self, "Export CSV", "sheet.csv", "CSV Files (*.csv)")
        if not path:
            return

        output_path = Path(path)
        with output_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            for row_index in range(self.table.rowCount()):
                row = []
                for col_index in range(self.table.columnCount()):
                    item = self.table.item(row_index, col_index)
                    row.append(item.text() if item else "")
                writer.writerow(row)

        QMessageBox.information(self, "Export complete", f"Saved CSV to {output_path}")

    @staticmethod
    def column_label(index: int) -> str:
        current = index
        label = ""
        while current >= 0:
            label = chr(65 + (current % 26)) + label
            current = current // 26 - 1
        return label


def main() -> int:
    app = QApplication(sys.argv)
    window = SpreadsheetStudio()
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
