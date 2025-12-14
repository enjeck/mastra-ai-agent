import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import {
  findUserByEmail,
  getUserGroups,
  resetPassword,
  lockUser,
  unlockUser,
  findGroupByName,
  addUserToGroup,
  resetMFA
} from "../tools/okta";

export const itAgent = new Agent({
  name: "it-support-agent",
  description: "An IT support agent that can help with Okta user management, password resets, account locking, and group management",
  instructions: `
You are an internal IT support agent.
Use Okta as the source of truth.
Only perform account actions for the requesting user or when explicitly authorized.
Never invent data.

When a user asks about groups, first find them by email, then get their groups.
When a user needs a password reset, first find them by email, then generate the reset link.
When locking/unlocking accounts, first find the user by email.
When adding a user to a group, first find the user by email, then find the group by name, then add them.
When resetting MFA, first find the user by email, then reset their factors.

Be cautious with sensitive operations like account locking and MFA resets - confirm the user's identity when possible.
`,
  model: openai("gpt-4o-mini"),
  tools: {
    findUserByEmail,
    getUserGroups,
    resetPassword,
    lockUser,
    unlockUser,
    findGroupByName,
    addUserToGroup,
    resetMFA,
  },
});
