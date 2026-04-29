const fs = require('fs');
const path = require('path');

const walk = (dir, done) => {
  let results = [];
  fs.readdir(dir, (err, list) => {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach((file) => {
      file = path.resolve(dir, file);
      fs.stat(file, (err, stat) => {
        if (stat && stat.isDirectory()) {
          walk(file, (err, res) => {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          if (file.endsWith('.tsx')) results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

const processFile = (file) => {
  if (file.includes('App.tsx')) return; // Already refactored
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('COLORS')) return;

  const isComponent = file.includes('components');
  const themePath = isComponent ? '../hooks/useTheme' : '../hooks/useTheme';

  // 1. Imports
  let modifiedImport = false;
  content = content.replace(/import\s+\{([^}]*COLORS[^}]*)\}\s+from\s+'(\.\.\/types)';/g, (match, p1, p2) => {
    modifiedImport = true;
    let newP1 = p1.replace(/COLORS,?/, '').trim();
    if (newP1.endsWith(',')) newP1 = newP1.slice(0, -1);
    const newTypesImport = newP1.length > 0 ? `import { ${newP1} } from '${p2}';\n` : '';
    return `${newTypesImport}import { useTheme } from '${themePath}';`;
  });

  if (!modifiedImport && !content.includes('import { useTheme }')) {
    content = `import { useTheme } from '${themePath}';\n` + content;
  }

  // 2. StyleSheet
  const hasStyles = content.includes('const styles = StyleSheet.create({');
  const hasDialogStyles = content.includes('const dialogStyles = StyleSheet.create({');
  
  if (hasStyles) {
    content = content.replace(/const styles = StyleSheet\.create\(\{/g, 'const getStyles = (colors: any) => StyleSheet.create({');
  }
  if (hasDialogStyles) {
    content = content.replace(/const dialogStyles = StyleSheet\.create\(\{/g, 'const getDialogStyles = (colors: any) => StyleSheet.create({');
  }

  // 3. Replace COLORS with colors
  content = content.replace(/COLORS\./g, 'colors.');

  // 4. Inject hook into functional components
  const funcRegex = /(?:export\s+)?function\s+([A-Z]\w*)\s*\([^)]*\)\s*(?::\s*[^\{]+)?\s*\{/g;
  content = content.replace(funcRegex, (match, p1) => {
    let inject = `\n  const { colors } = useTheme();\n`;
    if (hasStyles && content.includes(`getStyles`)) {
      inject += `  const styles = React.useMemo(() => getStyles(colors), [colors]);\n`;
    }
    if (hasDialogStyles && content.includes(`getDialogStyles`)) {
      inject += `  const dialogStyles = React.useMemo(() => getDialogStyles(colors), [colors]);\n`;
    }
    return match + inject;
  });

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Refactored ${file}`);
};

walk(path.join(__dirname, 'src/screens'), (err, res1) => {
  walk(path.join(__dirname, 'src/components'), (err, res2) => {
    const all = res1.concat(res2);
    all.forEach(processFile);
  });
});
