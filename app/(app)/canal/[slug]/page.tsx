import { EmBreve } from "@/components/layout/EmBreve";

export default async function CanalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <EmBreve
      title={`Canal · ${slug}`}
      description="Em breve: chat por canais com o time da obra. Discussões organizadas por tema, threads, anexos. No primeiro release vamos focar em RDOs e tarefas."
      emoji="#"
    />
  );
}
