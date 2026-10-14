/** Bound individual upstream requests; preserve cancellation and never retry mutations. */
export function withRequestTimeout(
  timeoutMs = 12000,
  request: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const original =
      init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abort = () => controller.abort(original?.reason);
    if (original?.aborted) abort();
    else original?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      () =>
        controller.abort(
          new DOMException(
            "The request took too long. Please retry.",
            "TimeoutError",
          ),
        ),
      timeoutMs,
    );
    try {
      return await request(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      original?.removeEventListener("abort", abort);
    }
  };
}
