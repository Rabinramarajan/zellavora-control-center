import { PaginationHelper } from './pagination.helper';

describe('PaginationHelper', () => {
  describe('calculatePagination', () => {
    it('should calculate pagination correctly for first page', () => {
      const result = PaginationHelper.calculatePagination({
        currentPage: 1,
        pageSize: 10,
        totalItems: 50,
      });

      expect(result.startIndex).toBe(0);
      expect(result.endIndex).toBe(10);
      expect(result.totalPages).toBe(5);
      expect(result.canPrevious).toBe(false);
      expect(result.canNext).toBe(true);
    });

    it('should calculate pagination correctly for middle page', () => {
      const result = PaginationHelper.calculatePagination({
        currentPage: 3,
        pageSize: 10,
        totalItems: 50,
      });

      expect(result.startIndex).toBe(20);
      expect(result.endIndex).toBe(30);
      expect(result.canPrevious).toBe(true);
      expect(result.canNext).toBe(true);
    });

    it('should calculate pagination correctly for last page', () => {
      const result = PaginationHelper.calculatePagination({
        currentPage: 5,
        pageSize: 10,
        totalItems: 50,
      });

      expect(result.startIndex).toBe(40);
      expect(result.endIndex).toBe(50);
      expect(result.canPrevious).toBe(true);
      expect(result.canNext).toBe(false);
    });

    it('should handle partial last page', () => {
      const result = PaginationHelper.calculatePagination({
        currentPage: 3,
        pageSize: 10,
        totalItems: 25,
      });

      expect(result.startIndex).toBe(20);
      expect(result.endIndex).toBe(25);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('getPageItems', () => {
    const items = Array.from({ length: 50 }, (_, i) => i + 1);

    it('should get items for first page', () => {
      const result = PaginationHelper.getPageItems(items, 10, 1);

      expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('should get items for specified page', () => {
      const result = PaginationHelper.getPageItems(items, 10, 3);

      expect(result).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
    });
  });

  describe('getTotalPages', () => {
    it('should calculate total pages correctly', () => {
      expect(PaginationHelper.getTotalPages(50, 10)).toBe(5);
      expect(PaginationHelper.getTotalPages(55, 10)).toBe(6);
      expect(PaginationHelper.getTotalPages(10, 10)).toBe(1);
    });
  });

  describe('isValidPage', () => {
    it('should validate page numbers', () => {
      expect(PaginationHelper.isValidPage(1, 5)).toBe(true);
      expect(PaginationHelper.isValidPage(5, 5)).toBe(true);
      expect(PaginationHelper.isValidPage(0, 5)).toBe(false);
      expect(PaginationHelper.isValidPage(6, 5)).toBe(false);
    });
  });

  describe('clampPage', () => {
    it('should clamp page to valid range', () => {
      expect(PaginationHelper.clampPage(0, 5)).toBe(1);
      expect(PaginationHelper.clampPage(3, 5)).toBe(3);
      expect(PaginationHelper.clampPage(10, 5)).toBe(5);
      expect(PaginationHelper.clampPage(0, 0)).toBe(1);
    });
  });
});
