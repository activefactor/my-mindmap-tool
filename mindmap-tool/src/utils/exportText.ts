import type { MindMapNode } from '../types/mindmap';

const INDENT = '    '; // スペース4つ

const nodeToLines = (node: MindMapNode, depth: number): string[] => {
  const lines: string[] = [INDENT.repeat(depth) + node.text];
  for (const child of node.children) {
    lines.push(...nodeToLines(child, depth + 1));
  }
  return lines;
};

/** 任意のノードを起点にインデント付きテキストを生成する（クリップボードコピー等で利用） */
export const nodeToText = (node: MindMapNode): string =>
  nodeToLines(node, 0).join('\n');

export const exportText = (root: MindMapNode): void => {
  const lines = nodeToLines(root, 0);
  const content = lines.join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mindmap_${formatDate()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

const formatDate = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
};
