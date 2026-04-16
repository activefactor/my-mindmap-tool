import { memo, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { NodeData } from '../../types/mindmap';

const MAX_TEXT_LENGTH = 500;

export const MindMapNodeComponent = memo(({ data }: NodeProps<NodeData>) => {
  const {
    node,
    isRoot,
    isEditing,
    isDragTarget,
    isSelected,
    nodeWidth,
    buttonColor,
    onStartEdit,
    onCommitEdit,
    onCancelEdit,
    onContextMenu,
    onToggleCollapse,
    onDraftChange,
  } = data;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  // DOM値を直接管理するRef（controlled stateを使わずIMEを保護）
  const draftRef = useRef(node.text);

  // 編集開始時：DOM値をセット・フォーカス・高さ初期化
  useEffect(() => {
    if (isEditing) {
      draftRef.current = node.text;
      const el = textareaRef.current;
      if (!el) return;
      el.value = node.text;
      setTimeout(() => {
        el.focus();
        el.select();
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // nodeWidth 変更後に textarea 高さを再計算
  useEffect(() => {
    if (!isEditing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [nodeWidth, isEditing]);

  const hasChildren = node.children.length > 1;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing) return;
      if (e.shiftKey) return;
      e.preventDefault();
      onCommitEdit(node.id, draftRef.current);
    }
    if (e.key === 'Escape') { onCancelEdit(); }
    e.stopPropagation();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    draftRef.current = value;
    // 変換中はレイアウト更新・高さ調整をスキップ（IMEウィンドウ位置を安定させる）
    if (isComposingRef.current) return;
    onDraftChange(node.id, value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  // ---- スタイル計算 ----
  const isBoxVisible = isRoot || isEditing || isSelected || isDragTarget;

  const ringStyle = isSelected
    ? `0 0 0 2px var(--color-primary-500), var(--shadow-lg)`
    : isDragTarget
      ? 'var(--shadow-lg)'
      : isRoot
        ? 'var(--shadow-md)'
        : 'none';

  const borderColor = isDragTarget
    ? 'var(--color-primary-500)'
    : isSelected
      ? 'var(--color-primary-400)'
      : isBoxVisible
        ? 'var(--color-border-node)'
        : 'transparent';

  const borderWidth = isDragTarget || isSelected
    ? 'var(--border-width-thick)'
    : 'var(--border-width-default)';

  const bgColor = isRoot
    ? 'var(--color-bg-node-root)'
    : isEditing
      ? 'var(--color-bg-node)'
      : isDragTarget
        ? 'var(--color-bg-node-hover)'
        : isSelected
          ? 'var(--color-bg-node-selected)'
          : 'transparent';

  return (
    <div
      onContextMenu={(e) => onContextMenu(e, node.id)}
      onDoubleClick={() => onStartEdit(node.id)}
      style={{
        width: `${nodeWidth}px`,
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
        // uncontrolled textarea: value prop を持たせない
        // React の再レンダリングが DOM 値を上書きしないため IME が正常動作する
        <textarea
          ref={textareaRef}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
            // 変換確定後に DOM から最新値を取得して高さ・レイアウトを更新
            const el = textareaRef.current;
            if (!el) return;
            draftRef.current = el.value;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
            onDraftChange(node.id, el.value);
          }}
          onBlur={() => {
            if (isComposingRef.current) return;
            onCommitEdit(node.id, draftRef.current);
          }}
          maxLength={MAX_TEXT_LENGTH}
          rows={1}
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
            resize: 'none',
            overflow: 'hidden',
            padding: 0,
            margin: 0,
            display: 'block',
            wordBreak: 'break-all',
          }}
        />
      ) : (
        <span
          style={{
            fontSize: isRoot ? 'var(--font-size-xl)' : 'var(--font-size-base)',
            fontWeight: isRoot ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
            color: isRoot ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
            lineHeight: 'var(--line-height-base)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            display: 'block',
          }}
        >
          {node.text}
        </span>
      )}

      {hasChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
          title={node.collapsed ? '展開' : '折りたたむ'}
          style={{
            position: 'absolute',
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          <div style={{
            width: '3px',
            height: '3px',
            background: buttonColor,
            flexShrink: 0,
          }} />
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            flexShrink: 0,
            background: node.collapsed ? 'var(--color-gray-0)' : buttonColor,
            border: `1.5px solid ${buttonColor}`,
            boxSizing: 'border-box',
          }} />
        </button>
      )}

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
});

MindMapNodeComponent.displayName = 'MindMapNodeComponent';
