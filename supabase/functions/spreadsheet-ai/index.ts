import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-info",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

### 2. Scenario Testing & Cell Mutations
When the user asks "what if X changes to Y", or asks to change values, formatting, or text wrapping:
- Identify every cell affected by the change
- Walk through the ripple effect step by step with cell references
- Show before → after values
- When suggesting changes, output a JSON block so the frontend can apply them.

The SET_CELLS \`data\` array accepts these fields per cell. Only include keys you want to change — omitted keys are preserved:
- \`row\` (number, 0-indexed) **required**
- \`col\` (number, 0-indexed) **required**
- \`value\` (string) — cell text or formula starting with \`=\`
- \`formula\` (string) — explicit formula override
- \`bold\` (boolean), \`italic\` (boolean), \`underline\` (boolean)
- \`align\` ("left" | "center" | "right")
- \`bgColor\` (string, hex like "#fff7ed"), \`textColor\` (string, hex)
- \`fontSize\` (number, in pixels)
- \`wrapMode\` ("overflow" | "wrap" | "clip") — use \`"wrap"\` to wrap long text onto multiple lines, \`"clip"\` to hard-truncate, \`"overflow"\` to spill into empty neighbors (default)
- \`logic\` (string) — short reasoning shown to the user

Important: when the user asks to wrap text, enable wrapping, or make long text readable, respond with a SET_CELLS block that sets \`wrapMode: "wrap"\` on every relevant cell — do not just describe it.

Example — wrap a column of long descriptions:
\`\`\`json
{
  "action": "SET_CELLS",
  "explanation": "Enabling text wrap on column B (rows 1–5) so the long descriptions stay readable inside the cell.",
  "data": [
    {"row": 0, "col": 1, "wrapMode": "wrap", "logic": "Wrap long description"},
    {"row": 1, "col": 1, "wrapMode": "wrap", "logic": "Wrap long description"},
    {"row": 2, "col": 1, "wrapMode": "wrap", "logic": "Wrap long description"},
    {"row": 3, "col": 1, "wrapMode": "wrap", "logic": "Wrap long description"},
    {"row": 4, "col": 1, "wrapMode": "wrap", "logic": "Wrap long description"}
  ]
}
\`\`\`

Example — value + style change in one go:
\`\`\`json
{
  "action": "SET_CELLS",
  "explanation": "Changing A1 to 100 and bolding it; B1 recomputes to 200.",
  "data": [
    {"row": 0, "col": 0, "value": "100", "bold": true, "logic": "User-requested change"},
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
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
