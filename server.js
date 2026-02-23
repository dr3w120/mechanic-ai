import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Test route
app.get("/", (req, res) => {
  res.send("Mechanic AI backend is running 🚗");
});

// AI diagnostic route
app.post("/diagnose", async (req, res) => {
  const { vehicle, symptoms } = req.body;

  if (!vehicle || !symptoms) {
    return res.status(400).json({ error: "Vehicle and symptoms are required." });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a professional automotive diagnostic AI. 
Given the vehicle and symptoms, provide JSON with:
{
  "likely_causes": ["..."],
  "recommended_actions": ["..."],
  "severity": "Low/Medium/High",
  "safe_to_drive": "Yes/No"
}
`
        },
        {
          role: "user",
          content: `Vehicle: ${vehicle}
Symptoms: ${symptoms}`
        }
      ]
    });

    const aiResponse = completion.choices[0].message.content;
    res.send(aiResponse);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AI diagnosis failed." });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

