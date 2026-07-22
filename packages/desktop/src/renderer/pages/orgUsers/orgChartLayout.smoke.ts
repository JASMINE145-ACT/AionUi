/**
 * Smoke check for hybrid org chart layout — edges exist when manager links exist.
 * Run: npx --yes tsx packages/desktop/src/renderer/pages/orgUsers/orgChartLayout.smoke.ts
 */
import { computeOrgChartLayout, type OrgChartSourceNode } from './orgChartLayout';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const forest: OrgChartSourceNode[] = [
  {
    id: 'boss',
    reports: [
      { id: 'a', reports: [] },
      { id: 'b', reports: [] },
      { id: 'c', reports: [] },
    ],
  },
  { id: 'loose1', reports: [] },
  { id: 'loose2', reports: [] },
];

const layout = computeOrgChartLayout(forest);
assert(layout.edges.length === 3, `expected 3 edges, got ${layout.edges.length}`);
assert(layout.unassigned?.count === 2, `expected 2 unassigned, got ${layout.unassigned?.count}`);
assert(layout.nodes.length === 6, `expected 6 nodes, got ${layout.nodes.length}`);
assert(layout.height > layout.nodes[0].y + 200, 'tree+grid height should extend');

console.log('orgChartLayout.smoke PASS', {
  edges: layout.edges.length,
  unassigned: layout.unassigned?.count,
  size: `${layout.width}x${layout.height}`,
});
