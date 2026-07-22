/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hybrid tree layout for org structure chart — adapted from Rudder OrgChart.tsx.
 *
 * Reporting trees (roots that have direct reports) are laid out top-center with
 * classic recursive tidy-tree positioning. Users without a manager AND without
 * reports are grouped into an "unassigned" grid section below the trees, so a
 * single manager link never degrades the whole chart into one ultra-wide strip.
 */

/** Card size tuned for readable name + title + dept at zoom 1. */
export const ORG_CHART_CARD_W = 264;
export const ORG_CHART_CARD_H = 116;
/** Outer padding around the whole chart content. */
export const ORG_CHART_PADDING = 64;

const GAP_X = 48;
const GAP_Y = 120;
const TREE_GAP_X = 112;
/** Distance from the bottom of the tree block to the unassigned-section label. */
const SECTION_GAP = 96;
/** Distance from the section label to the first grid row. */
const LABEL_TO_GRID = 48;
const GRID_GAP_X = 32;
const GRID_GAP_Y = 36;
const GRID_MIN_COLS = 3;
const GRID_MAX_COLS = 8;

export type OrgChartSourceNode = {
  id: string;
  reports: OrgChartSourceNode[];
};

export type OrgChartLayoutNode = {
  id: string;
  x: number;
  y: number;
  children: OrgChartLayoutNode[];
};

export type OrgChartEdge = {
  parent: OrgChartLayoutNode;
  child: OrgChartLayoutNode;
};

export type OrgChartUnassignedSection = {
  /** Vertical center of the section label, in chart coordinates. */
  labelY: number;
  count: number;
};

export type OrgChartLayout = {
  /** All nodes, flattened in render order (trees first, then grid). */
  nodes: OrgChartLayoutNode[];
  edges: OrgChartEdge[];
  width: number;
  height: number;
  /** Horizontal anchor for the initial view — center of the tree block, or of the grid. */
  focusX: number;
  /** Ids of roots that actually have reports (used for root-card accent). */
  treeRootIds: ReadonlySet<string>;
  unassigned: OrgChartUnassignedSection | null;
};

function subtreeWidth(node: OrgChartSourceNode): number {
  if (node.reports.length === 0) return ORG_CHART_CARD_W;
  const childrenW = node.reports.reduce((sum, child) => sum + subtreeWidth(child), 0);
  const gaps = (node.reports.length - 1) * GAP_X;
  return Math.max(ORG_CHART_CARD_W, childrenW + gaps);
}

function layoutTree(node: OrgChartSourceNode, x: number, y: number): OrgChartLayoutNode {
  const totalW = subtreeWidth(node);
  const layoutChildren: OrgChartLayoutNode[] = [];

  if (node.reports.length > 0) {
    const childrenW = node.reports.reduce((sum, child) => sum + subtreeWidth(child), 0);
    const gaps = (node.reports.length - 1) * GAP_X;
    let cx = x + (totalW - childrenW - gaps) / 2;

    for (const child of node.reports) {
      const cw = subtreeWidth(child);
      layoutChildren.push(layoutTree(child, cx, y + ORG_CHART_CARD_H + GAP_Y));
      cx += cw + GAP_X;
    }
  }

  return {
    id: node.id,
    x: x + (totalW - ORG_CHART_CARD_W) / 2,
    y,
    children: layoutChildren,
  };
}

function flattenNodes(roots: OrgChartLayoutNode[]): OrgChartLayoutNode[] {
  const result: OrgChartLayoutNode[] = [];
  const walk = (node: OrgChartLayoutNode) => {
    result.push(node);
    node.children.forEach(walk);
  };
  roots.forEach(walk);
  return result;
}

function collectEdges(roots: OrgChartLayoutNode[]): OrgChartEdge[] {
  const edges: OrgChartEdge[] = [];
  const walk = (node: OrgChartLayoutNode) => {
    for (const child of node.children) {
      edges.push({ parent: node, child });
      walk(child);
    }
  };
  roots.forEach(walk);
  return edges;
}

function clampCols(cols: number, count: number): number {
  return Math.max(1, Math.min(Math.max(cols, GRID_MIN_COLS), GRID_MAX_COLS, count));
}

/** Columns for a standalone grid — biased slightly wider than tall. */
function colsBySqrt(count: number): number {
  return clampCols(Math.ceil(Math.sqrt(count * 1.6)), count);
}

/** Columns matched to the tree block width so the two sections align visually. */
function colsForWidth(targetW: number, count: number): number {
  return clampCols(Math.round((targetW + GRID_GAP_X) / (ORG_CHART_CARD_W + GRID_GAP_X)), count);
}

const EMPTY_LAYOUT: OrgChartLayout = {
  nodes: [],
  edges: [],
  width: 800,
  height: 600,
  focusX: 400,
  treeRootIds: new Set<string>(),
  unassigned: null,
};

export function computeOrgChartLayout(forest: OrgChartSourceNode[]): OrgChartLayout {
  if (forest.length === 0) return EMPTY_LAYOUT;

  const treeSources = forest
    .filter((root) => root.reports.length > 0)
    .toSorted((a, b) => subtreeWidth(b) - subtreeWidth(a));
  const looseSources = forest.filter((root) => root.reports.length === 0);

  const treeBlockW =
    treeSources.length > 0
      ? treeSources.reduce((sum, root) => sum + subtreeWidth(root), 0) + (treeSources.length - 1) * TREE_GAP_X
      : 0;

  const gridCols =
    looseSources.length > 0
      ? treeSources.length > 0
        ? colsForWidth(treeBlockW, looseSources.length)
        : colsBySqrt(looseSources.length)
      : 0;
  const gridW = gridCols > 0 ? gridCols * ORG_CHART_CARD_W + (gridCols - 1) * GRID_GAP_X : 0;

  const contentW = Math.max(treeBlockW, gridW);
  const roots: OrgChartLayoutNode[] = [];

  // Tree block, horizontally centered within the content area.
  let treeBlockCenterX = 0;
  if (treeSources.length > 0) {
    const treeLeft = ORG_CHART_PADDING + (contentW - treeBlockW) / 2;
    treeBlockCenterX = treeLeft + treeBlockW / 2;
    let x = treeLeft;
    for (const source of treeSources) {
      const w = subtreeWidth(source);
      roots.push(layoutTree(source, x, ORG_CHART_PADDING));
      x += w + TREE_GAP_X;
    }
  }

  const treesBottom = flattenNodes(roots).reduce((max, node) => Math.max(max, node.y + ORG_CHART_CARD_H), 0);

  // Unassigned grid section below the trees.
  let unassigned: OrgChartUnassignedSection | null = null;
  if (looseSources.length > 0) {
    let gridTop = ORG_CHART_PADDING;
    if (treeSources.length > 0) {
      const labelY = treesBottom + SECTION_GAP;
      unassigned = { labelY, count: looseSources.length };
      gridTop = labelY + LABEL_TO_GRID;
    }
    const gridLeft = ORG_CHART_PADDING + (contentW - gridW) / 2;
    looseSources.forEach((source, index) => {
      const col = index % gridCols;
      const row = Math.floor(index / gridCols);
      roots.push({
        id: source.id,
        x: gridLeft + col * (ORG_CHART_CARD_W + GRID_GAP_X),
        y: gridTop + row * (ORG_CHART_CARD_H + GRID_GAP_Y),
        children: [],
      });
    });
  }

  const nodes = flattenNodes(roots);
  const edges = collectEdges(roots);
  const maxY = nodes.reduce((max, node) => Math.max(max, node.y + ORG_CHART_CARD_H), 0);

  const width = contentW + ORG_CHART_PADDING * 2;
  const height = maxY + ORG_CHART_PADDING;
  const focusX = treeSources.length > 0 ? treeBlockCenterX : width / 2;

  return {
    nodes,
    edges,
    width,
    height,
    focusX,
    treeRootIds: new Set(treeSources.map((source) => source.id)),
    unassigned,
  };
}
