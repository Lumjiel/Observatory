module.exports = {
  apps: [
    {
      name: 'observatory',
      script: 'scripts/article-api.mjs',
      cwd: '.',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
        BASE_PATH: '/observatory'
      },
      error_file: './logs/observatory-error.log',
      out_file: './logs/observatory-out.log',
      log_file: './logs/observatory-combined.log',
      time: true,
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true
    }
  ]
};
