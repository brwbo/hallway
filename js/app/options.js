export const LEVELS = [["entry", "Just starting out"], ["some", "Some experience"], ["experienced", "Experienced"]];
export const MODES = [["onsite", "On site"], ["hybrid", "Hybrid"], ["remote", "Remote"]];
export const LANGS = ["English", "Finnish", "Swedish"];
export const SUPPORT = ["Relocation help", "Work permit guidance", "Finnish language lessons", "An onboarding buddy"];
export const MAX_TASKS = 5;
export const MAX_SKILLS = 8;
export const MAX_QUESTIONS = 3;

export const labelOf = (list, value) => (list.find(([v]) => v === value) || [])[1] || "";

export const GUIDE_LINKS = [
  { label: "Finnish Immigration Service (Migri)", note: "Residence and work permits.", href: "https://migri.fi/en/" },
  { label: "Job Market Finland", note: "Open jobs and services for jobseekers.", href: "https://tyomarkkinatori.fi/en" },
  { label: "Business Espoo", note: "Free recruitment help for companies in Espoo.", href: "https://www.businessespoo.com/" }
];
