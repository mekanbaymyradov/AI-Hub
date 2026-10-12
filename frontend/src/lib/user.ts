import { type UserPublic } from "@/api/types";

/** Return the user's name, or one made from their email address when they have none. */
export function displayName(user: Pick<UserPublic, "name" | "email">): string {
  if (user.name) return user.name;
  const fromEmail = user.email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1);
}
