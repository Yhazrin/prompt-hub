module.exports = {
  apps: [{
    name: 'prompt-hub',
    script: 'server.mjs',
    cwd: '/opt/prompt-hub',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    error_file: '/var/log/prompt-hub/error.log',
    out_file: '/var/log/prompt-hub/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
