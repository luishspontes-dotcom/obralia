# Obralia — App iOS (campo)

App de campo do Obralia: **RDO do dia + fotos com GPS, com modo offline** (salva no aparelho e sincroniza sozinho quando o sinal volta). Feito em Expo / React Native, falando com o mesmo Supabase do Obralia web — mesmas contas, mesmas permissões (RLS), mesmos dados.

**Pronto pra SaaS:** o app não tem nada amarrado à Meu Viver. Ele usa a chave publicável + RLS, então cada usuário só enxerga as obras da própria construtora. Quando o Obralia virar SaaS, o mesmo binário serve todas as organizações.

## Rodar no simulador (primeiro teste)

```bash
cd obralia-app
npm install
npx expo install --fix   # alinha versões nativas do SDK
npx expo start           # tecla "i" abre o simulador iOS
```

Login: qualquer usuário do Obralia com senha definida (ex.: o seu).

## Estrutura

```
app/(auth)/login.tsx        # login por e-mail/senha + esqueci senha
app/(app)/obras.tsx         # lista de obras (filtrada pela RLS)
app/(app)/obra/[id]/        # detalhe, RDO do dia, fotos
lib/supabase.ts             # cliente (chave publicável — segura no app)
lib/outbox.ts               # fila offline: RDO/fotos aguardam sinal
components/ui.tsx           # primitivas com os tokens do design system
```

Como o app grava:
- **RDO** → RPC `create_daily_report` (mesma porta do web, numeração e permissão no banco) + inserts em `report_activities` / `report_workforce` / `report_equipment`.
- **Fotos** → bucket `media`, path `{site_id}/{arquivo}.jpg` (mesma convenção do web) + linha na tabela `media` com GPS.

## Publicar na App Store

Pré-requisitos (uma vez só): conta [Apple Developer](https://developer.apple.com) (US$ 99/ano) e conta [Expo/EAS](https://expo.dev) (grátis).

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile production   # build na nuvem, não precisa de Xcode
eas submit --platform ios                        # envia pra App Store Connect
```

No App Store Connect, preencher: nome (Obralia), categoria (Business), política de privacidade (`https://www.obralia.com.br/privacidade`), screenshots (o simulador gera com `Cmd+S`). A review da Apple leva 1–3 dias.

**Dica:** antes da review pública, use `eas build --profile preview` pra gerar um build interno e testar no seu iPhone via TestFlight.

## Roadmap SaaS (quando chegar a hora)

- Seletor de organização no topo (o schema multi-tenant já suporta — só UI).
- Push notifications (RDO pendente do dia, aprovações) via `expo-notifications`.
- Billing: assinatura por organização no backend (Stripe) — nada muda no app.
