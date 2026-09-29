/**
 * Bearer-token check for the admin routes.
 *
 * One shared secret (`ADMIN_TOKEN`) for the handful of approvers, pasted once
 * into the admin page. Compared in constant time so the check leaks nothing
 * about how much of a guess was right.
 */
export function isAuthorized(
  authorization: string | null,
  token: string | undefined = process.env.ADMIN_TOKEN,
): boolean {
  if (!token || token.length < 16) return false;
  const presented = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  return constantTimeEqual(presented, token);
}

export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}
