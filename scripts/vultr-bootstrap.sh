#!/usr/bin/env bash
# Vultr 인스턴스 1회 프로비저닝 — Ubuntu 22.04 LTS 기준, 멱등(재실행 안전).
#
#   ssh root@<VULTR_IP>
#   curl -fsSL https://raw.githubusercontent.com/kimk1029/pokefesta30/main/scripts/vultr-bootstrap.sh | bash
#   (또는 저장소를 먼저 클론했다면: bash scripts/vultr-bootstrap.sh)
#
# 이 스크립트가 끝나면 .github/workflows/deploy-server.yml 의 `vultr` 대상이
# 그대로 붙는다 — 이후 배포는 main push 만으로 자동.
#
# 끝난 뒤 할 일 (스크립트가 안 하는 것):
#   1. server/.env 채우기 (또는 GitHub Secret VULTR_SERVER_ENV / SERVER_ENV 사용)
#   2. Caddyfile 의 도메인 교체 후 `systemctl reload caddy`
#   3. GitHub Secrets 에 VULTR_SSH_HOST / VULTR_SSH_USER / VULTR_SSH_KEY 등록
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/kimk1029/pokefesta30.git}"
DEPLOY_DIR="${DEPLOY_DIR:-/root/dev/pokefesta30}"
NODE_VERSION="${NODE_VERSION:-22}"

log() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

log "1/7 시스템 패키지"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
# psmisc = fuser (배포 스크립트의 :3030 정리), iproute2 = ss
# build-essential/python3 = sharp·tesseract 네이티브 빌드 및 PaddleOCR 사이드카
apt-get install -y --no-install-recommends \
  git curl ca-certificates build-essential pkg-config \
  psmisc iproute2 net-tools ufw \
  python3 python3-pip python3-venv

log "2/7 nvm + Node ${NODE_VERSION}"
# 배포 워크플로가 `. $HOME/.nvm/nvm.sh` 를 전제하므로 apt node 가 아니라 nvm 을 쓴다.
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install "$NODE_VERSION"
nvm alias default "$NODE_VERSION"
node -v && npm -v

log "3/7 pm2"
npm install -g pm2
# 재부팅 후 자동 기동. pm2 가 뱉는 systemd 유닛을 그대로 설치한다.
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

log "4/7 저장소 클론"
mkdir -p "$(dirname "$DEPLOY_DIR")"
if [ -d "$DEPLOY_DIR/.git" ]; then
  git -C "$DEPLOY_DIR" fetch origin main && git -C "$DEPLOY_DIR" reset --hard origin/main
else
  git clone "$REPO_URL" "$DEPLOY_DIR"
fi

log "5/7 Caddy (TLS 종료 + :3030 리버스 프록시)"
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y && apt-get install -y caddy
fi
if [ ! -f /etc/caddy/Caddyfile.pokefesta30-installed ]; then
  cp "$DEPLOY_DIR/scripts/Caddyfile.example" /etc/caddy/Caddyfile
  touch /etc/caddy/Caddyfile.pokefesta30-installed
  echo "  → /etc/caddy/Caddyfile 설치됨. 도메인을 실제 값으로 바꾼 뒤 'systemctl reload caddy'"
else
  echo "  → 기존 /etc/caddy/Caddyfile 유지 (덮어쓰지 않음)"
fi

log "6/7 방화벽 — 22/80/443 만 개방, :3030 은 외부 차단"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

log "7/7 디스크·업로드 디렉터리"
# 유저 업로드(피드/거래 사진)는 재생성 불가 — NAS 에서 rsync 로 가져와야 한다:
#   rsync -avz root@<NAS>:/root/dev/pokefesta30/server/public/cdn/uploads/ \
#              "$DEPLOY_DIR/server/public/cdn/uploads/"
mkdir -p "$DEPLOY_DIR/server/public/cdn/uploads"
df -h / | tail -1

cat <<DONE

────────────────────────────────────────────────────────────
✓ 부트스트랩 완료.

남은 수동 작업:
  1) server/.env
       cd $DEPLOY_DIR/server && cp .env.example .env && vi .env
       (또는 GitHub Secret 에 맡기고 배포가 기록하게 둔다)
  2) Caddyfile 도메인 교체 → systemctl reload caddy
  3) GitHub Secrets 등록:
       VULTR_SSH_HOST = $(curl -s --max-time 5 https://api.ipify.org || echo '<이 서버 IP>')
       VULTR_SSH_USER = root
       VULTR_SSH_KEY  = (이 서버에 등록한 개인키)
       VULTR_SSH_PORT = 22
  4) 유저 업로드 rsync (위 주석 참고) — 안 하면 과거 게시물 이미지가 깨진다
  5) 첫 배포: GitHub Actions → Deploy Server → Run workflow → target=vultr
────────────────────────────────────────────────────────────
DONE
