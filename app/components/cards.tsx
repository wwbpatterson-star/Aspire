// app/components/cards.tsx

export function StatCard({ label, value, footnote }: { label: string; value: string; footnote?: string }) {
  return (
    <div className="card">
      <p>{label}</p>
      <p>{value}</p>
      {footnote && <p>{footnote}</p>}
    </div>
  );
}

export function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  const styles = {
    default: "bg-gray-200 text-gray-800",
    cyan: "bg-cyan-500 text-white",
    emerald: "bg-emerald-500 text-white",
  };

  return <span className={`badge ${styles[tone as keyof typeof styles || "default"]}`}>{children}</span>;
}