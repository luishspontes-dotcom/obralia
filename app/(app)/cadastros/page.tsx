import Link from "next/link";
import { BriefcaseBusiness, ClipboardList, HardHat, Settings, UserCog, Users } from "lucide-react";
import { getDiarioCadastroSnapshot } from "@/lib/diario-cadastros";

const cards = [
  { href: "/usuarios", label: "Usuários", key: "usuarios", icon: Users },
  { href: "/cadastros/usuarios-empresas-acesso", label: "Usuários empresas/acesso", key: "usuarios", icon: UserCog },
  { href: "/cadastros/grupos-de-obra", label: "Grupos de obra", key: "grupos", icon: BriefcaseBusiness },
  { href: "/cadastros/modelos-relatorios", label: "Modelos de relatórios", key: "modelos", icon: ClipboardList },
  { href: "/cadastros/mao-de-obra", label: "Mão de obra", key: "mao_de_obra_padrao", icon: HardHat },
  { href: "/cadastros/equipamentos", label: "Equipamentos", key: "equipamentos", icon: Settings },
  { href: "/cadastros/tipos-ocorrencias", label: "Tipos de ocorrências", key: "tipos_ocorrencias", icon: ClipboardList },
  { href: "/configuracoes", label: "Configurações", key: "configuracoes", icon: Settings },
];

export default async function CadastrosPage() {
  const { snapshot, lastSuccessAt } = await getDiarioCadastroSnapshot();
  const counts = snapshot.counts ?? {};

  return (
    <div className="diario-page">
      <div className="diario-container">
        <div className="diario-page-header">
          <div>
            <h1>Cadastros</h1>
            <p>
              {lastSuccessAt
                ? `Snapshot do Diário importado em ${new Date(lastSuccessAt).toLocaleString("pt-BR")}`
                : "Cadastros operacionais"}
            </p>
          </div>
        </div>

        <div className="do-cadastro-grid">
          {cards.map(({ href, label, key, icon: Icon }) => (
            <Link key={href} href={href} className="do-cadastro-card">
              <Icon size={18} />
              <span>{label}</span>
              <strong>{Number(counts[key] ?? 0)}</strong>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
