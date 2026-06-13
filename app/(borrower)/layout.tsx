// Public layout — no Clerk auth. Token-based access only.
// Phase 123 — the NMLS/compliance disclaimer is injected here so it appears on every
// borrower-facing page and can never be omitted per-page. (The borrower's specific LO
// NMLS # is also shown in the in-portal contact card.)
export default function BorrowerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <p className="text-[11px] text-[#9B9590] text-center py-4 px-5 border-t border-[#EDEAE4] bg-[#FAFAF8]">
        Equal Housing Lender · This is not a commitment to lend. Rates and terms are subject to change. All loans subject to credit approval.
      </p>
    </>
  );
}
