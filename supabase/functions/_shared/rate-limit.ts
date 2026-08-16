export async function consumeRateLimit(
  adminClient: any,
  userId: string,
  scope: string,
  limit: number,
  windowSeconds = 60,
): Promise<boolean> {
  const { data, error } = await adminClient.rpc("consume_edge_rate_limit", {
    _user_id: userId,
    _scope: scope,
    _limit: limit,
    _window_seconds: windowSeconds,
  });

  if (error) {
    console.error("Rate-limit check failed", { scope, message: error.message });
    throw new Error("Rate-limit service unavailable");
  }
  return data === true;
}
