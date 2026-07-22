/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pan/zoom org chart — Rudder OrgChart interaction, hybrid tree + grid layout.
 * Trees with reporting lines render top-center; users without a manager sit in
 * a labelled "unassigned" section below, so the tree and its edges are always
 * on screen when at least one manager link exists.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrgUser } from '@/common/types/orgUsers/orgUserTypes';
import {
  ORG_CHART_CARD_H,
  ORG_CHART_CARD_W,
  ORG_CHART_PADDING,
  computeOrgChartLayout,
  type OrgChartSourceNode,
} from '@renderer/pages/orgUsers/orgChartLayout';
import './orgStructureChart.css';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
/** Below this exact-fit scale the whole-chart view stops being readable — anchor on the tree instead. */
const READABLE_FIT_THRESHOLD = 0.85;
/** Corner radius of the orthogonal edge elbows. */
const EDGE_RADIUS = 12;
/** Spacing of the dot-grid canvas background at zoom 1. */
const DOT_GRID_SIZE = 24;

const STATUS_DOT: Record<string, string> = {
  active: '#00b42a',
  transferred: '#ff7d00',
  suspended: '#f7ba1e',
  terminated: '#86909c',
};

function displayLine(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : '—';
}

function statusDotColor(status: string): string {
  return STATUS_DOT[status] ?? '#86909c';
}

function isActiveStatus(status: string): boolean {
  return status === 'active';
}

function userInitial(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return '?';
  return trimmed.slice(0, 1).toUpperCase();
}

/** Stable hue per username so avatars are distinct but consistent across renders. */
function usernameHue(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function clampZoom(value: number): number {
  return Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM);
}

/**
 * Orthogonal parent→child connector with rounded elbows. All children of a
 * parent share the same mid rail, so sibling edges merge into a clean bus.
 */
function buildEdgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (Math.abs(dx) < 2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  const midY = y1 + dy / 2;
  const r = Math.min(EDGE_RADIUS, Math.abs(dx) / 2, Math.abs(dy) / 2);
  if (r < 1) {
    return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  }
  const s = dx > 0 ? 1 : -1;
  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${midY - r}`,
    `Q ${x1} ${midY} ${x1 + s * r} ${midY}`,
    `L ${x2 - s * r} ${midY}`,
    `Q ${x2} ${midY} ${x2} ${midY + r}`,
    `L ${x2} ${y2}`,
  ].join(' ');
}

type OrgStructureChartProps = {
  users: OrgUser[];
};

const OrgStructureChart: React.FC<OrgStructureChartProps> = ({ users }) => {
  const { t } = useTranslation();
  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const sourceForest = useMemo(() => buildSourceForest(users), [users]);
  const layout = useMemo(() => computeOrgChartLayout(sourceForest), [sourceForest]);

  const activeNodeIds = useMemo(
    () =>
      new Set(
        layout.nodes
          .filter((node) => isActiveStatus(userMap.get(node.id)?.employment_status ?? ''))
          .map((node) => node.id)
      ),
    [layout.nodes, userMap]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const layoutKey = useMemo(() => `${users.length}:${layout.width}x${layout.height}`, [users.length, layout.width, layout.height]);
  const lastLayoutKey = useRef('');
  const viewModeRef = useRef<'initial' | 'fit' | 'actual' | 'free'>('initial');

  /**
   * initial — whole chart when it fits readably, otherwise zoom 1 anchored on
   *   the tree block so the reporting lines are on screen from the start.
   * fit — whole chart, shrunk as far as MIN_ZOOM allows.
   * actual — zoom 1 anchored on the tree block.
   */
  const applyView = useCallback(
    (mode: 'initial' | 'fit' | 'actual') => {
      const container = containerRef.current;
      if (!container) return;
      const cW = container.clientWidth;
      const cH = container.clientHeight;
      if (cW < 40 || cH < 40) return;

      viewModeRef.current = mode;

      const exactFit = Math.min((cW - 48) / layout.width, (cH - 48) / layout.height);
      const wholeChartReadable = exactFit >= READABLE_FIT_THRESHOLD;

      if (mode === 'fit' || (mode === 'initial' && wholeChartReadable)) {
        const nextZoom = clampZoom(Math.min(exactFit, 1));
        setZoom(nextZoom);
        setPan({
          x: (cW - layout.width * nextZoom) / 2,
          y: (cH - layout.height * nextZoom) / 2,
        });
        return;
      }

      const nextZoom = 1;
      setZoom(nextZoom);
      setPan({
        x: cW / 2 - layout.focusX * nextZoom,
        y: 32 - ORG_CHART_PADDING * nextZoom,
      });
    },
    [layout.focusX, layout.height, layout.width]
  );

  useEffect(() => {
    if (layout.nodes.length === 0 || !containerRef.current) return;
    if (lastLayoutKey.current === layoutKey) return;

    let cancelled = false;
    let attempts = 0;

    const tryApply = () => {
      if (cancelled) return;
      const container = containerRef.current;
      if (!container || container.clientWidth < 40 || container.clientHeight < 40) {
        attempts += 1;
        if (attempts < 12) {
          requestAnimationFrame(tryApply);
        }
        return;
      }
      lastLayoutKey.current = layoutKey;
      applyView('initial');
    };

    const id = requestAnimationFrame(tryApply);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [layout.nodes.length, applyView, layoutKey]);

  /** Re-anchor when the viewport grows (canvas extended down) or shrinks. */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    let lastW = container.clientWidth;
    let lastH = container.clientHeight;
    const observer = new ResizeObserver(() => {
      const nextW = container.clientWidth;
      const nextH = container.clientHeight;
      if (Math.abs(nextW - lastW) < 2 && Math.abs(nextH - lastH) < 2) return;
      lastW = nextW;
      lastH = nextH;
      if (nextW < 40 || nextH < 40) return;
      // Don't clobber freehand pan/zoom after wheel or +/- .
      if (viewModeRef.current === 'free') return;
      applyView(viewModeRef.current);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [applyView]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return;
      setDragging(true);
      dragStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    },
    [pan.x, pan.y]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!dragging) return;
      setPan({
        x: dragStart.current.panX + (event.clientX - dragStart.current.x),
        y: dragStart.current.panY + (event.clientY - dragStart.current.y),
      });
    },
    [dragging]
  );

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.12 : 0.9;
      const newZoom = clampZoom(zoom * factor);
      const scale = newZoom / zoom;
      setPan({
        x: mouseX - scale * (mouseX - pan.x),
        y: mouseY - scale * (mouseY - pan.y),
      });
      setZoom(newZoom);
      viewModeRef.current = 'free';
    },
    [pan.x, pan.y, zoom]
  );

  const zoomAroundCenter = useCallback(
    (factor: number) => {
      const container = containerRef.current;
      if (!container) return;
      const cx = container.clientWidth / 2;
      const cy = container.clientHeight / 2;
      const newZoom = clampZoom(zoom * factor);
      const scale = newZoom / zoom;
      setPan({ x: cx - scale * (cx - pan.x), y: cy - scale * (cy - pan.y) });
      setZoom(newZoom);
      viewModeRef.current = 'free';
    },
    [pan.x, pan.y, zoom]
  );

  const parentNodes = useMemo(() => layout.nodes.filter((node) => node.children.length > 0), [layout.nodes]);

  /** Prefer walking nodes→children so edges cannot go missing if layout.edges drifts. */
  const renderEdges = useMemo(() => {
    const edges: Array<{ parentId: string; childId: string; x1: number; y1: number; x2: number; y2: number; active: boolean }> = [];
    for (const parent of layout.nodes) {
      for (const child of parent.children) {
        edges.push({
          parentId: parent.id,
          childId: child.id,
          x1: parent.x + ORG_CHART_CARD_W / 2,
          y1: parent.y + ORG_CHART_CARD_H,
          x2: child.x + ORG_CHART_CARD_W / 2,
          y2: child.y,
          active: activeNodeIds.has(parent.id) && activeNodeIds.has(child.id),
        });
      }
    }
    return edges;
  }, [layout.nodes, activeNodeIds]);

  return (
    <div
      ref={containerRef}
      data-panning={dragging ? 'true' : 'false'}
      data-edge-count={renderEdges.length}
      className='org-structure-chart__viewport relative flex-1 min-h-0 overflow-hidden'
      style={{
        backgroundSize: `${DOT_GRID_SIZE * zoom}px ${DOT_GRID_SIZE * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <div className='absolute top-12px right-12px z-20 flex flex-col items-stretch gap-6px'>
        <button type='button' className='org-structure-chart__zoom-btn' title={t('orgUsers.structure.zoomIn')} aria-label={t('orgUsers.structure.zoomIn')} onClick={() => zoomAroundCenter(1.2)}>
          +
        </button>
        <button type='button' className='org-structure-chart__zoom-btn' title={t('orgUsers.structure.zoomOut')} aria-label={t('orgUsers.structure.zoomOut')} onClick={() => zoomAroundCenter(0.85)}>
          −
        </button>
        <button type='button' className='org-structure-chart__zoom-btn text-11px' title={t('orgUsers.structure.fit')} aria-label={t('orgUsers.structure.fit')} onClick={() => applyView('fit')}>
          {t('orgUsers.structure.fitShort')}
        </button>
        <button type='button' className='org-structure-chart__zoom-btn text-11px' title={t('orgUsers.structure.resetZoom')} aria-label={t('orgUsers.structure.resetZoom')} onClick={() => applyView('actual')}>
          1:1
        </button>
        <span className='org-structure-chart__zoom-readout'>{Math.round(zoom * 100)}%</span>
      </div>

      <div
        className='org-structure-chart__layer absolute inset-0'
        style={{ zIndex: 2, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        {layout.unassigned && (
          <div className='org-structure-chart__section' style={{ left: 0, top: layout.unassigned.labelY - 11, width: layout.width }}>
            <span className='org-structure-chart__section-label'>
              {t('orgUsers.structure.unassigned')} · {layout.unassigned.count}
            </span>
          </div>
        )}

        {layout.nodes.map((node, index) => {
          const user = userMap.get(node.id);
          if (!user) return null;

          const dotColor = statusDotColor(user.employment_status);
          const nodeActive = activeNodeIds.has(node.id);
          const isTreeRoot = layout.treeRootIds.has(node.id);
          const hue = usernameHue(user.username);
          const roleLabel = user.is_admin ? t('orgUsers.role.admin') : t(`orgUsers.role.${user.work_task_role}`, { defaultValue: user.work_task_role });

          return (
            <div
              key={node.id}
              data-org-card
              data-active={nodeActive ? 'true' : 'false'}
              data-root={isTreeRoot ? 'true' : 'false'}
              className='org-structure-chart__card absolute select-none'
              style={{
                left: node.x,
                top: node.y,
                width: ORG_CHART_CARD_W,
                height: ORG_CHART_CARD_H,
                animationDelay: `${Math.min(index, 12) * 24}ms`,
              }}
            >
              {node.children.length > 0 && <span className='org-structure-chart__badge'>{t('orgUsers.structure.reports', { n: node.children.length })}</span>}
              <div className='flex items-center px-18px gap-14px h-full box-border'>
                <div className='relative shrink-0'>
                  <div
                    className='org-structure-chart__avatar'
                    style={{
                      background: `hsl(${hue} 70% 50% / 0.16)`,
                      color: `hsl(${hue} 55% 45%)`,
                    }}
                  >
                    {userInitial(user.username)}
                  </div>
                  <span className='absolute -bottom-1px -right-1px w-14px h-14px rounded-full border-2 border-bg-1' style={{ backgroundColor: dotColor }} title={t(`orgUsers.status.${user.employment_status}`, { defaultValue: user.employment_status })} />
                </div>
                <div className='flex flex-col items-start min-w-0 flex-1'>
                  <span className='org-structure-chart__name truncate max-w-full'>{user.username}</span>
                  <span className='org-structure-chart__meta truncate max-w-full'>{displayLine(user.job_title)}</span>
                  <span className='org-structure-chart__sub truncate max-w-full'>
                    {displayLine(user.department)} · {roleLabel}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/*
        Edges in *screen space* (pan/zoom baked into coordinates), drawn ABOVE cards.
        Avoids Electron bugs where CSS stroke + SVG scale(g) makes paths invisible
        while filled junction circles still show.
      */}
      <svg className='org-structure-chart__edges org-structure-chart__edges--overlay' width='100%' height='100%' aria-hidden>
        {renderEdges.map((edge) => {
          const x1 = pan.x + edge.x1 * zoom;
          const y1 = pan.y + edge.y1 * zoom;
          const x2 = pan.x + edge.x2 * zoom;
          const y2 = pan.y + edge.y2 * zoom;
          const stroke = edge.active ? '#165DFF' : '#4E5969';
          return (
            <path
              key={`${edge.parentId}-${edge.childId}`}
              d={buildEdgePath(x1, y1, x2, y2)}
              fill='none'
              stroke={stroke}
              strokeWidth={2.5}
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          );
        })}
        {parentNodes.map((node) => {
          const cx = pan.x + (node.x + ORG_CHART_CARD_W / 2) * zoom;
          const cy = pan.y + (node.y + ORG_CHART_CARD_H) * zoom;
          return <circle key={`junction-${node.id}`} cx={cx} cy={cy} r={4} fill='#4E5969' stroke='#fff' strokeWidth={1.5} />;
        })}
      </svg>
    </div>
  );
};

function buildSourceForest(users: OrgUser[]): OrgChartSourceNode[] {
  const byId = new Map(users.map((user) => [user.id, user]));
  const childrenMap = new Map<string, OrgUser[]>();

  for (const user of users) {
    const managerId = user.manager_user_id?.trim();
    if (managerId && byId.has(managerId) && managerId !== user.id) {
      const list = childrenMap.get(managerId) ?? [];
      list.push(user);
      childrenMap.set(managerId, list);
    }
  }

  const toNode = (user: OrgUser): OrgChartSourceNode => ({
    id: user.id,
    reports: (childrenMap.get(user.id) ?? []).toSorted((a, b) => a.username.localeCompare(b.username)).map(toNode),
  });

  const roots = users.filter((user) => {
    const managerId = user.manager_user_id?.trim();
    return !managerId || !byId.has(managerId) || managerId === user.id;
  });

  const forest = roots.toSorted((a, b) => a.username.localeCompare(b.username)).map(toNode);

  if (forest.length > 0) return forest;

  return users.toSorted((a, b) => a.username.localeCompare(b.username)).map((user): OrgChartSourceNode => ({ id: user.id, reports: [] }));
}

export default OrgStructureChart;
