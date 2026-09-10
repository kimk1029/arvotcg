/**
 * pm2 ecosystem — 메인 앱 + admin 두 인스턴스를 동시에 기동.
 *
 * 사용법:
 *   pm2 start ecosystem.config.cjs              # 두 앱 모두
 *   pm2 start ecosystem.config.cjs --only admin # admin 만
 *   pm2 reload ecosystem.config.cjs             # 무중단 재시작
 *   pm2 logs pokefesta30-app|pokefesta30-admin
 *
 * 각 앱은 자기 디렉터리에서 npm start 로 실행되며, .env 는 cwd 기준으로 읽힘.
 * admin 은 /.env 또는 admin/.env.local 에 ADMIN_USERNAME, ADMIN_PASSWORD, DATABASE_URL 필요.
 */

module.exports = {
  apps: [
    {
      name: 'pokefesta30-app',
      cwd: __dirname,
      script: 'npm',
      args: 'run start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.APP_PORT || '3000',
      },
    },
    {
      name: 'pokefesta30-admin',
      cwd: __dirname + '/admin',
      script: 'npm',
      args: 'run start',
      instances: 1,
      // 서버와 동일하게 fork 모드 명시 — instances 만 있으면 pm2 가 기본 cluster 모드를
      // 쓰는데, cluster 모드는 Node IPC handshake 가 필요해 `npm` CLI 래퍼와 함께 쓰면
      // 즉시 종료된다(무한 재시작). 시놀로지에서 admin 이 안 떴던 원인.
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        // 시놀로지에서 admin 은 3000 번으로 기동. (메인 웹앱 pokefesta30-app 도 3000 기본이라
        // 같은 NAS 에서 둘 다 띄우려면 APP_PORT 를 분리할 것 — NAS 엔 보통 server+admin 만 올림.)
        PORT: process.env.ADMIN_PORT || '3000',
      },
    },
    {
      // Express OCR / API 서버. mobile + web 의 백엔드.
      // exec_mode: 'fork' 명시 — pm2 는 `instances` 가 있으면 기본 cluster 모드를
      // 쓰는데, cluster 모드는 Node IPC handshake 가 필요해 즉시 종료된다 (무한 재시작).
      // `npm run start` 래퍼 대신 node 를 직접 실행 — npm 래퍼를 쓰면 pm2 delete 가
      // npm 만 죽이고 tsx 자식이 고아로 남아 :3030 을 점유(EADDRINUSE), 이후 모든
      // 재기동이 크래시 루프에 빠진다 (2026-07-17 배포 3연속 실패 원인).
      name: 'pokefesta30-server',
      // Preserve per-entry incident times across deploys (PM2 host timezone).
      time: true,
      cwd: __dirname + '/server',
      script: 'index.js',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.SERVER_PORT || '3030',
      },
    },
  ],
};
