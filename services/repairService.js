import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repairsPath = path.join(__dirname, "../data/repairs.json");
const repairs = JSON.parse(fs.readFileSync(repairsPath, "utf-8"));

const DEFAULT_LABOR_RATE = 120;
const MATCH_THRESHOLD = 0.3; // adjust sensitivity

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(" ")
    .filter(Boolean);
}

function calculateSimilarityScore(causeTokens, keywordTokens) {
  let matches = 0;

  for (const token of causeTokens) {
    if (keywordTokens.includes(token)) {
      matches++;
    }
  }

  return matches / keywordTokens.length;
}

export function findRepairMatch(cause) {
  if (!cause) return null;

  const causeTokens = normalize(cause);

  let bestMatch = null;
  let highestScore = 0;

  for (const key in repairs) {
    const repair = repairs[key];

    for (const keyword of repair.keywords) {
      const keywordTokens = normalize(keyword);

      const score = calculateSimilarityScore(causeTokens, keywordTokens);

      if (score > highestScore) {
        highestScore = score;
        bestMatch = repair;
      }
    }
  }

  if (highestScore >= MATCH_THRESHOLD) {
    return bestMatch;
  }

  return null;
}

export function calculateEstimate(repair) {
  const LABOR_RATE = 120;

  const minTotal =
    repair.parts_range[0] +
    repair.labor_hours_range[0] * LABOR_RATE;

  const maxTotal =
    repair.parts_range[1] +
    repair.labor_hours_range[1] * LABOR_RATE;

  return {
    estimate_source: "database",
    repair: repair.display_name,
    category: repair.category,
    severity: repair.severity,
    labor_rate_used: `$${LABOR_RATE}/hr`,
    parts_range: `$${repair.parts_range[0]} - $${repair.parts_range[1]}`,
    labor_hours_range: `${repair.labor_hours_range[0]} - ${repair.labor_hours_range[1]} hrs`,
    estimated_total_range: `$${Math.round(minTotal)} - $${Math.round(maxTotal)}`
  };
}