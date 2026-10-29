import { describe, expect, it } from "vitest";
import { fetchAll } from "../src/tools/transactions.js";

// 3,000 transactions, one a day, newest first, as ThriveCart pages them.
const DAY = 86_400_000;
const NEWEST = Date.UTC(2026, 9, 29, 12);
const newestFirst = Array.from({ length: 3000 }, (_, i) => ({
  transaction_id: i,
  date: new Date(NEWEST - i * DAY).toISOString(),
  amount: "1.00",
}));

function fakeClient(rows: Record<string, unknown>[]) {
  const pages: number[] = [];
  return {
    pages,
    client: {
      async get(_account: unknown, _path: string, query: { page: number; perPage: number }) {
        pages.push(query.page);
        const start = (query.page - 1) * query.perPage;
        return { transactions: rows.slice(start, start + query.perPage) };
      },
    },
  };
}

const config = { maxPages: 100 } as never;
const account = { name: "default" } as never;

describe("fetchAll", () => {
  it("stops paging once a newest-first page is older than the start date", async () => {
    const { client, pages } = fakeClient(newestFirst);
    const { rows, truncated } = await fetchAll(client as never, config, account, {}, new Date("2026-10-28"));
    expect(pages).toEqual([1]);
    expect(truncated).toBe(false);
    expect(rows.length).toBe(100);
  });

  it("walks as many pages as the start date needs, and no more", async () => {
    const { client, pages } = fakeClient(newestFirst);
    // 250 days back is inside page 3.
    const since = new Date(NEWEST - 250 * DAY);
    await fetchAll(client as never, config, account, {}, since);
    expect(pages).toEqual([1, 2, 3]);
  });

  it("walks every page when the rows are not newest first", async () => {
    const { client, pages } = fakeClient([...newestFirst].reverse());
    await fetchAll(client as never, config, account, {}, new Date("2026-10-28"));
    // 30 full pages, then the empty page that ends the walk.
    expect(pages.length).toBe(31);
  });

  it("walks every page with no start date", async () => {
    const { client, pages } = fakeClient(newestFirst);
    await fetchAll(client as never, config, account, {});
    // 30 full pages, then the empty page that ends the walk.
    expect(pages.length).toBe(31);
  });
});
