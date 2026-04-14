import { memo, useRef, useEffect, useState } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { NodeData } from '../../types/mindmap';

// treeToFlow の NODE_WIDTH / ROOT_NODE_WIDTH と一致させること（DESIGN.md 参照）
const NODE_WIDTH = 160;
const ROOT_NODE_WIDTH = 200;
const MAX_TEXT_LENGTH = 500;

export const MindMapNodeComponent = memo(({ data }: NodeProps<NodeData>) => {
  const {
    node,
    isRoot,
    isEditing,
    isDragTarget,
    isSelected,
    onStartEdit,
    onCommitEdit,
    onCancelEdit,
    onContextMenu,
    onToggleCollapse,
    onDraftChange,
  } = data;

  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(node.text);

  // 編集開始時のみ初期化・フォーカス（node.text を deps に入れると毎keystroke で select-all になるため除外）
  useEffect(() => {
    if (isEditing) {
      setDraft(node.text);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const hasChildren = node.children.length > 0;
  const width = isRoot ? ROOT_NODE_WIDTH : NODE_WIDTH;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); onCommitEdit(node.id, draft); }
    if (e.key === 'Escape') { onCancelEdit(); }
    e.stopPropagation();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
    onDraftChange(node.id, e.target.value);
  };

  // ---- スタイル計算 ----
  // 選択リング: 2px の外枠 + shadow
  const ringStyle = isSelected
    ? `0 0 0 2px var(--color-primary-500), var(--shadow-lg)`
    : isDragTarget
      ? 'var(--shadow-lg)'
      : 'var(--shadow-md)';

  const borderColor = isDragTarget
    ? 'var(--color-primary-500)'
    : isSelected
      ? 'var(--color-primary-400)'
      : 'var(--color-border-node)';

  const borderWidth = isDragTarget || isSelected
    ? 'var(--border-width-thick)'
    : 'var(--border-width-default)';

  const bgColor = isRoot
    ? 'var(--color-bg-node-root)'
    : isDragTarget
      ? 'var(--color-bg-node-hover)'
      : isSelected
        ? 'var(--color-bg-node-selected)'
        : 'var(--color-bg-node)';

  return (
    <div
      onContextMenu={(e) => onContextMenu(e, node.id)}
      onDoubleClick={() => onStartEdit(node.id)}
      style={{
        width: `${width}px`,
        background: bgColor,
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: isRoot ? 'var(--radius-lg)' : 'var(--radius-md)',
        boxShadow: ringStyle,
        padding: isRoot
          ? 'var(--spacing-3) var(--spacing-6)'
          : 'var(--spacing-2) var(--spacing-4)',
        cursor: 'default',
        position: 'relative',
        transition: [
          'box-shadow var(--transition-fast)',
          'border-color var(--transition-fast)',
          'background var(--transition-fast)',
          'transform var(--transition-fast)',
        ].join(', '),
        userSelect: 'none',
        transform: isDragTarget ? 'scale(1.04)' : 'scale(1)',
        boxSizing: 'border-box',
      }}
    >
      {!isRoot && (
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      )}

      {isEditing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={() => onCommitEdit(node.id, draft)}
          maxLength={MAX_TEXT_LENGTH}
          style={{
            font: 'inherit',
            fontSize: isRoot ? 'var(--font-size-xl)' : 'var(--font-size-base)',
            fontWeight: isRoot ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
            color: isRoot ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            lineHeight: 'var(--line-height-base)',
          }}
        />
      ) : (
        <span
          style={{
            fontSize: isRoot ? 'var(--font-size-xl)' : 'var(--font-size-base)',
            fontWeight: isRoot ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
            color: isRoot ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
            lineHeight: 'var(--line-height-base)',
            // テキストを折り返して全文表示（省略なし）
            whiteSpace: 'normal',
            wordBreak: 'break-all',
            display: 'block',
          }}
        >
          {node.text}
        </span>
      )}

      {hasChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
          style={{
            position: 'absolute',
            right: '-12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '16px',
            height: '16px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-primary-400)',
            color: 'var(--color-gray-0)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            lineHeight: 1,
            padding: 0,
          }}
          title={node.collapsed ? '展開' : '折りたたむ'}
        >
          {node.collapsed ? '▶' : '▼'}
        </button>
      )}

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
});

MindMapNodeComponent.displayName = 'MindMapNodeComponent';
