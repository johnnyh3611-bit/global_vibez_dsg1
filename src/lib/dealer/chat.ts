import { DealerName, DEALERS } from "@/lib/dealer/personas";

export interface ChatMessage {
  role: "user" | "dealer";
  content: string;
  streaming?: boolean;
}

export type ChatArchive = Record<DealerName, ChatMessage[]>;

export const EMPTY_ARCHIVE: ChatArchive = {
  Nova: [],
  Ace: [],
  Ruby: [],
  Jade: [],
};

export function sanitizeChatHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter(
    (message) => !message.streaming && (message.role === "user" || message.content.trim())
  );
}

export function chatStorageKey(dealerName: DealerName): string {
  return `chat_${dealerName}`;
}

export function loadChatArchiveFromStorage(): ChatArchive {
  if (typeof window === "undefined") {
    return EMPTY_ARCHIVE;
  }

  const archive: ChatArchive = { ...EMPTY_ARCHIVE };

  for (const dealer of DEALERS) {
    const saved = localStorage.getItem(chatStorageKey(dealer.name));
    if (!saved) continue;

    try {
      archive[dealer.name] = sanitizeChatHistory(JSON.parse(saved));
    } catch {
      // Ignore corrupted local storage entries.
    }
  }

  return archive;
}
