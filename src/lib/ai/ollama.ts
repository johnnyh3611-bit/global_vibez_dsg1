const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.2:1b";

function getBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE_URL;
}

function getModel(): string {
  return process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;
}

export async function generateOllamaCompletion(
  prompt: string,
  options?: { model?: string; baseUrl?: string }
): Promise<string> {
  const baseUrl = options?.baseUrl ?? getBaseUrl();
  const model = options?.model ?? getModel();

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { response?: string };
  const content = data.response?.trim();

  if (!content) {
    throw new Error("Ollama returned an empty response");
  }

  return content;
}

export async function streamOllamaCompletion(
  prompt: string,
  options?: { model?: string; baseUrl?: string }
): Promise<ReadableStream<Uint8Array>> {
  const baseUrl = options?.baseUrl ?? getBaseUrl();
  const model = options?.model ?? getModel();

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${body}`);
  }

  if (!response.body) {
    throw new Error("Ollama returned an empty stream");
  }

  const ollamaBody = response.body;
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = ollamaBody.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;

            const chunk = JSON.parse(line) as {
              response?: string;
              done?: boolean;
            };

            if (chunk.response) {
              controller.enqueue(new TextEncoder().encode(chunk.response));
            }

            if (chunk.done) {
              controller.close();
              return;
            }
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}
