# Notificações (RF10)

**Situação:** avisos chegam pela caixa de entrada do app, por push (Expo) e por e-mail, só com opt-in explícito. WhatsApp ficou para a Fase 2 (desejável).
**Falta para o push funcionar no celular:** criar o projeto no EAS e gerar um build de desenvolvimento ([passo a passo](#push-projeto-no-eas-e-build-de-desenvolvimento)).
**Falta para o e-mail em produção:** a liga registrar o domínio e autenticá-lo no Brevo. Até lá, o Brevo só é usado em testes locais com um remetente de e-mail gratuito ([Remetente e domínio](#remetente-e-domínio), [Testar o Brevo localmente](#testar-o-brevo-localmente)).

## Regras

| Regra | Onde está |
|---|---|
| Canais (push, e-mail) e assuntos (campanhas, eventos, comunicados) nascem desligados. | `Preferences` em `backend/engagement/models.py` |
| Contas que já existiam voltaram a canais desligados; os assuntos delas ficaram como estavam, para a caixa de entrada não esvaziar. Avisos já exibidos contam como disparados e não saem por push nem e-mail. | migração `engagement/0002_avisos_opt_in_e_envios.py` |
| A caixa de entrada não é canal de envio: mostra os avisos publicados para a região (todo o país, o estado ou a cidade) nos assuntos escolhidos. | `notices_for` em `backend/engagement/services.py` |
| Push só liga com um aparelho registrado (o sistema pediu permissão). E-mail só liga com o endereço confirmado por código de 6 dígitos; trocar o e-mail desliga o canal. | `PreferencesSerializer` em `backend/engagement/views.py` |
| Todo e-mail de aviso tem o link "parar de receber" e os cabeçalhos `List-Unsubscribe` (descadastro em um clique no Gmail e no Outlook). O link pede confirmação antes de desligar, para leitores de link não desligarem por engano. | `GET/POST /api/v1/avisos/sair/<token>/` |
| Push e e-mail só saem das 8h às 21h (Brasília). Fora disso, esperam a próxima janela. Aviso com data de disparo de mais de 2 dias atrás fica só na caixa de entrada. | `backend/engagement/tasks.py` |
| Cada envio vira um registro `NotificationDelivery` (único por aviso, pessoa e canal), então o mesmo aviso nunca sai duas vezes. | `backend/engagement/models.py` |
| Envio que falha (Expo ou SMTP fora do ar, recusa temporária) volta para a fila e é tentado de novo no disparo seguinte, até 3 vezes (`NOTIFY_MAX_ATTEMPTS`). Pendentes e falhas de aviso com mais de 2 dias viram "ignorado" ("Expirou na fila"). | `deliver` em `backend/engagement/tasks.py` |
| Push só fica "enviado" de verdade depois do recibo. O ticket da Expo quer dizer apenas "recebi"; uns 15 minutos depois, o recibo diz se a Apple ou o Google aceitaram. Com ao menos um aparelho aceito, o envio continua "enviado". Se todos falharem, vira "falhou" com o motivo e volta para a fila. Tokens recusados (`DeviceNotRegistered`, `BadDeviceToken`) são apagados, e aí a nova tentativa termina como "ignorado". Recibo que não chega em 24 horas fica anotado como "entrega não confirmada". | `check_receipts` em `backend/engagement/tasks.py` |
| E-mail respeita a cota diária do provedor (`EMAIL_DAILY_LIMIT`, dia de Brasília). A cota soma avisos e códigos de 6 dígitos; `EMAIL_DAILY_RESERVE` fica guardado para os códigos. O que não cabe no dia fica pendente e sai a partir das 8h do dia seguinte. | `email_budget` em `backend/engagement/tasks.py` |
| No painel, qualquer pessoa da equipe cria rascunhos. Publicar, alterar um aviso publicado e despublicar são só para Admin e Administrador de conteúdo. A origem oficial é obrigatória para publicar. | `StaffNotificationViewSet` em `backend/catalog/staff.py` |
| O painel mostra o alcance só em contagens (caixa de entrada, celular, e-mail), sem nomes. | `GET /api/v1/staff/notifications/alcance/` |
| A lista de avisos do painel mostra alertas sobre as últimas 24 horas de envio: credenciais de push com problema (`InvalidCredentials`: falta a chave FCM ou APNs no EAS), SMTP fora do ar, metade ou mais das tentativas falhando num canal (a partir de 5 tentativas) e cota diária de e-mail esgotada com e-mails esperando. Cada envio guarda um código curto do erro (`error_code`) para o agrupamento. Só contagens, sem nomes. | `backend/engagement/health.py`, `GET /api/v1/staff/notifications/saude/` |
| Convidado: o contato é opcional (decisão de 24/11/2026, no lugar da decisão 5 do plano, que previa push e e-mail para todo convidado). Com e-mail ou telefone, o convidado cria conta e pode ligar push e e-mail como os outros perfis. Sem contato, não há conta: nenhum canal de envio, e a caixa de entrada mostra só a lista de exemplo do app (`INBOX` em `mobile/src/content/insights.ts`), não os avisos publicados. | `mobile/src/app/convidado.tsx` |
| A tela de conclusão do cadastro mostra o estado real dos avisos, lido em `/me/preferences/`: "Avisos ativados: celular e e-mail", "Confirme seu e-mail…" ou "Ative avisos de campanhas em Perfil › Notificações". | `mobile/src/app/conclusion.tsx` |

## Fluxo

1. **Cadastro.** Doador e receptor passam pela etapa "Quer receber avisos?" (`mobile/src/app/avisos.tsx`), entre Localização e Revisão. O convidado escolhe na própria tela, se informar um contato; sem contato, segue sem conta e sem canais de envio.
2. **Depois do cadastro.** Se a pessoa escolheu push, o app pede a permissão do sistema, registra o token (`POST /me/push-tokens/`) e liga o canal. Se escolheu e-mail, o backend envia o código e a tela de conclusão pede para digitá-lo (ou "Confirmar depois").
3. **Preferências** (Perfil › Notificações). Liga e desliga canais e assuntos. Ligar o e-mail sem confirmação envia um novo código. Contas sem nenhum canal ligado veem o convite "Ative avisos de campanhas perto de você" na Início.
4. **Painel** (Notificações). A equipe cria o aviso e vê o alcance. Quem pode publica. Aviso já disparado fica só leitura, com a contagem de envios.
5. **Disparo.** O `celery-beat` roda `engagement.tasks.dispatch_due` a cada 5 minutos. A tarefa pega os avisos publicados com data de disparo vencida e envia o push em lotes de 100 para a Expo e o e-mail pelo SMTP.
6. **Recibos do push.** A cada 15 minutos, `engagement.tasks.check_receipts_due` consulta na Expo (`/push/getReceipts`, lotes de 1.000) os recibos dos pushes enviados há mais de 15 minutos e atualiza cada envio. Um `InvalidCredentials` no recibo quer dizer que faltam ou estão erradas as credenciais do Firebase ou da Apple no EAS, e afeta todos os envios daquele sistema.
7. **Logout.** O app apaga o token do aparelho (`DELETE /me/push-tokens/`). Sem nenhum aparelho, o canal push volta a desligado.

## Rodando localmente

```bash
docker compose up -d --build celery-beat celery-worker api   # beat é um serviço novo
```

- O e-mail vai para o Mailpit: <http://localhost:8025>.
- Para disparar sem esperar os 5 minutos: `docker compose exec api python manage.py shell -c "from engagement.tasks import dispatch_due; dispatch_due()"`.
- Mantenha **uma única** instância do `celery-beat`. Duas enfileirariam o disparo em dobro. O disparo continua idempotente, mas o trabalho dobraria.

## Push: projeto no EAS e build de desenvolvimento

O push do Expo exige um `projectId` do EAS e não funciona no Expo Go no Android desde o SDK 53. Sem `projectId`, o app esconde a opção ("Disponível no aplicativo instalado") e nem pede permissão.

1. Entre na conta Expo da liga: `cd mobile && npx eas-cli@latest login`.
2. Crie o projeto: `npx eas-cli@latest init`. Ele grava `extra.eas.projectId` no `app.json`. Como o projeto também tem `app.config.ts`, se o comando pedir, adicione à mão no `app.json`:
   ```json
   "extra": { "eas": { "projectId": "<id mostrado pelo eas init>" } }
   ```
3. Credenciais de push:
   - **Android:** crie um projeto no Firebase, baixe o `google-services.json`, aponte `android.googleServicesFile` no `app.json` e envie a chave FCM v1 com `npx eas-cli@latest credentials` (Android › Push Notifications: FCM V1).
   - **iOS:** precisa de conta paga no Apple Developer. O `eas build` cria a chave APNs quando você aceita o pedido.
4. Gere o build de desenvolvimento: `npx eas-cli@latest build --profile development --platform android` (ou `ios`), instale no aparelho e rode `npx expo start --dev-client`.
5. Teste: no app, Perfil › Notificações › Notificações no celular. Publique um aviso no painel para a sua região e rode o disparo manual (veja acima). Também dá para testar só o token na [ferramenta de push da Expo](https://expo.dev/notifications).
6. Opcional: se ativar "Enhanced Security for Push Notifications" no projeto do EAS, crie um access token e defina `EXPO_ACCESS_TOKEN` no `.env` do backend.

O ícone de notificação no Android usa o ícone do app tingido de `#3C72CC` (plugin `expo-notifications` no `app.json`). Para um ícone próprio, adicione um PNG branco com transparência de 96×96 em `icon` no plugin.

## E-mail em produção: Brevo (plano grátis)

O envio usa SMTP, então trocar de provedor é só trocar as variáveis. Em produção, o provedor é o [Brevo](https://www.brevo.com/), no plano grátis.

**O que o plano grátis dá** (conferido em 23/11/2026):

- 300 e-mails por dia, somando códigos de 6 dígitos, avisos e e-mails da equipe. A cota zera todo dia e não acumula.
- Sem cartão e sem prazo de validade.
- Servidores na União Europeia. Cite o Brevo como operador nos termos de uso e no TCLE (LGPD, transferência internacional).
- O Brevo põe a marca dele ("Sent with Brevo") nos e-mails do plano grátis, e não dá para tirar. A documentação não deixa claro se isso vale também para o SMTP. Confira no primeiro teste (passo 5). Para tirar, é preciso o plano Starter com o complemento "Remover logo" ou um plano Standard.

**Passo a passo:**

1. Crie a conta em <https://www.brevo.com/> com o e-mail da liga.
2. Em **Remetentes, Domínios e IPs dedicados**, autentique o domínio de envio. O passo a passo está em [Remetente e domínio](#remetente-e-domínio). Sem domínio próprio, dá para verificar só um endereço remetente, mas os e-mails tendem a cair no spam.
3. Em **SMTP & API › SMTP**, gere uma chave SMTP e anote o login SMTP mostrado na mesma tela. São eles que vão no `.env`, não o e-mail e a senha da conta.
4. Preencha o `.env` do servidor. Nada disso vai para o repositório.

   ```env
   EMAIL_HOST=smtp-relay.brevo.com
   EMAIL_PORT=587
   EMAIL_USE_TLS=1
   EMAIL_HOST_USER=<login SMTP do Brevo>
   EMAIL_HOST_PASSWORD=<chave SMTP do Brevo>
   DEFAULT_FROM_EMAIL=STEM Project <avisos@dominio-da-liga>
   EMAIL_DAILY_LIMIT=300
   EMAIL_DAILY_RESERVE=50
   PUBLIC_API_URL=https://api.dominio-da-liga
   ```

   `DEFAULT_FROM_EMAIL` precisa usar o domínio (ou o endereço) verificado no passo 2. `PUBLIC_API_URL` é o endereço público da API, usado no link "parar de receber".
5. Recrie os serviços que mandam e-mail (`docker compose up -d --build api celery-worker celery-beat`), peça um código de confirmação de e-mail pelo app e confira a chegada, o remetente e se o selo do Brevo aparece.

**Com a cota de 300 por dia:** 50 ficam guardados para os códigos e até 250 vão para avisos. Um aviso para mais gente do que cabe no dia sai em partes, a partir das 8h dos dias seguintes. O que não sair em 2 dias vira "ignorado", e o painel mostra a contagem por situação. Quando o volume passar disso, os caminhos são um plano pago do Brevo ou o Amazon SES (por volta de US$ 0,16 por mil e-mails), trocando só as variáveis.

## Remetente e domínio

**Situação (23/11/2026):** a liga vai registrar um domínio próprio. Até lá, o Brevo tem só um remetente verificado com endereço de e-mail gratuito (iCloud), usado **apenas para testes locais**. Nada de aviso para usuários reais com esse remetente.

**Por que o e-mail gratuito não serve para produção.** A tela **Remetentes** do Brevo mostra dois alertas para ele:

| Alerta no Brevo | O que significa |
|---|---|
| Assinatura DKIM: "Padrão" | O DKIM é a assinatura que prova quem enviou. O Brevo não controla o DNS do `icloud.com` (é da Apple), então assina com uma assinatura genérica dele. |
| DMARC: "O domínio Freemail não é recomendado" | O e-mail diz vir do `icloud.com`, mas sai dos servidores do Brevo. Google, Yahoo e Microsoft conferem isso pelo DMARC e, pelas regras atuais para remetentes, mandam para o spam ou recusam. |

Isso vale para qualquer provedor gratuito (Gmail, Hotmail, Outlook, iCloud). Não é erro de configuração.

**Quando o domínio for registrado:**

1. No Brevo, em **Remetentes, Domínios e IPs dedicados › Domínios**, adicione o domínio (ou um subdomínio, como `avisos.dominio-da-liga.com.br`).
2. Publique no DNS do domínio os registros que o Brevo mostrar: código de verificação, SPF, DKIM e DMARC. Clique em "Autenticar" até todos ficarem verdes.
3. Em **Remetentes**, adicione o remetente do app, por exemplo `STEM Project <avisos@dominio-da-liga.com.br>`, e apague o remetente de teste com e-mail gratuito.
4. Troque `DEFAULT_FROM_EMAIL` no `.env` do servidor para esse endereço e recrie `api`, `celery-worker` e `celery-beat`.
5. Mande um aviso de teste para uma conta Gmail e confira, em "Mostrar original", que SPF, DKIM e DMARC aparecem como `PASS`.

O endereço não precisa ter caixa de entrada, mas algumas pessoas vão responder aos avisos. Vale usar um endereço que alguém da liga leia.

## Testar o Brevo localmente

Por padrão, o e-mail local cai no Mailpit (<http://localhost:8025>). Para mandar de verdade pelo Brevo a partir da sua máquina:

1. No `.env` da raiz (fora do git), preencha:

   ```env
   STEM_DEV_EMAIL_HOST=smtp-relay.brevo.com
   STEM_DEV_EMAIL_PORT=587
   EMAIL_USE_TLS=1
   EMAIL_HOST_USER=<login SMTP do Brevo>
   EMAIL_HOST_PASSWORD=<chave SMTP do Brevo>
   DEFAULT_FROM_EMAIL=Teste STEM <seu-email-verificado-no-brevo>
   ```

   `STEM_DEV_EMAIL_HOST` e `STEM_DEV_EMAIL_PORT` só existem no `compose.override.yaml` (desenvolvimento). Sem elas, tudo volta para o Mailpit. `DEFAULT_FROM_EMAIL` precisa ser o remetente verificado em **Remetentes**.
2. Recrie os serviços que mandam e-mail: `docker compose up -d api celery-worker`.
3. No app, cadastre uma conta com o seu próprio e-mail e ligue "E-mail" na etapa de avisos, ou peça "Esqueci a senha". O código deve chegar pelo Brevo. Confira o remetente, a caixa (entrada ou spam) e se aparece o selo "Sent with Brevo".
4. Para testar um aviso: publique um aviso no painel para a sua região e rode o disparo na hora, dentro da janela das 8h às 21h:

   ```bash
   docker compose exec api python manage.py shell -c "from engagement.tasks import dispatch_due; dispatch_due()"
   ```

   O link "parar de receber" aponta para `PUBLIC_API_URL` (`http://localhost:8000`), então só funciona no computador onde a API está rodando.
5. Ao terminar, apague ou esvazie as duas variáveis `STEM_DEV_EMAIL_*` e recrie os serviços para voltar ao Mailpit.

Com o remetente de e-mail gratuito, é normal o teste cair no spam (ver [Remetente e domínio](#remetente-e-domínio)). Mande só para endereços seus.

## O que não entrou

- **WhatsApp:** Fase 2. A linha aparece desligada nas Preferências ("Em breve").
- **Doador localizado (tipo 4):** só com a integração oficial do SUS (RF15).
