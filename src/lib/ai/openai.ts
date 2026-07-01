import { getOpenAIApiKey, getOpenAIModel } from "@/lib/ai/config";

export async function generateOpenAICompletion(prompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAIApiKey()}`,
    },
    body: JSON.stringify({
      model: getOpenAIModel(),
      messages: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  return content;
}

export async function streamOpenAICompletion(
  prompt: string
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAIApiKey()}`,
    },
    body: JSON.stringify({
      model: getOpenAIModel(),
      messages: [{ role: "user", content: prompt }],
      stream: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body}`);
  }

  if (!response.body) {
    throw new Error("OpenAI returned an empty stream");
  }

  const openaiBody = response.body;
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = openaiBody.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") {
              controller.close();
              return;
            }

            const chunk = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const content = chunk.choices?.[0]?.delta?.content;

            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
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
