import Link from "next/link";

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
    <div className="diario-page">
      <div className="diario-container">
        <div className="diario-page-header">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <Link className="diario-gray-button" href="/cadastros">
            Cadastros
          </Link>
        </div>
        {children}
      </div>
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
