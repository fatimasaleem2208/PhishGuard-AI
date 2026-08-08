/**
 * Lovable AI Gateway client (server-only).
 * Uses the Responses API for GPT-5.6 models.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
export const DEFAULT_MODEL = "openai/gpt-5.6-sol";

export class AiGatewayError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface ResponsesPayload {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string } | null;
}

function extractText(payload: ResponsesPayload): string {
  const chunks: string[] = [];
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

export async function callAi(options: {
  instructions: string;
  input: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
}): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiGatewayError("AI service is not configured.", 500);

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      instructions: options.instructions,
      input: options.input,
    }),
  });

  if (response.status === 429) {
    throw new AiGatewayError("AI rate limit reached. Please try again in a moment.", 429);
  }
  if (response.status === 402) {
    throw new AiGatewayError("AI credits exhausted. Add credits to continue using AI features.", 402);
  }
  if (!response.ok) {
    const detail = await response.text();
    console.error("AI gateway error", response.status, detail.slice(0, 500));
    throw new AiGatewayError("The AI service could not complete this request.", response.status);
  }

  const payload = (await response.json()) as ResponsesPayload;
  const text = extractText(payload);
  if (!text) throw new AiGatewayError("The AI service returned an empty response.", 502);
  return text;
}
