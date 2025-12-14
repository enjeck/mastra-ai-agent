import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { registerApiRoute } from "@mastra/core/server";
import { itAgent } from "./agents/agent";
import dotenv from "dotenv";

dotenv.config();

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

if (!SLACK_BOT_TOKEN) {
  console.error("SLACK_BOT_TOKEN is required");
  process.exit(1);
}

// tracking processed events to avoid duplicates
const processedEvents = new Set<string>();
const EVENT_EXPIRY_MS = 5 * 60 * 1000;
setInterval(() => processedEvents.clear(), EVENT_EXPIRY_MS);

export const mastra = new Mastra({
  agents: { itAgent },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  server: {
    port: Number(process.env.PORT) || 3000,
    apiRoutes: [
      registerApiRoute("/slack/events", {
        method: "POST",
        handler: async (c) => {
          const body = await c.req.json();
          const { type, challenge, event } = body;

          // Handle URL verification challenge issued by Slack
          if (type === "url_verification") {
            return c.json({ challenge });
          }
          c.status(200);
          if (event?.bot_id) {
            return c.body(null);
          }
          const eventId = `${event?.client_msg_id || event?.ts}_${event?.channel}`;
          if (processedEvents.has(eventId)) {
            console.log(`Skipping duplicate event: ${eventId}`);
            return c.body(null);
          }
          processedEvents.add(eventId);

          if (event && (event.type === "message" || event.type === "app_mention") && event.text) {
            try {
              let messageText = event.text;
              if (event.type === "app_mention") {
                messageText = messageText.replace(/<@[A-Z0-9]+>\s*/g, "").trim();
              }

              console.log(`Processing ${event.type}: "${messageText}"`);

              const mastraInstance = c.get("mastra");
              const agent = mastraInstance.getAgent("itAgent");

              const result = await agent.generate(messageText);

              await fetch("https://slack.com/api/chat.postMessage", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  channel: event.channel,
                  text: result.text,
                }),
              });
            } catch (error) {
              console.error("Error processing message:", error);
            }
          }

          return c.body(null);
        },
      }),
    ],
  },
});
