import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const getHeaders = () => ({
  Authorization: `SSWS ${process.env.OKTA_API_TOKEN}`,
  Accept: "application/json",
});

export const findUserByEmail = createTool({
  id: "find-user-by-email",
  description: "Find an Okta user by their email address",
  inputSchema: z.object({
    email: z.string().email().describe("The email address to search for"),
  }),
  outputSchema: z.object({
    user: z.any().nullable().describe("The user object or null if not found"),
  }),
  execute: async ({ context }) => {
    const { email } = context;
    const filter = encodeURIComponent(`profile.email eq "${email}"`);
    const url = `${process.env.OKTA_ORG_URL}/api/v1/users?filter=${filter}`;

    console.log(`[Okta] Finding user by email: ${email}`);
    console.log(`[Okta] Request URL: ${url}`);

    try {
      const res = await fetch(url, { headers: getHeaders() });

      console.log(`[Okta] Response status: ${res.status}`);

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[Okta] API Error: ${res.status} - ${errorText}`);
        throw new Error(`Okta API returned ${res.status}: ${errorText}`);
      }

      const users = (await res.json()) as any[];
      console.log(`[Okta] Found ${users.length} user(s)`);

      return { user: users[0] || null };
    } catch (error) {
      console.error(`[Okta] Error finding user:`, error);
      throw error;
    }
  },
});

export const getUserGroups = createTool({
  id: "get-user-groups",
  description: "Get the groups that an Okta user belongs to",
  inputSchema: z.object({
    userId: z.string().describe("The Okta user ID"),
  }),
  outputSchema: z.object({
    groups: z.array(z.string()).describe("List of group names"),
  }),
  execute: async ({ context }) => {
    const { userId } = context;
    const res = await fetch(
      `${process.env.OKTA_ORG_URL}/api/v1/users/${userId}/groups`,
      { headers: getHeaders() }
    );
    const groups = (await res.json()) as any[];
    return { groups: groups.map((g: any) => g.profile.name) };
  },
});

export const resetPassword = createTool({
  id: "reset-password",
  description: "Generate a password reset link for an Okta user (does not send email)",
  inputSchema: z.object({
    userId: z.string().describe("The Okta user ID"),
  }),
  outputSchema: z.object({
    resetPasswordUrl: z.string().describe("The password reset URL"),
  }),
  execute: async ({ context }) => {
    const { userId } = context;
    const res = await fetch(
      `${process.env.OKTA_ORG_URL}/api/v1/users/${userId}/lifecycle/reset_password?sendEmail=false`,
      { method: "POST", headers: getHeaders() }
    );
    const result = (await res.json()) as any;
    return { resetPasswordUrl: result.resetPasswordUrl };
  },
});

export const lockUser = createTool({
  id: "lock-user",
  description: "Lock/suspend an Okta user account to prevent login",
  inputSchema: z.object({
    userId: z.string().describe("The Okta user ID"),
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Whether the operation succeeded"),
    message: z.string().describe("Status message"),
  }),
  execute: async ({ context }) => {
    const { userId } = context;
    const res = await fetch(
      `${process.env.OKTA_ORG_URL}/api/v1/users/${userId}/lifecycle/suspend`,
      { method: "POST", headers: getHeaders() }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to lock user: ${errorText}`);
    }

    return { success: true, message: "User account has been locked" };
  },
});

export const unlockUser = createTool({
  id: "unlock-user",
  description: "Unlock/unsuspend an Okta user account to restore login access",
  inputSchema: z.object({
    userId: z.string().describe("The Okta user ID"),
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Whether the operation succeeded"),
    message: z.string().describe("Status message"),
  }),
  execute: async ({ context }) => {
    const { userId } = context;
    const res = await fetch(
      `${process.env.OKTA_ORG_URL}/api/v1/users/${userId}/lifecycle/unsuspend`,
      { method: "POST", headers: getHeaders() }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to unlock user: ${errorText}`);
    }

    return { success: true, message: "User account has been unlocked" };
  },
});

export const findGroupByName = createTool({
  id: "find-group-by-name",
  description: "Find an Okta group by name",
  inputSchema: z.object({
    groupName: z.string().describe("The group name to search for"),
  }),
  outputSchema: z.object({
    group: z.any().nullable().describe("The group object or null if not found"),
  }),
  execute: async ({ context }) => {
    const { groupName } = context;
    const query = encodeURIComponent(groupName);
    const res = await fetch(
      `${process.env.OKTA_ORG_URL}/api/v1/groups?q=${query}`,
      { headers: getHeaders() }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to search groups: ${errorText}`);
    }

    const groups = (await res.json()) as any[];
    // Find exact match (case-insensitive)
    const group = groups.find((g: any) =>
      g.profile.name.toLowerCase() === groupName.toLowerCase()
    );

    return { group: group || null };
  },
});

export const addUserToGroup = createTool({
  id: "add-user-to-group",
  description: "Add an Okta user to a group",
  inputSchema: z.object({
    userId: z.string().describe("The Okta user ID"),
    groupId: z.string().describe("The Okta group ID"),
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Whether the operation succeeded"),
    message: z.string().describe("Status message"),
  }),
  execute: async ({ context }) => {
    const { userId, groupId } = context;
    const res = await fetch(
      `${process.env.OKTA_ORG_URL}/api/v1/groups/${groupId}/users/${userId}`,
      { method: "PUT", headers: getHeaders() }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to add user to group: ${errorText}`);
    }

    return { success: true, message: "User has been added to the group" };
  },
});

export const resetMFA = createTool({
  id: "reset-mfa",
  description: "Reset all MFA factors for an Okta user, requiring them to re-enroll",
  inputSchema: z.object({
    userId: z.string().describe("The Okta user ID"),
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Whether the operation succeeded"),
    message: z.string().describe("Status message"),
  }),
  execute: async ({ context }) => {
    const { userId } = context;
    const res = await fetch(
      `${process.env.OKTA_ORG_URL}/api/v1/users/${userId}/lifecycle/reset_factors`,
      { method: "POST", headers: getHeaders() }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to reset MFA: ${errorText}`);
    }

    return { success: true, message: "MFA factors have been reset. User will need to re-enroll." };
  },
});
