// Public layout — no Clerk auth. Token-based access only.
export default function BorrowerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
