interface LOARateLimitBannerProps {
  used: number;
  limit: number;
}

export function LOARateLimitBanner({ used, limit }: LOARateLimitBannerProps) {
  const pct = Math.round((used / limit) * 100);
  return (
    <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 text-xs text-amber-700">
      {used} / {limit} queries used today ({pct}%) — resets in ~24 hours
    </div>
  );
}
