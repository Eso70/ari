module.exports = {
  apps: [{
    name: 'ari',
    script: './node_modules/.bin/next',
    args: ['start', '-p', '3006'],
    cwd: '/var/www/ari',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production'
    }
  }]
};