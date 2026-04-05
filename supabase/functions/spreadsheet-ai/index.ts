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

    // ENHANCED SYSTEM PROMPT
    const systemPrompt = `You are the GridMind AI Engine. You must fulfill these specific requirements:

1. **Natural Language Execution**: If a user asks to build something (e.g., "make a sales chart"), provide the logic/structure. Output a JSON block starting with \`{ "action": "EXECUTE" ... }\`.
2. **Explainable AI**: For every change or formula, explain the logic behind it. Tell the user *why* a certain calculation was used.
3. **Smart Fill & Categorization**: Be context-aware. If you see "Apple" next to "Microsoft", categorize it as "Tech Company". If you see it next to "Banana", it is "Fruit".
4. **Insight Discovery**: Analyze the provided context. If you notice a dip in values or a significant trend, automatically call it out and explain the likely cause.
5. **Auto-Reporting**: When asked for a summary, create a narrative report of the week's changes and the overall health of the data.
6. **Automation**: If a user sets a rule (e.g., "remove bottom 5% every Friday"), confirm the logic and format it as a stored procedure or scheduled task.

Current Spreadsheet Data Context:
${context || "No data provided yet."}

Always wrap your technical execution commands in a triple-backtick JSON block so the frontend can parse them, followed by your natural language explanation.`;

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
      // ... (keep your existing error handling here)
      const text = await response.text();
      return new Response(JSON.stringify({ error: "AI gateway error", details: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

//Added how to distinguish between Apple(Compnay) and apple(Fruit)-Yannic
//Added insight discovery to see if there is a trend-Yannic
