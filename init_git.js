const git = require('isomorphic-git');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);

async function initAndCommit() {
  try {
    console.log('🚀 Inicializando repositório Git com autor GitHub verificado...');
    await git.init({ fs, dir, defaultBranch: 'main' });

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

    console.log('💾 Criando commit com usuário victor1308code...');
    const sha = await git.commit({
      fs,
      dir,
      message: 'feat: Gestão SaaS Multi-Tenant (Vercel Release)',
      author: {
        name: 'victor1308code',
        email: 'victor1308code@users.noreply.github.com'
      },
      committer: {
        name: 'victor1308code',
        email: 'victor1308code@users.noreply.github.com'
      }
    });

    console.log(`✅ Commit criado com sucesso! SHA: ${sha}`);
  } catch (err) {
    console.error('Erro ao criar commit:', err);
  }
}

initAndCommit();
