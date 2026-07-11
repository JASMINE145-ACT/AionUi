import { describe, expect, test } from 'vitest';

/**
 * Mirrors ipcBridge.priceLibrary.upsertItem mapBody — keep in sync with
 * packages/desktop/src/common/adapter/ipcBridge.ts
 */
function mapUpsertBody(p: {
  change_type: string;
  product_id?: string;
  material_code?: string;
  fields: Record<string, string | number | null>;
}) {
  return {
    change_type: p.change_type,
    ...(p.product_id ? { product_id: p.product_id } : {}),
    ...(p.material_code ? { material_code: p.material_code } : {}),
    ...p.fields,
  };
}

function mapPublishBody(p: { reason: string; revision: number }) {
  return { reason: p.reason, revision: p.revision };
}

describe('priceLibrary IPC mapBody', () => {
  test('upsert flattens fields onto POST body', () => {
    expect(
      mapUpsertBody({
        change_type: 'update',
        product_id: 'plp-1',
        material_code: '001754',
        fields: { material_code: '001754', price_b: 1000 },
      })
    ).toEqual({
      change_type: 'update',
      product_id: 'plp-1',
      material_code: '001754',
      price_b: 1000,
    });
  });

  test('publish sends reason + revision', () => {
    expect(mapPublishBody({ reason: 'ui', revision: 3 })).toEqual({
      reason: 'ui',
      revision: 3,
    });
  });
});
