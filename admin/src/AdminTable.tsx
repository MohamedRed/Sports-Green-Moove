export function TableSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section className="table-panel" id={id}><h2>{title}</h2><div className="table-scroll"><table>{children}</table></div></section>;
}

export function Badge({ tone, children }: { tone: "ok" | "warning" | "review"; children: React.ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
