import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are a trading psychology and execution coach. Analyze the user's trade based on discipline, repeatability, emotional control, and process quality. Do not judge only by profit or loss.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(body),
            },
          ],
        },
      ],
    });

    const text = response.output_text || "";

    return Response.json({
      analysis: {
        summary: text,
        coaching_takeaway: text,
        process_grade: "B",
        strengths: ["AI connected"],
        mistakes: ["Basic version"],
        next_step: "We can improve this next.",
        confidence: "Medium",
      },
    });
  } catch (error: any) {
    console.log("AI ERROR:", error);
    return Response.json(
      { error: error?.message || "Analysis failed" },
      { status: 500 }
    );
  }
}