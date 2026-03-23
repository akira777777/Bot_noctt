module.exports = {
  apps: [
    {
      name: "bot-noct",
      script: "./index.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
        TELEGRAM_DELIVERY_MODE: "webhook",
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_file: "./logs/pm2-combined.log",
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 4000,
      watch: false,
      ignore_watch: ["node_modules", "logs", "data"],
      kill_timeout: 5000,
      listen_timeout: 8000,
      shutdown_with_message: true,
    },
  ],
};
