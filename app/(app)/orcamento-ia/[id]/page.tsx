import { EstimateDetailContent } from "@/components/budget-ai/EstimateDetailContent";

export default async function OrcamentoIaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EstimateDetailContent estimateId={id} />;
}
