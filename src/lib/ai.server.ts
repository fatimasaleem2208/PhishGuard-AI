/**
 * Groq AI client (server-only).
 * Uses Groq's OpenAI-compatible Chat Completions API.
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export class AiGatewayError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export async function callAi(options: {
  instructions: string;
  input: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
}): Promise<string> {
  const key = process.env["GROQ_API_KEY"];

  if (!key) {
    throw new AiGatewayError("AI service is not configured.", 500);
  }

  const messages = [
    {
      role: "system" as const,
      content: options.instructions,
    },
    ...options.input,
  ];

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      messages,
      temperature: 0.2,
    }),
  });

  if (response.status === 429) {
    throw new AiGatewayError(
      "AI rate limit reached. Please try again in a moment.",
      429,
    );
  }

  if (!response.ok) {
    const detail = await response.text();

    console.error(
      "Groq API error",
      response.status,
      detail.slice(0, 500),
    );

    throw new AiGatewayError(
      "The AI service could not complete this request.",
      response.status,
    );
  }

  const payload = (await response.json()) as GroqResponse;

  const text = payload.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new AiGatewayError(
      "The AI service returned an empty response.",
      502,
    );
  }

  return text;
}
