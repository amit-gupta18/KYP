export function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function formatWhen(iso) {
  if (!iso) return { relative: "", full: "" };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { relative: "", full: "" };
  const full = `${new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)} IST`;
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  let relative = full;
  if (minutes < 1) relative = "Just now";
  else if (minutes < 60) relative = `${minutes} min ago`;
  else if (minutes < 60 * 24) relative = `${Math.round(minutes / 60)} hr ago`;
  else if (minutes < 60 * 24 * 7) relative = `${Math.round(minutes / 1440)} days ago`;
  return { relative, full };
}

export function fileKind(filename = "") {
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  if (extension === "pdf") return "PDF";
  if (extension === "docx") return "DOCX";
  if (extension === "md" || extension === "markdown") return "MD";
  if (extension === "txt") return "TXT";
  return extension.toUpperCase() || "FILE";
}

export const SUGGESTED_QUESTIONS = [
  "How many annual leave days do employees get?",
  "What is the hotel cap for travel?",
  "How do I raise a workplace concern?",
  "How long are customer support tickets kept?",
];
