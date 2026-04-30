import { EmBreve } from "@/components/layout/EmBreve";

export default function ComentariosPage() {
  return (
    <EmBreve
      title="Comentários"
      description="Em breve: feed de tudo que mencionou você ou que você comentou. Por enquanto, comentários ficam nas atividades dentro de cada obra."
      emoji="💬"
      cta={{ label: "Ver obras", href: "/obras" }}
    />
  );
}
