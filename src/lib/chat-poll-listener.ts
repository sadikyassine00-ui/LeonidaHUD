"use client";

export interface ChatVoteCounts {
  votesA: number;
  votesB: number;
  twitchStatus: "idle" | "connecting" | "connected" | "error";
  kickStatus: "idle" | "connecting" | "connected" | "error";
  kickNote?: string;
}

export function parseChatVoteChoice(rawMessage: string): "A" | "B" | null {
  const msg = rawMessage.trim().toLowerCase();
  if (!msg) return null;
  if (msg === "1" || msg === "!a" || msg.startsWith("!a ")) return "A";
  if (msg === "2" || msg === "!b" || msg.startsWith("!b ")) return "B";
  return null;
}

export interface ChatPollListenerHandle {
  stop: () => void;
  getCounts: () => { votesA: number; votesB: number };
}

export async function startChatPollListeners(options: {
  pollId: string;
  initialVotesA: number;
  initialVotesB: number;
  twitchChannel?: string | null;
  kickChannel?: string | null;
  onStatusChange: (status: ChatVoteCounts) => void;
}): Promise<ChatPollListenerHandle> {
  const voters = new Set<string>();
  let votesA = options.initialVotesA;
  let votesB = options.initialVotesB;
  let stopped = false;

  const status: ChatVoteCounts = {
    votesA,
    votesB,
    twitchStatus: options.twitchChannel ? "connecting" : "idle",
    kickStatus: options.kickChannel ? "connecting" : "idle",
  };

  const emitStatus = () => {
    if (stopped) return;
    options.onStatusChange({
      ...status,
      votesA,
      votesB,
    });
  };

  const recordVote = (platform: "twitch" | "kick", userKey: string, text: string) => {
    if (stopped) return;
    const choice = parseChatVoteChoice(text);
    if (!choice) return;
    const dedupKey = `${options.pollId}:${platform}:${userKey.toLowerCase()}`;
    if (voters.has(dedupKey)) return;
    voters.add(dedupKey);
    if (choice === "A") votesA += 1;
    else votesB += 1;
    emitStatus();
  };

  emitStatus();

  // 1. Twitch anonymous read-only IRC WebSocket via tmi.js
  let twitchClient: {
    disconnect: () => Promise<unknown>;
  } | null = null;

  if (options.twitchChannel && options.twitchChannel.trim()) {
    const channelName = options.twitchChannel.trim().replace(/^#/, "").toLowerCase();
    try {
      const tmiModule = await import("tmi.js");
      const ClientCtor = tmiModule.Client ?? tmiModule.default?.Client;
      if (ClientCtor && !stopped) {
        const client = new ClientCtor({
          options: { debug: false },
          connection: { reconnect: true, secure: true },
          channels: [channelName],
        });
        client.on("connected", () => {
          status.twitchStatus = "connected";
          emitStatus();
        });
        client.on("disconnected", () => {
          if (!stopped) {
            status.twitchStatus = "error";
            emitStatus();
          }
        });
        client.on("message", (_channel: string, tags: Record<string, unknown>, message: string) => {
          const username =
            typeof tags["username"] === "string"
              ? tags["username"]
              : typeof tags["user-id"] === "string"
              ? tags["user-id"]
              : "";
          if (username) {
            recordVote("twitch", username, message);
          }
        });
        await client.connect();
        twitchClient = client;
      }
    } catch {
      status.twitchStatus = "error";
      emitStatus();
    }
  }

  // 2. Kick public Pusher WebSocket listener
  let kickSocket: WebSocket | null = null;
  let kickPingInterval: ReturnType<typeof setInterval> | null = null;

  if (options.kickChannel && options.kickChannel.trim()) {
    const rawKick = options.kickChannel.trim();
    let chatroomId: string | null = /^\d+$/.test(rawKick) ? rawKick : null;

    if (!chatroomId) {
      try {
        const res = await fetch(
          `https://kick.com/api/v2/channels/${encodeURIComponent(rawKick.toLowerCase())}`
        );
        if (res.ok) {
          const data = (await res.json()) as { chatroom?: { id?: number } };
          if (data.chatroom?.id) {
            chatroomId = String(data.chatroom.id);
          }
        }
      } catch {
        status.kickNote = "Enter numeric Kick Chatroom ID in Dashboard if channel lookup is blocked.";
      }
    }

    if (chatroomId && !stopped) {
      try {
        const ws = new WebSocket(
          "wss://ws-us2.pusher.com/app/eb1d5f283081a78b932c?protocol=7&client=js&version=7.6.0&flash=false"
        );
        kickSocket = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              event: "pusher:subscribe",
              data: {
                auth: "",
                channel: `chatrooms.${chatroomId}.v2`,
              },
            })
          );
          status.kickStatus = "connected";
          emitStatus();

          kickPingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ event: "pusher:ping", data: {} }));
            }
          }, 30000);
        };

        ws.onmessage = (evt) => {
          try {
            const payload = JSON.parse(String(evt.data)) as {
              event?: string;
              data?: string;
            };
            if (
              payload.event === "App\\Events\\ChatMessageEvent" &&
              typeof payload.data === "string"
            ) {
              const msgData = JSON.parse(payload.data) as {
                content?: string;
                sender?: { id?: number; username?: string };
              };
              const senderKey =
                msgData.sender?.username ||
                (msgData.sender?.id ? String(msgData.sender.id) : "");
              if (senderKey && typeof msgData.content === "string") {
                recordVote("kick", senderKey, msgData.content);
              }
            }
          } catch {
            // Ignore malformed Pusher frame
          }
        };

        ws.onerror = () => {
          status.kickStatus = "error";
          emitStatus();
        };
      } catch {
        status.kickStatus = "error";
        emitStatus();
      }
    } else if (!chatroomId) {
      status.kickStatus = "error";
      if (!status.kickNote) {
        status.kickNote = "Numeric Kick Chatroom ID required for live Kick chat.";
      }
      emitStatus();
    }
  }

  return {
    getCounts: () => ({ votesA, votesB }),
    stop: () => {
      stopped = true;
      if (kickPingInterval) clearInterval(kickPingInterval);
      try {
        kickSocket?.close();
      } catch {
        // Ignore
      }
      try {
        void twitchClient?.disconnect();
      } catch {
        // Ignore
      }
    },
  };
}
