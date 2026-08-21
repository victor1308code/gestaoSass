const localtunnel = require('localtunnel');
const https = require('https');

function getPublicIp() {
  return new Promise((resolve) => {
    https.get('https://loca.lt/mytunnelpassword', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data.trim()));
    }).on('error', () => resolve('Não foi possível obter IP'));
  });
}

async function startTunnel() {
  try {
    const ip = await getPublicIp();
    const tunnel = await localtunnel({ port: 4000 });

    console.log('\n======================================================');
    console.log('🌐 LINK ONLINE ATIVO E DISPONÍVEL!');
    console.log(`🔗 Link de Acesso: ${tunnel.url}`);
    console.log(`🔑 Senha do Túnel (se solicitada na tela): ${ip}`);
    console.log('🏢 Login Demo: admin@inovatech.com / senha123');
    console.log('======================================================\n');

    // Keep process alive indefinitely
    setInterval(() => {}, 1000 * 60);

    tunnel.on('close', () => {
      console.log('Túnel fechado. Reiniciando...');
      startTunnel();
    });

    tunnel.on('error', (err) => {
      console.error('Erro no túnel:', err);
    });
  } catch (err) {
    console.error('Falha ao abrir túnel:', err);
  }
}

startTunnel();
