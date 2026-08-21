const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);

// Uso: node push_git.js https://github.com/SEU_USER/SEU_REPO.git SEU_TOKEN_OU_SENHA
async function pushToRemote() {
  const url = process.argv[2];
  const token = process.argv[3];

  if (!url) {
    console.log('📌 Para enviar via Node.js, use:');
    console.log('node push_git.js https://github.com/SEU_USUARIO/SEU_REPO.git SEU_PERSONAL_ACCESS_TOKEN');
    return;
  }

  try {
    console.log(`📡 Conectando ao repositório remoto: ${url}`);
    await git.addRemote({ fs, dir, remote: 'origin', url, force: true });

    console.log('⬆️ Enviando branch main para o GitHub...');
    await git.push({
      fs,
      http,
      dir,
      remote: 'origin',
      ref: 'main',
      onAuth: () => ({ username: token, password: '' })
    });

    console.log('🎉 Push realizado com sucesso para o GitHub!');
  } catch (err) {
    console.error('Erro ao enviar:', err.message);
  }
}

pushToRemote();
