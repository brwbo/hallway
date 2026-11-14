export const DAY = { start: 10 * 60, end: 16 * 60, slot: 15, breaks: [[12 * 60, 13 * 60]] };

const blocked = (start) => DAY.breaks.some(([a, b]) => start < b && start + DAY.slot > a);

export function clock(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function boothOf(companyId, companies) {
  const index = companies.findIndex((c) => c.id === companyId);
  if (index < 0) return companies.length + 1;
  return (Number.isInteger(companies[index].slot) ? companies[index].slot : index) + 1;
}

export function buildSchedule(accepted, companies) {
  const busyCompany = new Map();
  const busyPerson = new Map();
  const slotsOf = (map, id) => { if (!map.has(id)) map.set(id, new Set()); return map.get(id); };
  const items = [...accepted]
    .sort((a, b) => String(a.at).localeCompare(String(b.at)))
    .map((entry) => {
      const company = slotsOf(busyCompany, entry.company_id);
      const person = slotsOf(busyPerson, entry.candidate_id);
      let start = null;
      for (let s = DAY.start; s + DAY.slot <= DAY.end; s += DAY.slot) {
        if (blocked(s) || company.has(s) || person.has(s)) continue;
        start = s;
        break;
      }
      if (start !== null) { company.add(start); person.add(start); }
      return { ...entry, start, end: start === null ? null : start + DAY.slot, booth: boothOf(entry.company_id, companies) };
    });
  return items.sort((a, b) => (a.start ?? 1e9) - (b.start ?? 1e9));
}

const escapeText = (text) => String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function buildIcs(items, { date, place = "Hype Arena, Espoo" }) {
  const day = String(date).replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const stampValue = stamp.endsWith("Z") ? stamp : `${stamp}Z`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hallway//Demo//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  items.filter((i) => i.start !== null).forEach((i) => {
    const at = (m) => `${day}T${String(Math.floor(m / 60)).padStart(2, "0")}${String(m % 60).padStart(2, "0")}00`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${i.id}@hallway-demo`,
      `DTSTAMP:${stampValue}`,
      `DTSTART:${at(i.start)}`,
      `DTEND:${at(i.end)}`,
      `SUMMARY:${escapeText(i.title)}`,
      `LOCATION:${escapeText(`${place}, booth ${i.booth}`)}`,
      `DESCRIPTION:${escapeText(i.description || "")}`,
      "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function buildCsv(rows) {
  const columns = ["company", "candidate", "decision", "decided_by", "decided_at", "time", "booth", "talked", "outcome", "note"];
  const cell = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.join(","), ...rows.map((row) => columns.map((c) => cell(row[c])).join(","))].join("\n") + "\n";
}
