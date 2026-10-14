/** Stripe uses two-decimal minor units for ISK and UGX for backwards compatibility. */
export function stripeAmount(
  amount: number,
  currency: string,
  locale?: string,
) {
  const code = currency.toUpperCase();
  const format = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
  });
  const digits = ["ISK", "UGX"].includes(code)
    ? 2
    : (format.resolvedOptions().maximumFractionDigits ?? 2);
  return format.format(amount / 10 ** digits);
}
