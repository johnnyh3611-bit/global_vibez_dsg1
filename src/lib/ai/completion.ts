import { getAIProvider } from "@/lib/ai/config";
import {
  generateOpenAICompletion,
  streamOpenAICompletion,
} from "@/lib/ai/openai";
import {
  generateOllamaCompletion,
  streamOllamaCompletion,
} from "@/lib/ai/ollama";

export async function generateCompletion(
  prompt: string,
  options?: { model?: string; baseUrl?: string }
): Promise<string> {
  if (getAIProvider() === "openai") {
    return generateOpenAICompletion(prompt);
  }

  return generateOllamaCompletion(prompt, options);
}

export async function streamCompletion(
  prompt: string,
  options?: { model?: string; baseUrl?: string }
): Promise<ReadableStream<Uint8Array>> {
  if (getAIProvider() === "openai") {
    return streamOpenAICompletion(prompt);
  }

  return streamOllamaCompletion(prompt, options);
}

export function parseSuggestions(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\d+[\).\s-]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}
