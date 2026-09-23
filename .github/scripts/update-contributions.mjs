import { mkdir, writeFile } from "node:fs/promises";

const GITHUB_USERNAME = "BernardoBrugg";
const GITLAB_USERNAME = "BernardoBrugg";
const OUTPUT = "assets/combined-contributions.svg";

const today = new Date();
const from = new Date(today);
from.setUTCDate(from.getUTCDate() - 364);

const isoDate = (date) => date.toISOString().slice(0, 10);
const years = [...new Set([from.getUTCFullYear(), today.getUTCFullYear()])];
const contributions = new Map();

for (const year of years) {
  const url = new URL("https://commitgraph.mtajchert.com/api/contributions");
  url.searchParams.set("github", GITHUB_USERNAME);
  url.searchParams.set("gitlab", GITLAB_USERNAME);
  url.searchParams.set("year", String(year));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Contribution API returned ${response.status} for ${year}`);
  }

  const payload = await response.json();
  for (const day of payload.days ?? []) {
    const date = day.date;
    const value = Number(day.total ?? 0);
    if (date && date >= isoDate(from) && date <= isoDate(today)) {
      contributions.set(date, Number.isFinite(value) ? value : 0);
    }
  }
}

const start = new Date(from);
start.setUTCDate(start.getUTCDate() - start.getUTCDay());

const end = new Date(today);
end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

const dayCount = Math.round((end - start) / 86400000) + 1;
const weeks = Math.ceil(dayCount / 7);
const cell = 11;
const gap = 3;
const step = cell + gap;
const left = 42;
const top = 24;
const width = left + weeks * step + 12;
const height = top + 7 * step + 42;

const colors = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const levelFor = (value) => {
  if (value <= 0) return 0;
  if (value <= 3) return 1;
  if (value <= 9) return 2;
  if (value <= 19) return 3;
  return 4;
};

const parts = [];
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Combined GitHub and GitLab contributions</title>
  <desc id="desc">Contribution activity from GitHub and GitLab over the last 365 days.</desc>
  <rect width="100%" height="100%" rx="8" fill="#0d1117"/>
  <text x="${left}" y="14" fill="#e6edf3" font-family="Arial, sans-serif" font-size="12" font-weight="600">GitHub + GitLab contributions</text>`);

for (let week = 0; week < weeks; week += 1) {
  const weekDate = new Date(start);
  weekDate.setUTCDate(start.getUTCDate() + week * 7);

  if (weekDate.getUTCDate() <= 7 || week === 0) {
    const label = monthNames[weekDate.getUTCMonth()];
    parts.push(`<text x="${left + week * step}" y="22" fill="#8b949e" font-family="Arial, sans-serif" font-size="9">${label}</text>`);
  }

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    const date = new Date(weekDate);
    date.setUTCDate(weekDate.getUTCDate() + dayOfWeek);
    const dateKey = isoDate(date);
    const value = dateKey >= isoDate(from) && dateKey <= isoDate(today)
      ? contributions.get(dateKey) ?? 0
      : 0;
    const x = left + week * step;
    const y = top + dayOfWeek * step;
    const label = `${dateKey}: ${value} contribution${value === 1 ? "" : "s"}`;
    parts.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${colors[levelFor(value)]}"><title>${escapeXml(label)}</title></rect>`);
  }
}

const legendY = height - 18;
parts.push(`<text x="${left}" y="${legendY}" fill="#8b949e" font-family="Arial, sans-serif" font-size="9">Less</text>`);
for (let index = 0; index < colors.length; index += 1) {
  parts.push(`<rect x="${left + 27 + index * 15}" y="${legendY - 9}" width="11" height="11" rx="2" fill="${colors[index]}"/>`);
}
parts.push(`<text x="${left + 110}" y="${legendY}" fill="#8b949e" font-family="Arial, sans-serif" font-size="9">More</text></svg>`);

await mkdir("assets", { recursive: true });
await writeFile(OUTPUT, parts.join("\n"));
console.log(`Wrote ${OUTPUT} using ${contributions.size} daily values.`);
