module.exports = {
  apps: [
    {
      name: 'starry-bot',
      script: 'src/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
