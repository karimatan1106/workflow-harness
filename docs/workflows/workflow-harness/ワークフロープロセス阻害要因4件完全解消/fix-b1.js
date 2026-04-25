/**
 * B-1修正: discover-tasks.jsにタスクID降順ソートを追加
 * @spec docs/workflows/ワ-クフロ-プロセス阻害要因4件完全解消/spec.md
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'workflow-plugin', 'hooks', 'lib', 'discover-tasks.js');
let content = fs.readFileSync(filePath, 'utf8');

const searchText = '    return tasks;\n  } catch {';
const replaceText = [
  '    // B-1: タスクIDの降順でソート（最新タスクを先頭に配置）',
  '    // taskIdはYYYYMMDD_HHMMSS形式なので文字列比較で時系列順序が保証される',
  "    tasks.sort((a, b) => (b.taskId || '').localeCompare(a.taskId || ''));",
  '',
  '    return tasks;',
  '  } catch {',
].join('\n');

if (content.includes(searchText)) {
  content = content.replace(searchText, replaceText);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('B-1: discover-tasks.js updated - taskId descending sort added');
} else {
  console.log('B-1: target text not found (may already be applied)');
}
