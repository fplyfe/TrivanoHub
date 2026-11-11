# Colocar o TrivanoHub online numa VPS

Resultado: o app em `https://seu-dominio`, com HTTPS automático, banco PostgreSQL no próprio servidor e backup diário. Tempo: cerca de 30 minutos.

## 1. Contratar

| O quê | Recomendação | Custo aproximado |
| --- | --- | --- |
| VPS | Ubuntu 24.04, 2 vCPU, 4 GB de RAM, 40 GB de disco | R$ 30 a 40/mês |
| Domínio | `trivano.com.br` no registro.br (ou use um subdomínio de um domínio que já tenha) | ~R$ 40/ano |

Não precisa contratar banco de dados, e-mail nem painel de hospedagem: o PostgreSQL roda dentro do Docker.

## 2. Apontar o domínio

No painel DNS do domínio, crie um registro **A**:

| Tipo | Nome | Valor |
| --- | --- | --- |
| A | `hub` (para `hub.trivano.com.br`) ou `@` (para o domínio raiz) | IP da VPS |

A propagação leva de minutos a algumas horas. O HTTPS só funciona depois disso.

## 3. Entrar na VPS

No PowerShell do Windows:

```powershell
ssh root@IP_DA_VPS
```

## 4. Baixar o código do GitHub

O repositório é privado, então a VPS precisa de uma chave de leitura (deploy key):

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

Copie a linha que aparecer e cole em **GitHub → TrivanoHub → Settings → Deploy keys → Add deploy key** (deixe "Allow write access" desmarcado). Depois:

```bash
git clone git@github.com:fplyfe/TrivanoHub.git /opt/trivanohub
cd /opt/trivanohub
```

## 5. Instalar e subir

```bash
sudo bash scripts/instalar-vps.sh
```

O script instala Docker, firewall (só portas 22, 80 e 443), atualizações automáticas de segurança e swap se faltar memória. Depois pergunta o domínio e o administrador, gera uma senha forte, sobe tudo e mostra o acesso.

Acesse `https://seu-dominio`, entre como administrador, **troque a senha** em Configurações e crie os outros usuários em **Usuários**. Depois apague o arquivo de logins: `rm /opt/trivanohub/LOGINS.txt`.

## Dia a dia

| Tarefa | Comando (na pasta `/opt/trivanohub`) |
| --- | --- |
| Atualizar para a versão mais nova do GitHub | automático com GitHub Actions (abaixo) ou `bash scripts/atualizar.sh` |
| Backup imediato | `bash scripts/backup-agora.sh` |
| Restaurar o backup mais recente | `bash scripts/restaurar.sh` |
| Ver se está tudo rodando | `docker compose -f docker-compose.yml -f docker-compose.vps.yml ps` |
| Ver erros do app | `docker compose -f docker-compose.yml -f docker-compose.vps.yml logs -f app` |

## Deploy automático (GitHub Actions)

Depois que a VPS estiver instalada (passos acima), cada push na `main` atualiza o site sozinho: o GitHub confere o código (tipos, testes e build) e, se tudo passar, entra na VPS e roda `scripts/atualizar.sh`. Se algo quebrar, o deploy não acontece e o site continua na versão anterior. O andamento aparece na aba **Actions** do repositório.

Configuração (uma vez só):

1. No PC, crie uma chave só para o deploy (sem senha, aperte Enter quando perguntar):
   ```powershell
   ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\trivano_deploy -C "github-actions"
   ```
2. Autorize essa chave na VPS:
   ```powershell
   type $env:USERPROFILE\.ssh\trivano_deploy.pub | ssh root@IP_DA_VPS "cat >> ~/.ssh/authorized_keys"
   ```
3. No GitHub, abra o repositório → **Settings → Secrets and variables → Actions → New repository secret** e crie:

   | Nome | Valor |
   | --- | --- |
   | `VPS_HOST` | IP da VPS |
   | `VPS_USER` | `root` (ou o usuário que você usa) |
   | `VPS_SSH_KEY` | conteúdo inteiro de `trivano_deploy` (a chave **sem** `.pub`) |
   | `VPS_PORT` | opcional, só se o SSH não for na porta 22 |
   | `VPS_APP_DIR` | opcional, só se o projeto não estiver em `/opt/trivanohub` |

4. Teste: aba **Actions → Deploy → Run workflow**. Ao final aparece "site no ar".

Enquanto `VPS_HOST` não existir, a Action só verifica o código e pula o deploy, sem dar erro.

## Backup fora do servidor

O backup automático (todo dia às 03:00; guarda 7 diários, 4 semanais e 6 mensais) fica em `/opt/trivanohub/backups`, **no mesmo servidor**. Se a VPS for perdida, ele vai junto. Copie para o seu PC, de preferência numa pasta do OneDrive:

```powershell
.\scripts\baixar-backups.ps1 -Servidor IP_DA_VPS -Usuario root
```

Agende esse comando no Agendador de Tarefas do Windows para rodar todo dia, e teste uma restauração ao menos uma vez.

## Segurança (recomendado)

- Entrar no SSH com chave em vez de senha: no PC, `ssh-keygen` e depois `type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@IP "cat >> ~/.ssh/authorized_keys"`. Depois, em `/etc/ssh/sshd_config`, defina `PasswordAuthentication no` e rode `systemctl restart ssh`.
- Monitor grátis de disponibilidade (ex.: UptimeRobot) apontando para `https://seu-dominio/api/health`, para receber um e-mail se o app cair.
