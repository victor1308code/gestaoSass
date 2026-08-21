const git = require('isomorphic-git');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);

async function initAndCommit() {
  try {
    console.log('🚀 Inicializando repositório Git local...');
    await git.init({ fs, dir, defaultBranch: 'main' });

    // Função recursiva para listar arquivos
    function getFiles(currentDir, relativePath = '') {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      let files = [];
      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.env') continue;
        const fullPath = path.join(currentDir, entry.name);
        const rel = path.join(relativePath, entry.name).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          files = files.concat(getFiles(fullPath, rel));
        } else {
          files.push(rel);
        }
      }
      return files;
    }

    const filesToAdd = getFiles(dir);
    console.log(`📦 Adicionando ${filesToAdd.length} arquivos ao Git staging...`);

    for (const filepath of filesToAdd) {
      await git.add({ fs, dir, filepath });
    }

    console.log('💾 Criando commit inicial...');
    const sha = await git.commit({
      fs,
      dir,
      message: 'feat: Plataforma Gestão SaaS Multi-Tenant Completa',
      author: {
        name: 'Victor',
        email: 'admin@gestaotalentos.com.br'
      }
    });

    console.log(`✅ Repositório Git inicializado e commit criado com sucesso!`);
    console.log(`📌 Commit SHA: ${sha}`);
  } catch (err) {
    console.error('Erro ao inicializar Git:', err);
  }
}

initAndCommit();
