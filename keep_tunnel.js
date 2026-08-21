const { spawn } = require('child_process');

function startSshTunnel() {
  console.log('🔄 Iniciando túnel SSH seguro e persistente...');
  const ssh = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-R', '80:localhost:4000',
    'nokey@localhost.run'
  ]);

  ssh.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);
  });

  ssh.stderr.on('data', (data) => {
    const output = data.toString();
    console.log(output);
  });

  ssh.on('close', (code) => {
    console.log(`Túnel desconectado (código ${code}). Reiniciando em 2 segundos...`);
    setTimeout(startSshTunnel, 2000);
  });
}

startSshTunnel();
