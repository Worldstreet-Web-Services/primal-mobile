/** Time-of-day greeting for the home hero. Local device time by design. */
export function greetingFor(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

/**
 * First name only — the hero has room for one line.
 *
 * Safe for every shape the identity record can hold, not just names: an email
 * renders as its local-part ("jane.doe@x.com" → "jane.doe"), and the
 * local-part is never split further on "." — "jane" would read like a first
 * name we were told, and nobody told us it. A handle is one word already and
 * passes through whole. Only a genuine multi-word name splits on whitespace.
 */
export function firstNameOf(fullName: string): string {
  const trimmed = fullName.trim();
  const at = trimmed.indexOf("@");
  if (at > 0) return trimmed.slice(0, at);
  if (at === 0) return trimmed;
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

/**
 * What the greeting may call the member, from whichever identity fact is
 * actually known: a real first name, else the handle, else the email's
 * local-part. Null when nothing is known — and null means the salutation
 * renders ALONE. No "there", no placeholder, no invented name; GreetingBlock
 * holds its layout either way. Structural parameter (rather than the
 * IdentityRecord type) so this file keeps zero imports.
 */
export function greetingNameFor(
  identity: {
    displayName: string | null;
    handle: string | null;
    email: string | null;
  } | null,
): string | null {
  if (!identity) return null;
  if (identity.displayName) return firstNameOf(identity.displayName);
  if (identity.handle) return identity.handle;
  if (identity.email) return firstNameOf(identity.email);
  return null;
}
