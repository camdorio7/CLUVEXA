/** One provider message per recipient: never expose the audience in a shared To field. */
export function individualEmailMessages(
  recipients: string[],
  content: { from: string; subject: string; html: string; reply_to?: string },
) {
  return recipients.map((email) => ({ ...content, to: [email] }));
}
