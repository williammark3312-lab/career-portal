"use client";

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Download, Copy, Check, Share2, Plus, Trash2,
  FileSpreadsheet, Table, Sparkles, RefreshCw,
  Printer, X, ArrowUpRight, FileText, Rocket, UserMinus, ListTodo, Users
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface ExcelReportViewerProps {
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
    priority: string;
    status: string;
    reminder?: string;
    created_at: string;
  }>;
  onboardingList: Array<{
    id: string;
    name: string;
    role: string;
    department: string;
    joining_date: string;
    status: string;
    buddy_or_hr?: string;
    notes?: string;
    created_at: string;
  }>;
  fnfList: Array<{
    id: string;
    name: string;
    department: string;
    last_working_day: string;
    status: string;
    settlement_amount?: string;
    notes?: string;
    created_at: string;
  }>;
  jobs?: Array<{
    id: string;
    title: string;
    department: string;
    location: string;
  }>;
  cvs?: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    status: string;
    created_at: string;
  }>;
}

export default function ExcelReportViewer({
  tasks,
  onboardingList,
  fnfList,
  jobs = [],
  cvs = [],
}: ExcelReportViewerProps) {
  const [reportTitle, setReportTitle] = useState("Work_Panel_Report");
  const [headers, setHeaders] = useState<string[]>(["ID", "Name / Title", "Category / Dept", "Status / Stage", "Date", "Notes / Details"]);
  const [rows, setRows] = useState<string[][]>([
    ["1", "Sample Record", "Operations", "Active", new Date().toISOString().slice(0, 10), "Initial record"],
  ]);

  const [activeTemplate, setActiveTemplate] = useState<"custom" | "onboarding" | "fnf" | "tasks" | "recruitment">("onboarding");
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Generate template data
  function loadOnboardingReport() {
    setActiveTemplate("onboarding");
    setReportTitle(`Onboarding_Report_${new Date().toISOString().slice(0, 10)}`);
    setHeaders(["Candidate Name", "Role", "Department", "Joining Date", "Current Stage", "Assigned HR", "Checklist / Notes"]);
    if (onboardingList.length === 0) {
      setRows([["No candidates currently in onboarding", "-", "-", "-", "-", "-", "-"]]);
      return;
    }
    const stageLabels: Record<string, string> = {
      offer_sent: "Offer Sent",
      doc_verification: "Doc Verification",
      it_setup: "IT Setup",
      induction: "Induction",
      completed: "Onboarded",
    };
    setRows(
      onboardingList.map((item) => [
        item.name,
        item.role,
        item.department,
        item.joining_date,
        stageLabels[item.status] || item.status,
        item.buddy_or_hr || "Unassigned",
        item.notes || "",
      ])
    );
  }

  function loadFnFReport() {
    setActiveTemplate("fnf");
    setReportTitle(`FnF_Settlement_Report_${new Date().toISOString().slice(0, 10)}`);
    setHeaders(["Employee Name", "Department", "Last Working Day", "Clearance Status", "Settlement Amount", "Exit Notes"]);
    if (fnfList.length === 0) {
      setRows([["No FnF records currently", "-", "-", "-", "-", "-"]]);
      return;
    }
    const statusLabels: Record<string, string> = {
      resigned: "Resigned / Notice",
      clearance_pending: "Clearance Pending",
      assets_collected: "Assets Collected",
      fnf_calculation: "FnF Calculation",
      settled: "Settled & Closed",
    };
    setRows(
      fnfList.map((item) => [
        item.name,
        item.department,
        item.last_working_day,
        statusLabels[item.status] || item.status,
        item.settlement_amount || "Pending",
        item.notes || "",
      ])
    );
  }

  function loadTasksReport() {
    setActiveTemplate("tasks");
    setReportTitle(`Tasks_Performance_Report_${new Date().toISOString().slice(0, 10)}`);
    setHeaders(["Task Title", "Priority", "Status", "Reminder Time", "Created Date", "Description"]);
    if (tasks.length === 0) {
      setRows([["No tasks currently", "-", "-", "-", "-", "-"]]);
      return;
    }
    setRows(
      tasks.map((task) => [
        task.title,
        task.priority.toUpperCase(),
        task.status.toUpperCase(),
        task.reminder ? new Date(task.reminder).toLocaleString("en-IN") : "None",
        new Date(task.created_at).toLocaleDateString("en-IN"),
        task.description || "",
      ])
    );
  }

  function loadRecruitmentReport() {
    setActiveTemplate("recruitment");
    setReportTitle(`Recruitment_Pipeline_Report_${new Date().toISOString().slice(0, 10)}`);
    setHeaders(["Candidate Name", "Email", "Phone", "Screening Status", "Application Date"]);
    if (cvs.length === 0) {
      setRows([["No candidate applications found", "-", "-", "-", "-"]]);
      return;
    }
    setRows(
      cvs.map((cv) => [
        cv.name,
        cv.email,
        cv.phone || "-",
        cv.status,
        new Date(cv.created_at).toLocaleDateString("en-IN"),
      ])
    );
  }

  function loadBlankSheet() {
    setActiveTemplate("custom");
    setReportTitle("Custom_Spreadsheet");
    setHeaders(["Column A", "Column B", "Column C", "Column D"]);
    setRows([
      ["", "", "", ""],
      ["", "", "", ""],
      ["", "", "", ""],
    ]);
  }

  // Load Onboarding by default on mount if available, else Tasks
  useEffect(() => {
    if (onboardingList.length > 0) {
      loadOnboardingReport();
    } else if (tasks.length > 0) {
      loadTasksReport();
    } else {
      loadOnboardingReport();
    }
  }, []);

  // Cell editing
  function updateCell(rowIndex: number, colIndex: number, value: string) {
    setRows((prev) => {
      const copy = prev.map((r) => [...r]);
      if (copy[rowIndex]) {
        copy[rowIndex][colIndex] = value;
      }
      return copy;
    });
  }

  function updateHeader(colIndex: number, value: string) {
    setHeaders((prev) => {
      const copy = [...prev];
      copy[colIndex] = value;
      return copy;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, new Array(headers.length).fill("")]);
  }

  function deleteRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addColumn() {
    setHeaders((prev) => [...prev, `Column ${String.fromCharCode(65 + prev.length)}`]);
    setRows((prev) => prev.map((r) => [...r, ""]));
  }

  function deleteColumn(colIndex: number) {
    if (headers.length <= 1) return;
    setHeaders((prev) => prev.filter((_, i) => i !== colIndex));
    setRows((prev) => prev.map((r) => r.filter((_, i) => i !== colIndex)));
  }

  // Export to Excel (.xlsx) using SheetJS
  function exportToExcel() {
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-fit column widths
    const colWidths = headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...rows.map((r) => (r[i] ? String(r[i]).length : 0))
      );
      return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
    });
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${reportTitle.replace(/\s+/g, "_")}.xlsx`);
  }

  // Export to CSV
  function exportToCSV() {
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportTitle.replace(/\s+/g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Copy as TSV (Tab Separated) for pasting directly into Excel or Google Sheets
  function copyForExcel() {
    const tableText = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
    navigator.clipboard.writeText(tableText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // Generate markdown format for sharing
  function getMarkdownTable() {
    const mdHeader = `| ${headers.join(" | ")} |`;
    const mdDivider = `| ${headers.map(() => "---").join(" | ")} |`;
    const mdRows = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
    return `### 📊 ${reportTitle.replace(/_/g, " ")}\n*Generated on ${new Date().toLocaleString("en-IN")}*\n\n${mdHeader}\n${mdDivider}\n${mdRows}`;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Top Template Switcher ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-zinc-950/60 border border-zinc-900 rounded-2xl p-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={loadOnboardingReport}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTemplate === "onboarding"
                ? "bg-indigo-950/60 border border-indigo-800/80 text-indigo-200 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
            }`}
          >
            <Rocket className="w-3.5 h-3.5 text-indigo-400" />
            Onboarding Sheet
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400 font-mono">
              {onboardingList.length}
            </span>
          </button>

          <button
            onClick={loadFnFReport}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTemplate === "fnf"
                ? "bg-amber-950/60 border border-amber-800/80 text-amber-200 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
            }`}
          >
            <UserMinus className="w-3.5 h-3.5 text-amber-400" />
            FnF Settlement Sheet
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400 font-mono">
              {fnfList.length}
            </span>
          </button>

          <button
            onClick={loadTasksReport}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTemplate === "tasks"
                ? "bg-blue-950/60 border border-blue-800/80 text-blue-200 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
            }`}
          >
            <ListTodo className="w-3.5 h-3.5 text-blue-400" />
            Tasks Sheet
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400 font-mono">
              {tasks.length}
            </span>
          </button>

          <button
            onClick={loadRecruitmentReport}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTemplate === "recruitment"
                ? "bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            Applicants Funnel
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400 font-mono">
              {cvs.length}
            </span>
          </button>

          <button
            onClick={loadBlankSheet}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTemplate === "custom"
                ? "bg-zinc-800 text-white shadow-sm border border-zinc-700"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Blank Grid
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={copyForExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Copy formatted table to paste directly into Microsoft Excel or Google Sheets"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied for Excel!" : "Copy Table"}
          </button>

          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-400" /> Share Report
          </button>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 transition-all cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export .XLSX
          </button>
        </div>
      </div>

      {/* ─── Excel Title & Structure Controls ─── */}
      <div className="flex items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-2 flex-1">
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <input
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            className="bg-transparent border-b border-transparent hover:border-zinc-800 focus:border-zinc-600 outline-none text-sm font-bold text-white px-1 py-0.5 transition-colors"
            placeholder="Report Title..."
          />
          <span className="text-[11px] text-zinc-500 font-medium">
            ({rows.length} rows, {headers.length} columns)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={addRow}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Add Row
          </button>
          <button
            onClick={addColumn}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Add Column
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer"
            title="Download CSV"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>

      {/* ─── In-Built Excel Spreadsheet Grid ─── */}
      <div className="border border-zinc-850 rounded-2xl bg-zinc-950/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            {/* Column Letter Indexing Header (Excel Style: A, B, C...) */}
            <thead>
              <tr className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-500 text-[10px] select-none">
                <th className="w-12 px-3 py-2 text-center border-r border-zinc-800/80 font-bold">#</th>
                {headers.map((_, colIdx) => (
                  <th key={colIdx} className="px-3 py-1.5 border-r border-zinc-800/80 text-center font-bold tracking-wider">
                    {String.fromCharCode(65 + colIdx)}
                  </th>
                ))}
                <th className="w-10 px-2 py-1 text-center font-bold">Del</th>
              </tr>

              {/* Column Name Row */}
              <tr className="bg-zinc-900/60 border-b border-zinc-800 text-zinc-200">
                <th className="w-12 px-3 py-2.5 text-center border-r border-zinc-800 text-zinc-600 font-bold">
                  Col
                </th>
                {headers.map((header, colIdx) => (
                  <th key={colIdx} className="px-2 py-1.5 border-r border-zinc-800 min-w-[140px]">
                    <div className="flex items-center gap-1">
                      <input
                        value={header}
                        onChange={(e) => updateHeader(colIdx, e.target.value)}
                        className="w-full bg-transparent font-bold text-white text-xs outline-none px-1.5 py-1 rounded hover:bg-zinc-800/50 focus:bg-zinc-800 focus:text-white transition-colors"
                      />
                      {headers.length > 1 && (
                        <button
                          onClick={() => deleteColumn(colIdx)}
                          className="text-zinc-600 hover:text-rose-400 p-0.5 rounded cursor-pointer opacity-40 hover:opacity-100"
                          title="Delete column"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-10"></th>
              </tr>
            </thead>

            {/* Editable Data Rows */}
            <tbody className="divide-y divide-zinc-900">
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-zinc-900/40 transition-colors group">
                  {/* Row Number (1, 2, 3...) */}
                  <td className="w-12 px-3 py-2 text-center border-r border-zinc-900 text-zinc-600 font-bold select-none bg-zinc-950/40">
                    {rowIdx + 1}
                  </td>

                  {/* Cell Inputs */}
                  {headers.map((_, colIdx) => (
                    <td key={colIdx} className="p-0 border-r border-zinc-900 min-w-[140px]">
                      <input
                        value={row[colIdx] || ""}
                        onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                        className="w-full px-3 py-2 bg-transparent text-zinc-200 text-xs outline-none focus:bg-indigo-950/30 focus:text-white transition-colors placeholder-zinc-700"
                        placeholder="—"
                      />
                    </td>
                  ))}

                  {/* Delete Row Button */}
                  <td className="w-10 text-center p-1">
                    <button
                      onClick={() => deleteRow(rowIdx)}
                      className="p-1 text-zinc-700 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Delete row"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer Stats */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/60 border-t border-zinc-800 text-[11px] text-zinc-500 font-sans">
          <span>Excel Sheet Ready · Live editable cells</span>
          <div className="flex items-center gap-3">
            <span>Total Records: <strong className="text-zinc-300">{rows.length}</strong></span>
            <span>Columns: <strong className="text-zinc-300">{headers.length}</strong></span>
          </div>
        </div>
      </div>

      {/* ─── Share / Summary Modal ─── */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
              onClick={() => setShowShareModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-[28px] p-7 shadow-2xl flex flex-col gap-5 z-10 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-indigo-400" />
                    Share Generated Report
                  </h2>
                  <p className="text-xs text-zinc-500 font-semibold">
                    Copy formatted report text to share via Email, Slack, Microsoft Teams, or WhatsApp.
                  </p>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Preview Box */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Formatted Markdown / Text Preview
                </label>
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 max-h-[260px] overflow-y-auto font-mono text-xs text-zinc-300 whitespace-pre leading-relaxed">
                  {getMarkdownTable()}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getMarkdownTable());
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  }}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied to Clipboard!" : "Copy Formatted Report"}
                </button>

                <button
                  onClick={() => {
                    exportToExcel();
                    setShowShareModal(false);
                  }}
                  className="py-3 px-5 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-950/50 border border-emerald-800 hover:bg-emerald-900/50 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Download .XLSX
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
