# Supabase

Esta pasta versiona o schema esperado do projeto Obralia.

## Aplicacao

As migrations devem ser aplicadas pelo Supabase CLI ou pelo SQL Editor do projeto antes de considerar o ambiente reproduzivel.

```bash
npx supabase link --project-ref bhhscygbhaqyewejlgug
npx supabase db push
```

## RLS

As policies usam funcoes `security definer` para consultar membros e evitar recursao em `organization_members`. Isso corrige o padrao que fazia consultas em `profiles` dependerem diretamente de policies recursivas.

## Buckets

A migration cria os buckets privados `media`, `avatars` e `exports`.

- `media`: caminho `organization_id/...`
- `exports`: caminho `organization_id/...`
- `avatars`: caminho `profile_id/...`
