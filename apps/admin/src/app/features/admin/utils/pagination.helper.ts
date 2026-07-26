export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

export interface PaginationResult {
  startIndex: number;
  endIndex: number;
  totalPages: number;
  canPrevious: boolean;
  canNext: boolean;
}

export class PaginationHelper {
  static calculatePagination(state: PaginationState): PaginationResult {
    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = Math.min(startIndex + state.pageSize, state.totalItems);
    const totalPages = Math.ceil(state.totalItems / state.pageSize);

    return {
      startIndex,
      endIndex,
      totalPages,
      canPrevious: state.currentPage > 1,
      canNext: state.currentPage < totalPages,
    };
  }

  static getPageItems<T>(items: T[], pageSize: number, pageNumber: number): T[] {
    const startIndex = (pageNumber - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }

  static getTotalPages(itemCount: number, pageSize: number): number {
    return Math.ceil(itemCount / pageSize);
  }

  static isValidPage(page: number, totalPages: number): boolean {
    return page > 0 && page <= totalPages;
  }

  static clampPage(page: number, totalPages: number): number {
    if (totalPages === 0) return 1;
    return Math.max(1, Math.min(page, totalPages));
  }
}
