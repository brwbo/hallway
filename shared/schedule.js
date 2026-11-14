export function buildCsv(rows) {
  const columns = ["company", "candidate", "decision", "decided_by", "decided_at", "talked", "outcome", "note"];
  const cell = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.join(","), ...rows.map((row) => columns.map((c) => cell(row[c])).join(","))].join("\n") + "\n";
}
