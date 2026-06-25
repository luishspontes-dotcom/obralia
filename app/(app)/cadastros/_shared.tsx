export function CadastroShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: "0 24px 28px" }}>
      <div style={{ margin: "8px 0 18px" }}>
        <h1 style={{ font: "600 22px var(--font-inter)", margin: 0 }}>{title}</h1>
        {subtitle ? (
          <p style={{ margin: "4px 0 0", color: "var(--o-text-2)", fontSize: 13 }}>{subtitle}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function EmptyPanel({ children }: { children: React.ReactNode }) {
  return <div className="do-panel" style={{ padding: 18, color: "#777", fontSize: 12 }}>{children}</div>;
}

export function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="do-panel">
      <div className="do-table-wrap">
        <table className="do-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function roleLabel(role: string | null | undefined) {
  if (role === "admin") return "Administrador";
  if (role === "engineer") return "Equipe";
  if (role === "viewer") return "Cliente";
  if (role === "owner") return "Owner";
  return role ?? "-";
}

export function groupLabel(group: string | null | undefined) {
  if (group === "administrador") return "Administrador";
  if (group === "personalizado") return "Personalizado";
  if (group === "clienteObra") return "Cliente da obra";
  return group ?? "-";
}
