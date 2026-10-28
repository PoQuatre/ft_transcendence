export const PAGE_SIZES = [5, 10, 20] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export function paginate<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize: PageSize,
) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, requestedPage));
  const offset = (page - 1) * pageSize;
  return {
    page,
    totalPages,
    start: items.length === 0 ? 0 : offset + 1,
    end: Math.min(offset + pageSize, items.length),
    items: items.slice(offset, offset + pageSize),
  };
}
