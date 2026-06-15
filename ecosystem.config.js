module.exports = {
  apps: [
    {
      name: 'teachures-web',
      script: 'src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'teachures-worker',
      script: 'src/services/queue.service.js',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/worker-err.log',
      out_file: 'logs/worker-out.log'
    }
  ]
};
