module.exports = {
  apps: [{
    name: 'sarfr4z',
    script: './node_modules/.bin/next',
    args: ['start', '-p', '3001'],
    cwd: '/var/www/sarfr4z',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production'
    }
  }]
};