const fs = require('fs');
const path = require('path');

const replaceInDir = (dir) => {
  if (!fs.existsSync(dir)) return;
  
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let newContent = content
        .replace(/'entrant'/g, "'achat'")
        .replace(/'sortant'/g, "'vente'")
        .replace(/"entrant"/g, '"achat"')
        .replace(/"sortant"/g, '"vente"')
        .replace(/isEntrant/g, 'isAchat')
        .replace(/isSortant/g, 'isVente')
        .replace(/Entrant/g, 'Achat')
        .replace(/Sortant/g, 'Vente')
        .replace(/entrant/g, 'achat')
        .replace(/sortant/g, 'vente');
        
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
        console.log('Updated', fullPath);
      }
    }
  });
};

replaceInDir('src/components');
replaceInDir('src/types');
replaceInDir('src/pages');
