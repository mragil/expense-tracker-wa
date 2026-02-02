import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, dirname } from 'path';

async function processFile(filePath: string) {
  const content = await readFile(filePath, 'utf-8');
  
  // Match relative imports without .js extension
  const updated = content.replace(
    /from\s+['"](\.[^'"]+)['"]/g,
    (match, importPath) => {
      // Skip if already has extension
      if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
        return match;
      }
      return `from '${importPath}.js'`;
    }
  );
  
  if (content !== updated) {
    await writeFile(filePath, updated);
    console.log(`Updated: ${filePath}`);
  }
}

async function processDir(dir: string) {
  const entries = await readdir(dir);
  
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      await processDir(fullPath);
    } else if (entry.endsWith('.js')) {
      await processFile(fullPath);
    }
  }
}

const distDir = process.argv[2] || 'dist';
processDir(distDir).then(() => console.log('Done adding .js extensions'));
