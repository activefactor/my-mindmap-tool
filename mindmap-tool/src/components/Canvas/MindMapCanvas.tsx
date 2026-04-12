import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
} from 'reactflow';
import type { Node as RFNode } from 'reactflow';
import 'reactflow/dist/style.css';

import type { MindMapNode, ContextMenuState } from '../../types/mindmap';
import { MindMapNodeComponent } from './MindMapNodeComponent';
import { treeToFlow } from '../../utils/treeToFlow';

const nodeTypes = { mindMapNode: MindMapNodeComponent } as const;

// treeToFlow の NODE_MAX_WIDTH に合わせる
const NODE_MAX_WIDTH = 200; // ルートが最大幅なので余裕をみて200
const NODE_HEIGHT = 40;
const DROP_PADDING = 20;

interface MindMapCanvasProps {
  root: MindMapNode;
  selectedId: string | null;
  editingId: string | null;
  onSelect: (id: string | null) => void;
  onStartEdit: (id: string) => void;
  onCommitEdit: (id: string, text: string) => void;
  onCancelEdit: () => void;
  onContextMenu: (state: ContextMenuState) => void;
  onToggleCollapse: (id: string) => void;
  onMoveNode: (nodeId: string, newParentId: string) => void;
}

export const MindMapCanvas = ({
  root,
  selectedId,
  editingId,
  onSelect,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onContextMenu,
  onToggleCollapse,
  onMoveNode,
}: MindMapCanvasProps) => {
  const { getNodes } = useReactFlow();
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);

  // 編集中ノードのドラフトテキスト（リアルタイムレイアウト更新用）
  const [editingDraft, setEditingDraft] = useState('');

  // editingId が変わったとき（編集開始）、対象ノードの現在テキストでドラフトを初期化
  const editingIdRef = useRef(editingId);
  useEffect(() => {
    if (editingId && editingId !== editingIdRef.current) {
      const find = (n: MindMapNode): MindMapNode | null =>
        n.id === editingId ? n : n.children.map(find).find(Boolean) ?? null;
      setEditingDraft(find(root)?.text ?? '');
    }
    if (!editingId) setEditingDraft('');
    editingIdRef.current = editingId;
  }, [editingId, root]);

  const handleDraftChange = useCallback((_id: string, text: string) => {
    setEditingDraft(text);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      onContextMenu({ nodeId: id, x: e.clientX, y: e.clientY });
    },
    [onContextMenu],
  );

  const callbacks = useMemo(
    () => ({
      onStartEdit,
      onCommitEdit,
      onCancelEdit,
      onContextMenu: handleContextMenu,
      onToggleCollapse,
      onDraftChange: handleDraftChange,
    }),
    [onStartEdit, onCommitEdit, onCancelEdit, handleContextMenu, onToggleCollapse, handleDraftChange],
  );

  const { nodes, edges } = useMemo(
    () => treeToFlow(root, editingId, editingDraft, selectedId, dragTargetId, callbacks),
    // layoutTick はスナップバック強制に使用
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [root, editingId, editingDraft, selectedId, dragTargetId, callbacks, layoutTick],
  );

  // ドラッグ中: ドロップ候補ノードを検出してハイライト
  const handleNodeDrag = useCallback(
    (_: React.MouseEvent, draggedNode: RFNode) => {
      const allNodes = getNodes();
      const dragCenterX = draggedNode.position.x + NODE_MAX_WIDTH / 2;
      const dragCenterY = draggedNode.position.y + NODE_HEIGHT / 2;

      let closestId: string | null = null;
      let minDist = Infinity;

      for (const n of allNodes) {
        if (n.id === draggedNode.id) continue;
        const left = n.position.x - DROP_PADDING;
        const right = n.position.x + NODE_MAX_WIDTH + DROP_PADDING;
        const top = n.position.y - DROP_PADDING;
        const bottom = n.position.y + NODE_HEIGHT + DROP_PADDING;

        if (dragCenterX >= left && dragCenterX <= right && dragCenterY >= top && dragCenterY <= bottom) {
          const dist = Math.hypot(
            dragCenterX - (n.position.x + NODE_MAX_WIDTH / 2),
            dragCenterY - (n.position.y + NODE_HEIGHT / 2),
          );
          if (dist < minDist) { minDist = dist; closestId = n.id; }
        }
      }

      setDragTargetId(closestId);
    },
    [getNodes],
  );

  // ドロップ確定: 親子変更 or スナップバック
  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, draggedNode: RFNode) => {
      if (dragTargetId && dragTargetId !== draggedNode.id) {
        onMoveNode(draggedNode.id, dragTargetId);
      } else {
        setLayoutTick((t) => t + 1);
      }
      setDragTargetId(null);
    },
    [dragTargetId, onMoveNode],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      onNodeDrag={handleNodeDrag}
      onNodeDragStop={handleNodeDragStop}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={3}
      deleteKeyCode={null}
      style={{ background: 'var(--color-bg-canvas)' }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={2}
        color="var(--color-gray-300)"
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
};
