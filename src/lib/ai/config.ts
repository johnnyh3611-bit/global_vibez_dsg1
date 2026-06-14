export type AIProvider = "ollama" | "openai";

export function getAIProvider(): AIProvider {
  return process.env.AI_PROVIDER === "openai" ? "openai" : "ollama";
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

export function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return apiKey;
}
