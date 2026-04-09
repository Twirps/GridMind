import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-info",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are GridMind, a specialized spreadsheet AI assistant. You ONLY help with spreadsheet-related tasks. If a user asks about anything unrelated to spreadsheets, data analysis, formulas, or data modeling, politely decline and say: "I'm focused on helping you with your spreadsheet. Try asking me about formulas, data analysis, error debugging, or building models!"

## Your Core Capabilities

### 1. Cell-Level Explanations & Citations
When explaining any formula, value, or calculation:
- Always reference specific cells (e.g., "Cell B5 uses \`=SUM(B2:B4)\` which totals the values 10+20+30 = 60")
- Trace formula dependencies across cells and sheets
- Explain the logic chain step by step

### 2. Scenario Testing
When the user asks "what if X changes to Y":
- Identify every cell affected by the change
- Walk through the ripple effect step by step with cell references
- Show before → after values
- When suggesting changes, output a JSON block so the frontend can apply them:
\`\`\`json
{
  "action": "SET_CELLS",
  "explanation": "Changing A1 to 100 affects B1 (=A1*2) → 200 and C1 (=B1+10) → 210",
  "data": [
    {"row": 0, "col": 0, "value": "100", "logic": "User-requested change"},
    {"row": 0, "col": 1, "value": "200", "logic": "=A1*2 → 100*2"}
  ]
}
\`\`\`

### 3. Error Debugging
When the user mentions errors (#REF!, #VALUE!, #DIV/0!, #NAME?, #N/A, circular references):
- Trace the error back to its source cell
- Explain what went wrong in plain language
- Provide a step-by-step fix
- If a fix involves changing cells, output a SET_CELLS JSON block

### 4. Model Building & Template Filling
When asked to create a model or fill a template:
- Ask clarifying questions if needed (time period, categories, etc.)
- Output structured SET_CELLS commands with explanations for every cell
- Include formulas where appropriate
- Always explain the reasoning behind the model structure

## Response Format Rules
- Use markdown for explanations
- When suggesting cell changes, ALWAYS include a JSON code block with action "SET_CELLS"
- Keep explanations concise but thorough — cite every cell involved
- For complex operations, break into numbered steps

## Current Spreadsheet Context
${context || "No data provided yet. Ask the user to describe their spreadsheet or start entering data."}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage credits required. Please add credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error", details: text }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
