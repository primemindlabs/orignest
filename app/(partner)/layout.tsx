// Public layout — no Clerk auth. Token-based access only.
export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
