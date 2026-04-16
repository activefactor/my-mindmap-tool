import type { Node, Edge } from 'reactflow';
import type { MindMapNode, NodeData } from '../types/mindmap';

// ============================================================
// レイアウト定数 — DESIGN.md / 基本設計書のレイアウト設計と対応
// ============================================================
const NODE_WIDTH = 160;         // フォールバック用（幅推定のキャップには使わない）
const ROOT_NODE_WIDTH = 200;    // ルートノードの固定幅
const H_GAP = 44;               // ノード右端〜子ノード左端の水平余白
const V_GAP = 20;               // ノード間の垂直余白
const LINE_HEIGHT = 22;         // 14px フォントの行高
const ROOT_LINE_HEIGHT = 28;    // 20px フォントの行高（ルート）
const PADDING_V = 16;           // 上下パディング合計（8px × 2）
const ROOT_PADDING_V = 24;      // ルート上下パディング合計（12px × 2）
const CHAR_WIDTH = 14;          // 1文字あたりの推定幅（Noto Sans JP 14px ≈ 14px/字）
const PADDING_H = 32;           // 水平パディング合計（16px × 2）
const ESTIMATE_BUFFER = 14;     // 幅推定バッファ（フォントメトリクスの誤差で最後の文字が折り返されるのを防ぐ）
const MIN_NODE_WIDTH = 74;      // ノードの最小幅（日本語2文字相当: 2×14+32+14）
const ROOT_CHARS_PER_LINE = 10; // ルートノードの折り返し文字数（固定幅のため定数）
const MIN_HEIGHT = 40;

/**
 * テキストからノードの推定幅を計算する。
 * 改行がある場合は最長行の幅を使用。上限なし（テキストに合わせて自由に伸びる）。
 */
const estimateWidth = (text: string, isRoot: boolean): number => {
  if (isRoot) return ROOT_NODE_WIDTH;
  if (!text) return MIN_NODE_WIDTH;
  const maxLineLen = text.split('\n').reduce((max, line) => Math.max(max, line.length), 0);
  return Math.max(maxLineLen * CHAR_WIDTH + PADDING_H + ESTIMATE_BUFFER, MIN_NODE_WIDTH);
};

/**
 * テキストからノードの推定高さを計算する。
 * 改行文字と、推定幅に基づく折り返しを両方考慮する。
 */
const estimateHeight = (text: string, isRoot: boolean): number => {
  if (!text) return MIN_HEIGHT;
  const lineH = isRoot ? ROOT_LINE_HEIGHT : LINE_HEIGHT;
  const paddingV = isRoot ? ROOT_PADDING_V : PADDING_V;
  if (isRoot) {
    const lines = Math.max(1, Math.ceil(text.length / ROOT_CHARS_PER_LINE));
    return Math.max(MIN_HEIGHT, lines * lineH + paddingV);
  }
  const width = estimateWidth(text, false);
  const charsPerLine = Math.max(1, Math.floor((width - PADDING_H) / CHAR_WIDTH));
  const totalLines = text.split('\n').reduce((sum, line) => {
    return sum + Math.max(1, Math.ceil(line.length / charsPerLine));
  }, 0);
  return Math.max(MIN_HEIGHT, totalLines * lineH + paddingV);
};

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  height: number;
  width: number;
}

const calcLayout = (
  node: MindMapNode,
  depth: number,
  yOffset: number,
  nodeX: number,       // 自ノードのX座標（呼び出し元が決定）
  result: LayoutNode[],
): number => {
  const isRoot = depth === 0;
  const width = estimateWidth(node.text, isRoot);
  const height = estimateHeight(node.text, isRoot);
  const visibleChildren = node.collapsed ? [] : node.children;
  // 子ノードのX座標 = 自ノードの右端 + 水平余白
  const childX = nodeX + width + H_GAP;

  if (visibleChildren.length === 0) {
    result.push({ id: node.id, x: nodeX, y: yOffset, height, width });
    return height;
  }

  // 子ノードを順に配置
  let childY = yOffset;
  let totalChildrenHeight = 0;
  for (const child of visibleChildren) {
    const h = calcLayout(child, depth + 1, childY, childX, result);
    childY += h + V_GAP;
    totalChildrenHeight += h + V_GAP;
  }
  totalChildrenHeight -= V_GAP;

  // 親ノードを子ノード群の垂直中央に配置
  const firstChild = result.find((r) => r.id === visibleChildren[0].id)!;
  const lastChild = result.find(
    (r) => r.id === visibleChildren[visibleChildren.length - 1].id,
  )!;
  const childrenMidY = (firstChild.y + lastChild.y + lastChild.height) / 2;
  const nodeY = childrenMidY - height / 2;

  result.push({ id: node.id, x: nodeX, y: nodeY, height, width });
  return Math.max(totalChildrenHeight, height);
};

export const treeToFlow = (
  root: MindMapNode,
  editingId: string | null,
  editingDraft: string,
  selectedId: string | null,
  dragTargetId: string | null,
  edgeColor: string,
  buttonColor: string,
  callbacks: Omit<NodeData, 'node' | 'isRoot' | 'isEditing' | 'isDragTarget' | 'isSelected' | 'nodeWidth' | 'buttonColor'>,
): { nodes: Node<NodeData>[]; edges: Edge[] } => {
  // 編集中ノードのテキストを draft で上書きしたツリーを作る（高さ推定に使用）
  const applyDraft = (node: MindMapNode): MindMapNode =>
    node.id === editingId && editingDraft
      ? { ...node, text: editingDraft, children: node.children.map(applyDraft) }
      : { ...node, children: node.children.map(applyDraft) };

  const effectiveRoot = editingId ? applyDraft(root) : root;

  // レイアウト計算（effectiveRoot を使って高さ・幅を推定）
  const layoutResult: LayoutNode[] = [];
  calcLayout(effectiveRoot, 0, 0, 0, layoutResult);
  const posMap = new Map(layoutResult.map((r) => [r.id, r]));

  // 元ツリーのノードを ID でひける Map（NodeData には元データを渡す）
  const originalMap = new Map<string, MindMapNode>();
  const collectOriginals = (n: MindMapNode) => {
    originalMap.set(n.id, n);
    n.children.forEach(collectOriginals);
  };
  collectOriginals(root);

  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];

  const traverse = (node: MindMapNode, parentId: string | null) => {
    const layout = posMap.get(node.id) ?? { x: 0, y: 0, height: MIN_HEIGHT, width: NODE_WIDTH };
    const originalNode = originalMap.get(node.id) ?? node;

    nodes.push({
      id: node.id,
      type: 'mindMapNode',
      position: { x: layout.x, y: layout.y },
      data: {
        node: originalNode,
        isRoot: parentId === null,
        isEditing: node.id === editingId,
        isDragTarget: node.id === dragTargetId,
        isSelected: node.id === selectedId,
        nodeWidth: layout.width,
        buttonColor,
        ...callbacks,
      },
    });

    if (parentId) {
      edges.push({
        id: `e-${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: 'mindMapEdge',
        data: { edgeColor },
      });
    }

    if (!node.collapsed) {
      for (const child of node.children) {
        traverse(child, node.id);
      }
    }
  };

  traverse(effectiveRoot, null);
  return { nodes, edges };
};
