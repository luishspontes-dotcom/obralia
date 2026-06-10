# Template de e-mail de convite — Obralia

O convite enviado pela página **/usuarios** (botão "✉ Convidar") e pelo formulário
"Convidar usuário" usa o `supabase.auth.signInWithOtp`, ou seja: **o e-mail que
chega é o template "Magic Link" do Supabase**.

## Onde colar

1. Abra o dashboard do Supabase do projeto Obralia.
2. Vá em **Authentication → Email Templates → Magic Link**.
3. Em **Subject heading**, cole o assunto abaixo.
4. Em **Message body**, troque o conteúdo pelo HTML abaixo.
5. Salve. Não precisa de deploy — vale na hora para os próximos convites.

> Importante: mantenha o `{{ .ConfirmationURL }}` exatamente como está — é a
> variável que o Supabase substitui pelo link mágico de acesso.

## Assunto

```
Seu acesso ao Obralia — o novo sistema da Meu Viver
```

## Corpo (HTML)

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f1ea;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;border:1px solid #e6e0d4;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <!-- Cabeçalho -->
        <tr>
          <td style="background-color:#2f4f4e;padding:28px 32px;">
            <span style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">Obralia</span>
            <span style="font-size:12px;color:#bcd0cf;display:block;margin-top:4px;">Gestão de obras da Meu Viver</span>
          </td>
        </tr>

        <!-- Conteúdo -->
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;color:#2b2b2b;">Você foi convidado para o Obralia</h1>

            <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#444444;">
              Olá! A <strong>Meu Viver</strong> substituiu o antigo <strong>Diário de Obra</strong> pelo
              <strong>Obralia</strong> (<a href="https://www.obralia.com.br" style="color:#2f4f4e;">www.obralia.com.br</a>),
              o novo sistema de acompanhamento de obras: relatórios diários, fotos, medições e
              andamento da sua obra, tudo em um lugar só.
            </p>

            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#444444;">
              Sua conta já está preparada. É só clicar no botão abaixo para entrar —
              não precisa de senha neste primeiro acesso:
            </p>

            <!-- Botão -->
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px;">
              <tr>
                <td style="background-color:#2f4f4e;border-radius:8px;">
                  <a href="{{ .ConfirmationURL }}"
                     style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">
                    Acessar minha conta
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#666666;">
              <strong>Depois de entrar:</strong> vá em <strong>Configurações</strong> e defina uma senha.
              Assim, nos próximos acessos você entra direto com e-mail e senha, sem depender de link por e-mail.
            </p>

            <p style="margin:0;font-size:12px;line-height:1.6;color:#999999;">
              O link acima é pessoal e expira por segurança. Se ele expirar, peça um novo convite
              ou use "Esqueci minha senha" na tela de login. Se você não esperava este e-mail,
              pode ignorá-lo com tranquilidade.
            </p>
          </td>
        </tr>

        <!-- Rodapé -->
        <tr>
          <td style="background-color:#faf8f3;border-top:1px solid #e6e0d4;padding:18px 32px;">
            <p style="margin:0;font-size:11px;color:#999999;line-height:1.5;">
              Obralia · Meu Viver Construções —
              <a href="https://www.obralia.com.br" style="color:#2f4f4e;">www.obralia.com.br</a><br />
              Este é um e-mail automático de acesso; não é necessário responder.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

## Como o fluxo funciona (resumo técnico)

1. Admin clica **✉ Convidar** num contato (ou usa o formulário "Convidar usuário").
2. O servidor grava/renova a linha em `pending_invites` (org, e-mail, papel, quem convidou)
   e dispara `signInWithOtp` com `shouldCreateUser: true` — é isso que envia este e-mail.
3. A pessoa clica em **Acessar minha conta** → cai em `/auth/callback`, que troca o código
   por sessão e chama `consume_pending_invites`, vinculando o usuário à organização no
   papel definido (admin → Admin, equipe → Engenheiro, cliente → Visualizador).
4. Na página /usuarios o contato sai de "Aguardando convite" e passa a aparecer em
   **Com acesso**, com o cargo vindo da agenda de contatos.
