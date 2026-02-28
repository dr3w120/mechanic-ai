import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

import { findRepairMatch, calculateEstimate } from "./services/repairService.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// ===============================
// OpenAI Setup
// ===============================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===============================
// Repair Cost Database
// ===============================

const DEFAULT_LABOR_RATE = 120;

// ===============================
// Controlled Estimate Calculator
// ===============================
function calculateDatabaseEstimate(repair) {
  const minTotal =
    repair.parts[0] + repair.laborHours[0] * DEFAULT_LABOR_RATE;

  const maxTotal =
    repair.parts[1] + repair.laborHours[1] * DEFAULT_LABOR_RATE;

  return {
    estimate_source: "database",
    labor_rate_used: `$${DEFAULT_LABOR_RATE}/hr`,
    parts_range: `$${repair.parts[0]} - $${repair.parts[1]}`,
    labor_hours_range: `${repair.laborHours[0]} - ${repair.laborHours[1]} hours`,
    estimated_total_range: `$${minTotal.toFixed(0)} - $${maxTotal.toFixed(0)}`,
  };
}

// ===============================
// AI Fallback Estimate
// ===============================
async function getAIFallbackEstimate(cause, vehicle) {
  try {
    const completion = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
Vehicle: ${vehicle}
Repair Issue: ${cause}

Provide estimated:
- parts_range
- labor_hours_range
- estimated_total_range
`,
      text: {
        format: {
          type: "json_schema",
          json_schema: {
            name: "repair_estimate",
            schema: {
              type: "object",
              properties: {
                parts_range: { type: "string" },
                labor_hours_range: { type: "string" },
                estimated_total_range: { type: "string" }
              },
              required: [
                "parts_range",
                "labor_hours_range",
                "estimated_total_range"
              ],
              additionalProperties: false
            }
          }
        }
      }
    });

    return {
      estimate_source: "ai_fallback",
      ...completion.output_parsed
    };

  } catch (error) {
    console.error("AI Fallback Error:", error);

    return {
      estimate_source: "ai_fallback",
      parts_range: "Unavailable",
      labor_hours_range: "Unavailable",
      estimated_total_range: "Unavailable"
    };
  }
}
// ===============================
// Diagnose Route
// ===============================
app.post("/diagnose", async (req, res) => {
  try {
    const { vehicle, symptoms } = req.body;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional automotive diagnostic AI."
        },
        {
          role: "user",
          content: `
Vehicle: ${vehicle}
Symptoms: ${symptoms}

Return JSON only in this format:
{
  "likely_causes": [],
  "recommended_actions": [],
  "severity": "",
  "safe_to_drive": ""
}
`
        }
      ],
      temperature: 0.3
    });

    const parsed = JSON.parse(aiResponse.choices[0].message.content);

    const topCause = parsed.likely_causes?.[0] || "";

    let repairEstimate = null;

    const matchedRepair = findRepairMatch(topCause);

    if (matchedRepair) {
      repairEstimate = calculateEstimate(matchedRepair);
    } else {
      repairEstimate = await getAIFallbackEstimate(topCause, vehicle);
    }

    res.json({
      ...parsed,
      repair_estimate: repairEstimate
    });

  } catch (error) {
    console.error("Diagnosis Error:", error);
    res.status(500).json({ error: "AI diagnosis failed." });
  }
});
// ===============================
app.get("/", (req, res) => {
  res.send("Mechanic AI is running.");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

