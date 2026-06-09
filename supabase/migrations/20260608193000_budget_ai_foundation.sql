create table if not exists public.budget_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  source_label text,
  base_area_m2 numeric,
  base_pool_area_m2 numeric,
  version integer not null default 1,
  is_default boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.budget_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.budget_templates(id) on delete cascade not null,
  code text not null,
  group_code integer,
  group_name text not null,
  description text not null,
  unit text not null,
  unit_cost numeric not null default 0,
  default_quantity numeric,
  quantity_rule jsonb not null default '{}'::jsonb,
  confidence_baseline numeric not null default 0.7 check (confidence_baseline >= 0 and confidence_baseline <= 1),
  needs_review_default boolean not null default true,
  source_notes text,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create unique index if not exists budget_template_items_template_code_idx
  on public.budget_template_items (template_id, code);
create index if not exists budget_templates_org_default_idx
  on public.budget_templates (organization_id, is_default);
create index if not exists budget_template_items_template_sort_idx
  on public.budget_template_items (template_id, sort_order);

create table if not exists public.ai_estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  site_id uuid references public.sites(id) on delete set null,
  template_id uuid references public.budget_templates(id) on delete set null,
  title text not null,
  client_name text,
  address text,
  built_area_m2 numeric,
  pool_area_m2 numeric,
  terrain_area_m2 numeric,
  floors_count integer,
  has_basement boolean not null default false,
  quality_standard text not null default 'alto_padrao',
  status text not null default 'draft'
    check (status in ('draft', 'processing', 'review', 'approved', 'archived', 'failed')),
  confidence_score numeric not null default 0 check (confidence_score >= 0 and confidence_score <= 1),
  subtotal numeric not null default 0,
  contingency_pct numeric not null default 0,
  total numeric not null default 0,
  memorial_text text,
  source_summary jsonb not null default '{}'::jsonb,
  review_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists ai_estimates_org_status_idx
  on public.ai_estimates (organization_id, status, created_at desc);
create index if not exists ai_estimates_site_idx
  on public.ai_estimates (site_id, created_at desc);

create table if not exists public.ai_estimate_files (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid references public.ai_estimates(id) on delete cascade not null,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  kind text not null check (kind in ('plan', 'proposal', 'spreadsheet', 'other')),
  file_name text not null,
  storage_bucket text not null default 'exports',
  storage_path text not null,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create index if not exists ai_estimate_files_estimate_idx
  on public.ai_estimate_files (estimate_id, kind);

create table if not exists public.ai_extracted_facts (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid references public.ai_estimates(id) on delete cascade not null,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  fact_key text not null,
  label text not null,
  value_text text,
  value_numeric numeric,
  unit text,
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  source text not null default 'manual',
  needs_review boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists ai_extracted_facts_estimate_idx
  on public.ai_extracted_facts (estimate_id, fact_key);

create table if not exists public.ai_estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid references public.ai_estimates(id) on delete cascade not null,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  template_item_id uuid references public.budget_template_items(id) on delete set null,
  code text,
  group_name text not null,
  description text not null,
  quantity numeric not null default 0,
  unit text not null,
  unit_cost numeric not null default 0,
  total numeric not null default 0,
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  source text not null default 'template',
  needs_review boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists ai_estimate_items_estimate_sort_idx
  on public.ai_estimate_items (estimate_id, sort_order);

alter table public.budget_templates enable row level security;
alter table public.budget_template_items enable row level security;
alter table public.ai_estimates enable row level security;
alter table public.ai_estimate_files enable row level security;
alter table public.ai_extracted_facts enable row level security;
alter table public.ai_estimate_items enable row level security;

drop policy if exists "members read budget templates" on public.budget_templates;
create policy "members read budget templates" on public.budget_templates
  for select using (
    organization_id is null
    or organization_id in (select public.current_user_orgs())
  );

drop policy if exists "admins manage budget templates" on public.budget_templates;
create policy "admins manage budget templates" on public.budget_templates
  for all using (
    organization_id in (select public.current_user_admin_orgs())
  )
  with check (
    organization_id in (select public.current_user_admin_orgs())
  );

drop policy if exists "members read budget template items" on public.budget_template_items;
create policy "members read budget template items" on public.budget_template_items
  for select using (
    exists (
      select 1
      from public.budget_templates t
      where t.id = budget_template_items.template_id
        and (
          t.organization_id is null
          or t.organization_id in (select public.current_user_orgs())
        )
    )
  );

drop policy if exists "admins manage budget template items" on public.budget_template_items;
create policy "admins manage budget template items" on public.budget_template_items
  for all using (
    exists (
      select 1
      from public.budget_templates t
      where t.id = budget_template_items.template_id
        and t.organization_id in (select public.current_user_admin_orgs())
    )
  )
  with check (
    exists (
      select 1
      from public.budget_templates t
      where t.id = budget_template_items.template_id
        and t.organization_id in (select public.current_user_admin_orgs())
    )
  );

drop policy if exists "members read ai estimates" on public.ai_estimates;
create policy "members read ai estimates" on public.ai_estimates
  for select using (organization_id in (select public.current_user_orgs()));

drop policy if exists "writers manage ai estimates" on public.ai_estimates;
create policy "writers manage ai estimates" on public.ai_estimates
  for all using (organization_id in (select public.current_user_writer_orgs()))
  with check (organization_id in (select public.current_user_writer_orgs()));

drop policy if exists "members read ai estimate files" on public.ai_estimate_files;
create policy "members read ai estimate files" on public.ai_estimate_files
  for select using (organization_id in (select public.current_user_orgs()));

drop policy if exists "writers manage ai estimate files" on public.ai_estimate_files;
create policy "writers manage ai estimate files" on public.ai_estimate_files
  for all using (organization_id in (select public.current_user_writer_orgs()))
  with check (organization_id in (select public.current_user_writer_orgs()));

drop policy if exists "members read ai extracted facts" on public.ai_extracted_facts;
create policy "members read ai extracted facts" on public.ai_extracted_facts
  for select using (organization_id in (select public.current_user_orgs()));

drop policy if exists "writers manage ai extracted facts" on public.ai_extracted_facts;
create policy "writers manage ai extracted facts" on public.ai_extracted_facts
  for all using (organization_id in (select public.current_user_writer_orgs()))
  with check (organization_id in (select public.current_user_writer_orgs()));

drop policy if exists "members read ai estimate items" on public.ai_estimate_items;
create policy "members read ai estimate items" on public.ai_estimate_items
  for select using (organization_id in (select public.current_user_orgs()));

drop policy if exists "writers manage ai estimate items" on public.ai_estimate_items;
create policy "writers manage ai estimate items" on public.ai_estimate_items
  for all using (organization_id in (select public.current_user_writer_orgs()))
  with check (organization_id in (select public.current_user_writer_orgs()));

drop policy if exists "members read export objects" on storage.objects;
create policy "members read export objects" on storage.objects
  for select using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] in (
      select org_id::text from public.current_user_orgs() as org_id
    )
  );

drop policy if exists "writers manage export objects" on storage.objects;
create policy "writers manage export objects" on storage.objects
  for all using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] in (
      select org_id::text from public.current_user_writer_orgs() as org_id
    )
  )
  with check (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] in (
      select org_id::text from public.current_user_writer_orgs() as org_id
    )
  );

drop trigger if exists on_budget_templates_touch_updated_at on public.budget_templates;
create trigger on_budget_templates_touch_updated_at
  before update on public.budget_templates
  for each row execute function public.touch_updated_at();

drop trigger if exists on_ai_estimates_touch_updated_at on public.ai_estimates;
create trigger on_ai_estimates_touch_updated_at
  before update on public.ai_estimates
  for each row execute function public.touch_updated_at();

insert into public.budget_templates (
  id,
  organization_id,
  name,
  description,
  source_label,
  base_area_m2,
  base_pool_area_m2,
  version,
  is_default
) values (
  '00000000-0000-4000-8000-000000000101',
  null,
  'Meu Viver - alto padrao residencial',
  'Template inicial baseado na planilha FER E MACIEL: residencia 424,56 m2 e piscina 24,31 m2.',
  'PLANILHA ORCAMENTARIA FER E MACIEL.xlsx',
  424.56,
  24.31,
  1,
  true
) on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  source_label = excluded.source_label,
  base_area_m2 = excluded.base_area_m2,
  base_pool_area_m2 = excluded.base_pool_area_m2,
  is_default = excluded.is_default,
  updated_at = now();

insert into public.budget_template_items (
  template_id,
  code,
  group_code,
  group_name,
  description,
  unit,
  unit_cost,
  default_quantity,
  quantity_rule,
  confidence_baseline,
  needs_review_default,
  source_notes,
  sort_order
) values
('00000000-0000-4000-8000-000000000101','1.1',1,'Comissoes de Venda','Corretagem / comissao comercial','VB',53494.56,1,'{"basis":"fixed","fallback":1}'::jsonb,0.55,true,'Item VB da planilha referência.',10),
('00000000-0000-4000-8000-000000000101','2.1',2,'INSS','Receita Federal / nota','VB',1949000,0.036,'{"basis":"contract_value_pct","fallback":0.036}'::jsonb,0.45,true,'Percentual fiscal precisa ser confirmado no contrato.',20),
('00000000-0000-4000-8000-000000000101','3.1',3,'Servicos PJ Engenharia','Administracao tecnica','VB',24000,1,'{"basis":"fixed","fallback":1}'::jsonb,0.68,true,'Valor base de administracao da planilha.',30),
('00000000-0000-4000-8000-000000000101','6.1',6,'Projetos Estruturais/ Arquitetonicos','Projeto hidraulico','VB',7000,1,'{"basis":"fixed","fallback":1}'::jsonb,0.5,true,'Projeto pode ou nao fazer parte do escopo.',60),
('00000000-0000-4000-8000-000000000101','6.2',6,'Projetos Estruturais/ Arquitetonicos','Projeto estrutural','VB',4500,1,'{"basis":"fixed","fallback":1}'::jsonb,0.5,true,'Projeto pode ou nao fazer parte do escopo.',61),
('00000000-0000-4000-8000-000000000101','8.1',8,'Mao de Obra Civil','Mao de obra civil principal','M2',880,424.56,'{"basis":"built_area_m2","factor":1,"fallback":424.56}'::jsonb,0.82,false,'Base direta por area construida.',80),
('00000000-0000-4000-8000-000000000101','8.3',8,'Mao de Obra Civil','Mao de obra armador','KG',2.5,12000,'{"basis":"structure_kg_estimate","fallback":12000}'::jsonb,0.45,true,'Estimativa estrutural exige projeto estrutural.',83),
('00000000-0000-4000-8000-000000000101','9.1',9,'Hidraulica - M.D.O','Mao de obra hidraulica','VB',40000,1,'{"basis":"fixed","fallback":1}'::jsonb,0.55,true,'Escopo depende de pontos hidrossanitarios.',90),
('00000000-0000-4000-8000-000000000101','10.1',10,'Eletrica - M.D.O','Mao de obra eletrica infra e acabamentos','VB',25000,1,'{"basis":"fixed","fallback":1}'::jsonb,0.55,true,'Escopo depende de pontos eletricos/luminotecnico.',100),
('00000000-0000-4000-8000-000000000101','11.1',11,'Revestimento Ceramico - M.D.O','Mao de obra revestimentos piso','M2',60,407.95,'{"basis":"floor_area_estimate","factor":1,"fallback":407.95}'::jsonb,0.64,true,'Area de piso estimada a partir da area construida.',111),
('00000000-0000-4000-8000-000000000101','11.2',11,'Revestimento Ceramico - M.D.O','Mao de obra revestimentos parede','M2',95,240,'{"basis":"wet_wall_area_estimate","fallback":240}'::jsonb,0.48,true,'Paredes molhadas dependem de detalhamento.',112),
('00000000-0000-4000-8000-000000000101','13.1',13,'Pintura - M.D.O','Mao de obra pintura','M2',180,424.56,'{"basis":"built_area_m2","factor":1,"fallback":424.56}'::jsonb,0.72,false,'Base parametrica por area construida.',131),
('00000000-0000-4000-8000-000000000101','16.1',16,'Servicos Iniciais','Barracao, tapume, ligacoes provisorias e locacao','VB',12000,1,'{"basis":"fixed","fallback":1}'::jsonb,0.58,true,'Canteiro deve ser ajustado ao lote.',160),
('00000000-0000-4000-8000-000000000101','20.1',20,'Fundacao Servicos Perfuracao','Perfuracao mecanizada de estacas','M',60,450,'{"basis":"foundation_meter_estimate","fallback":450}'::jsonb,0.38,true,'Exige sondagem e projeto estrutural.',201),
('00000000-0000-4000-8000-000000000101','21.3',21,'Estrutura - Material','Concretagem estacas','M3',600,45,'{"basis":"concrete_m3_estimate","fallback":45}'::jsonb,0.4,true,'Volume estrutural preliminar.',213),
('00000000-0000-4000-8000-000000000101','21.19',21,'Estrutura - Material','Aco e estrutura - verba base','VB',55141.72,1,'{"basis":"fixed","fallback":1}'::jsonb,0.42,true,'Verba de referência da planilha.',219),
('00000000-0000-4000-8000-000000000101','22.1',22,'Laje - Material','Laje e complementos','M2',85,423.34,'{"basis":"built_area_m2","factor":1,"fallback":423.34}'::jsonb,0.48,true,'Area de laje precisa de projeto estrutural.',221),
('00000000-0000-4000-8000-000000000101','23.1',23,'Alvenaria - Material','Tijolo 14x19x24','UNID',1.8,14000,'{"basis":"block_unit_estimate","fallback":14000}'::jsonb,0.42,true,'Quantidade depende da area de paredes.',231),
('00000000-0000-4000-8000-000000000101','23.2',23,'Alvenaria - Material','Argamassa de assentamento','SC',42,260,'{"basis":"masonry_bag_estimate","fallback":260}'::jsonb,0.44,true,'Quantidade vinculada a alvenaria.',232),
('00000000-0000-4000-8000-000000000101','24.2',24,'Reboco Interno/Externo Material','Argamassa reboco','M3',650,40,'{"basis":"render_m3_estimate","fallback":40}'::jsonb,0.45,true,'Area de reboco precisa ser medida.',242),
('00000000-0000-4000-8000-000000000101','26.1',26,'Calhas e Rufos','Calhas e rufos','VB',25000,1,'{"basis":"fixed","fallback":1}'::jsonb,0.52,true,'Depende da cobertura.',261),
('00000000-0000-4000-8000-000000000101','27.2',27,'Cobertura - Material','Telha sanduiche','M2',150,209,'{"basis":"roof_area_estimate","fallback":209}'::jsonb,0.62,true,'Area de cobertura estimada.',272),
('00000000-0000-4000-8000-000000000101','28.1',28,'Esquadrias - Material e M.D.O','Contramarcos e preparacao de esquadrias','VB',18000,1,'{"basis":"fixed","fallback":1}'::jsonb,0.38,true,'Esquadrias exigem tabela conferida.',281),
('00000000-0000-4000-8000-000000000101','30.1',30,'Marmore - Material e M.D.O','Peitoris e soleiras','VB',18000,1,'{"basis":"fixed","fallback":1}'::jsonb,0.35,true,'No memorial referencia parte de marmore pode ser contratante.',301),
('00000000-0000-4000-8000-000000000101','31.1',31,'Revestimento Ceramico - Material','Pisos e revestimentos - material','M2',140,407.95,'{"basis":"floor_area_estimate","fallback":407.95}'::jsonb,0.5,true,'Material depende de especificacao do cliente.',311),
('00000000-0000-4000-8000-000000000101','32.1',32,'Gesso','Forro interno e externo','M2',90,510,'{"basis":"ceiling_area_estimate","fallback":510}'::jsonb,0.56,true,'Area de forro estimada.',321),
('00000000-0000-4000-8000-000000000101','33.1',33,'Pintura - Material','Materiais de pintura','M2',100,424.56,'{"basis":"built_area_m2","factor":1,"fallback":424.56}'::jsonb,0.62,true,'Tinta pode ficar a cargo do contratante conforme memorial.',331),
('00000000-0000-4000-8000-000000000101','34.1',34,'Eletrica - Material','Estimativa materiais eletricos','M2',68,424.56,'{"basis":"built_area_m2","factor":1,"fallback":424.56}'::jsonb,0.57,true,'Estimativa por area ate projeto executivo.',341),
('00000000-0000-4000-8000-000000000101','35.1',35,'Hidraulica - Material','Estimativa materiais hidraulicos','M2',85,424.56,'{"basis":"built_area_m2","factor":1,"fallback":424.56}'::jsonb,0.57,true,'Estimativa por area ate projeto executivo.',351),
('00000000-0000-4000-8000-000000000101','36.1',36,'Piscinas - Material e M.D.O','Piscina - mao de obra e estrutura','M2',2600,24.31,'{"basis":"pool_area_m2","factor":1,"fallback":24.31}'::jsonb,0.75,false,'Base direta por area de piscina.',361),
('00000000-0000-4000-8000-000000000101','36.2',36,'Piscinas - Material e M.D.O','Casa de maquinas e equipamentos piscina','VB',7340,1,'{"basis":"has_pool_fixed","fallback":1}'::jsonb,0.45,true,'Verba depende do pacote de equipamentos.',362),
('00000000-0000-4000-8000-000000000101','38.1',38,'Maquinas e Equipamentos','Terraplanagem corte subsolo','VB',26000,1,'{"basis":"has_basement_fixed","fallback":1}'::jsonb,0.5,true,'Aplicar quando houver subsolo/corte relevante.',381),
('00000000-0000-4000-8000-000000000101','38.2',38,'Maquinas e Equipamentos','Terraplanagem acabamento subsolo','VB',6000,1,'{"basis":"has_basement_fixed","fallback":1}'::jsonb,0.5,true,'Aplicar quando houver subsolo/corte relevante.',382),
('00000000-0000-4000-8000-000000000101','40.1',40,'Servicos Complementares','Infra de ar condicionado','UNID',1800,9,'{"basis":"ac_points_estimate","fallback":9}'::jsonb,0.42,true,'Pontos de ar precisam ser definidos.',401),
('00000000-0000-4000-8000-000000000101','40.2',40,'Servicos Complementares','Impermeabilizacoes complementares','VB',12000,1,'{"basis":"fixed","fallback":1}'::jsonb,0.55,true,'Verba preliminar.',402),
('00000000-0000-4000-8000-000000000101','40.3',40,'Servicos Complementares','Limpeza final de obra','VB',1000,1,'{"basis":"fixed","fallback":1}'::jsonb,0.8,false,'Item padrao de fechamento.',403)
on conflict (template_id, code) do update set
  group_code = excluded.group_code,
  group_name = excluded.group_name,
  description = excluded.description,
  unit = excluded.unit,
  unit_cost = excluded.unit_cost,
  default_quantity = excluded.default_quantity,
  quantity_rule = excluded.quantity_rule,
  confidence_baseline = excluded.confidence_baseline,
  needs_review_default = excluded.needs_review_default,
  source_notes = excluded.source_notes,
  sort_order = excluded.sort_order;
