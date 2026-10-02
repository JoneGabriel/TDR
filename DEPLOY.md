# Deploy na VPS (Docker Compose)

Guia para colocar o TDR em produção numa VPS Linux com Docker. A VPS guarda só a **pasta de deploy** (`Dockerfile`, `docker-compose.yml`, `nginx/`, `scripts/` e o `.env`); o código do app é clonado do GitHub **dentro do build da imagem**. A stack sobe com `docker compose` e tem quatro serviços:

| Serviço | Imagem | Papel |
|---|---|---|
| `app` | build do `Dockerfile` (Node 22) | clona `GIT_REPO`/`GIT_BRANCH` do GitHub durante o build; servidor Express na porta interna 3000, usuário `node`, healthcheck em `/health` |
| `mongo` | `mongo:7` | banco com autenticação, dados no volume `mongo_data`, sem porta exposta na internet |
| `nginx` | `nginx:1.27-alpine` | portas 80/443, TLS, serve `public/` com cache e repassa o resto ao app |
| `certs-init` | `alpine/openssl` | gera um certificado autoassinado uma vez, para o HTTPS subir antes do Let's Encrypt |

O serviço `certbot` só roda sob demanda (`--profile certs`) e é usado pelo `scripts/domain.sh`.

## 1. Pré-requisitos

- Ubuntu 22.04/24.04 (ou Debian 12), 2 GB de RAM ou mais, portas 80 e 443 abertas.
- Docker Engine com o plugin Compose v2.24 ou mais novo:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
docker compose version
```

- Firewall (se usar ufw):

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
```

## 2. Instalação inicial

**2.1 Token do GitHub** (repositório privado): em GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens, crie um token restrito ao repositório `TDR` com permissão *Contents: Read-only*. Ele fica apenas no `.env` da VPS e é entregue ao build como *secret*: não aparece em camadas, histórico ou `docker inspect` da imagem. Nunca o coloque no `Dockerfile`.

**2.2 Pasta de deploy na VPS** (rode na sua máquina, dentro do projeto):

```bash
ssh usuario@IP-DA-VPS 'mkdir -p /opt/tdr'
scp -r Dockerfile docker-compose.yml .dockerignore .env.docker.example nginx scripts usuario@IP-DA-VPS:/opt/tdr/
```

(Clonar o repositório inteiro em `/opt/tdr` também funciona, mas não é necessário: o build não usa os arquivos locais.)

**2.3 Variáveis e subida** (na VPS):

```bash
cd /opt/tdr
cp .env.docker.example .env
nano .env        # GIT_TOKEN, API_GPT, CERTBOT_EMAIL, HOST...
# segredos fortes:
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
sed -i "s|^MONGO_PASSWORD=.*|MONGO_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')|" .env

docker compose up -d --build              # clona o GitHub, instala dependências e sobe tudo
docker compose ps                         # app, mongo e nginx "running"; certs-init "exited (0)"
curl -s http://127.0.0.1/health           # {"status":200,"content":"ok"}
docker compose logs app | head -3         # mostra "clonando ... com token"

# primeiro usuário do admin
docker compose exec app npm run create-admin -- admin 'SenhaForte123'
```

Regras do `.env`: formato `KEY=valor`, sem espaços em volta do `=`. A chave `GIT_TOKEN` precisa existir (vazia, se o repositório for público). Dentro do compose o app monta a URL do banco a partir de `MONGO_USER`/`MONGO_PASSWORD` (com escape de caracteres especiais), então não é preciso definir `URL_DB` no `.env` (se definir, ele é ignorado). A senha do Mongo é gravada no volume no primeiro `up`; trocar `MONGO_PASSWORD` depois exige recriar o volume (`docker compose down -v`, apaga o banco) ou mudar a senha dentro do Mongo com `db.changeUserPassword`.

Enquanto nenhum domínio foi configurado, o painel responde em `https://IP-DA-VPS/admin/login` com certificado autoassinado (aceite o aviso do navegador).

## 3. Domínios das lojas

Cada loja atende um ou mais domínios. O **painel é a fonte da verdade**: o que está ativo em `/admin/domain` é o que a VPS provisiona. Para cada domínio novo:

1. **DNS** (registrador): registros A de `@` e `www` apontando para o IP da VPS.
2. **Painel**: cadastre em `/admin/domain` o host exato que a loja atende (`loja.com`, `www.loja.com` ou os dois), apontando para a loja.
3. **Nada mais.** O cron abaixo roda `domain.sh sync` a cada 10 minutos: ele lê os domínios ativos do painel, confere se o DNS já aponta para a VPS, emite o certificado Let's Encrypt, gera `nginx/sites/<dominio>.conf` e recarrega o nginx uma vez. Domínios removidos ou desativados no painel têm o bloco removido no próximo ciclo.

```bash
crontab -e
*/10 * * * * cd /opt/tdr && ./scripts/domain.sh sync  >> /var/log/tdr-domains.log 2>&1
0 3 * * *    cd /opt/tdr && ./scripts/domain.sh renew >> /var/log/tdr-domains.log 2>&1
```

Para não esperar o cron: `./scripts/domain.sh sync` (ou `sync --dry-run` para só ver o plano). `./scripts/domain.sh list` mostra o que está configurado e a validade dos certificados.

Regras do `sync`:

- Com `loja.com` e `www.loja.com` cadastrados, os dois servem a loja. Com só um deles cadastrado, o outro entra no certificado (se o DNS dele também apontar para a VPS) e redireciona para o cadastrado. Assim nenhum visitante cai no certificado autoassinado.
- Um domínio cujo DNS ainda não aponta para a VPS fica em espera (aparece no log como "aguardando DNS") e não gasta tentativas do Let's Encrypt. Domínios atrás do proxy da Cloudflare também ficam em espera, porque resolvem para o IP da Cloudflare; para esses, use Cloudflare SSL "Full" com o catch-all autoassinado, ou `sync --no-dns-check` se a porta 80 estiver liberada até a origem.
- Se o certbot falhar para um domínio, o `sync` espera 1 hora antes de tentar o mesmo domínio de novo (o Let's Encrypt bloqueia o host após 5 validações falhas por hora). Os demais seguem normalmente.
- Blocos criados à mão com `domain.sh add` não são tocados nem removidos pelo `sync`.
- Limites do Let's Encrypt que importam com muitas lojas: 300 novos pedidos por conta a cada 3 horas e 5 falhas de validação por host por hora. O limite de 50 certificados por semana é por domínio registrado, então 50 lojas em 50 domínios diferentes não se afetam.

Modo manual (sem painel, para testes): `./scripts/domain.sh add loja.com [--to-www|--no-www|--staging]` e `./scripts/domain.sh remove loja.com [--delete-cert]`.

Cloudflare na frente: use o modo SSL "Full" ou "Full (strict)" e descomente `set_real_ip_from`/`real_ip_header CF-Connecting-IP` em `nginx/nginx.conf` para o cloaker e as métricas verem o IP do visitante.

Hosts sem bloco próprio caem no catch-all (`nginx/templates/default.conf.template`): na porta 80, `TDR_HTTP_MODE=app` serve o app e `redirect` redireciona para HTTPS (o desafio ACME e `/health` continuam respondendo nos dois modos); HTTPS usa o certificado autoassinado.

## 4. Atualizar o app

Faça o push para a branch `GIT_BRANCH` (padrão `main`) e, na VPS:

```bash
cd /opt/tdr && ./scripts/deploy.sh          # clone novo do GitHub + rebuild + troca do container + espera ficar saudável
./scripts/deploy.sh --restart               # só recria o container (mudou o .env), sem buscar código
```

O script passa um `CACHEBUST` novo para o build, o que invalida só o passo do `git clone`; o `npm ci` continua em cache enquanto `package.json`/`package-lock.json` não mudarem. Mongo e nginx não reiniciam. O nginx re-resolve o IP do container `app` pelo DNS do Docker, por isso o redeploy não gera 502. Para publicar outra branch, troque `GIT_BRANCH` no `.env` e rode o deploy.

Mudanças em `nginx/` ou nos scripts não vêm pelo build: copie os arquivos novos para `/opt/tdr` (mesmo `scp` do passo 2.2) e rode `docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload`.

## 5. Backup e restauração do banco

```bash
./scripts/backup-mongo.sh                   # backups/tdr-AAAA-MM-DD-HHMM.archive.gz (mantém 14)
# cron diário às 2h
0 2 * * * cd /opt/tdr && ./scripts/backup-mongo.sh >> /var/log/tdr-backup.log 2>&1
```

Restaurar (substitui as coleções do banco `TDR`):

```bash
docker compose exec -T mongo sh -c 'mongorestore --archive --gzip --drop -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' < backups/tdr-2026-10-01-0200.archive.gz
```

Copie a pasta `backups/` para fora da VPS (rclone, S3, scp) de tempos em tempos.

## 6. Migrar o banco atual (Atlas ou outro) para a VPS

```bash
# na máquina que alcança o banco atual
mongodump --uri "mongodb+srv://usuario:senha@cluster/TDR" --archive --gzip > tdr-atual.archive.gz
scp tdr-atual.archive.gz usuario@vps:/opt/tdr/backups/
# na VPS
docker compose exec -T mongo sh -c 'mongorestore --archive --gzip --drop --nsFrom "TDR.*" --nsTo "TDR.*" -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' < backups/tdr-atual.archive.gz
```

Para continuar no Atlas em vez do Mongo local: em `docker-compose.yml`, remova as linhas `MONGO_HOST:` e `MONGO_DB:` do bloco `environment` do serviço `app` e o `depends_on: mongo`, deixe `URL_DB` no `.env` e rode `docker compose up -d --build app`. O serviço `mongo` pode ficar parado ou ser removido do arquivo.

## 7. Operação e problemas comuns

```bash
docker compose ps                          # estado e healthchecks
docker compose logs -f app                 # log do Node
docker compose logs -f nginx               # acessos (host= e rt= no final de cada linha) e erros
docker compose exec nginx nginx -t         # testa a configuração
docker compose exec nginx nginx -s reload  # recarrega sem derrubar
docker compose exec -T mongo mongosh -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin TDR
```

- **`MongoParseError: Password contains unescaped characters`** (versões antes de out/2026): a URL era montada pelo compose sem escape. Atualize o código (`./scripts/deploy.sh`), que agora monta a URL no app com escape; ou use uma senha só com letras e números.
- **502 Bad Gateway**: o app está reiniciando ou sem saúde. Veja `docker compose logs app`. Causa comum: `JWT_SECRET` ausente ou `URL_DB` inválido.
- **Build falha no `git clone`** (`Authentication failed` ou `Repository not found`): `GIT_TOKEN` inválido, expirado ou sem acesso ao repositório; `GIT_BRANCH` inexistente. O log do build mostra `clonando ... sem token` quando a variável está vazia.
- **Certificado não emite**: veja `/var/log/tdr-domains.log`. "aguardando DNS" = o registro A ainda não aponta para a VPS; erro do certbot = porta 80 fechada no firewall ou no provedor, ou Cloudflare com proxy. Teste com `curl http://loja.com/.well-known/acme-challenge/teste` (deve responder 404 do nginx, não erro de conexão). Após uma falha o `sync` espera 1 hora para aquele domínio; apague `nginx/sites/.sync-state/<dominio>.failed` para tentar antes.
- **Cookie do admin não gruda**: o cookie é `Secure` quando a requisição chega como HTTPS. Acesse o admin por `https://`.
- **Visitante sempre liberado/filtrado errado**: confira `ENV=PROD` no `.env` e que o nginx está enviando `X-Forwarded-For` (`nginx/snippets/proxy.conf`); o app usa `trust proxy`.
- **Upload de imagem grande falha**: `client_max_body_size 200m` em `nginx/nginx.conf`; o app aceita JSON até 200 MB.
