import { FormValidation } from './form-validation';

describe('FormValidation', () => {
  describe('validateEmail', () => {
    it('should validate correct emails', () => {
      expect(FormValidation.validateEmail('test@example.com')).toBe(true);
      expect(FormValidation.validateEmail('user.name@example.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(FormValidation.validateEmail('invalid')).toBe(false);
      expect(FormValidation.validateEmail('invalid@')).toBe(false);
      expect(FormValidation.validateEmail('@example.com')).toBe(false);
    });
  });

  describe('validateRequired', () => {
    it('should validate non-empty strings', () => {
      expect(FormValidation.validateRequired('value')).toBe(true);
      expect(FormValidation.validateRequired('  value  ')).toBe(true);
    });

    it('should reject empty or null values', () => {
      expect(FormValidation.validateRequired('')).toBe(false);
      expect(FormValidation.validateRequired('   ')).toBe(false);
      expect(FormValidation.validateRequired(null)).toBe(false);
      expect(FormValidation.validateRequired(undefined)).toBe(false);
    });
  });

  describe('validateMinLength', () => {
    it('should validate minimum length', () => {
      expect(FormValidation.validateMinLength('hello', 3)).toBe(true);
      expect(FormValidation.validateMinLength('hello', 5)).toBe(true);
    });

    it('should reject strings below minimum length', () => {
      expect(FormValidation.validateMinLength('hi', 3)).toBe(false);
    });
  });

  describe('validateMaxLength', () => {
    it('should validate maximum length', () => {
      expect(FormValidation.validateMaxLength('hello', 5)).toBe(true);
      expect(FormValidation.validateMaxLength('hello', 10)).toBe(true);
    });

    it('should reject strings above maximum length', () => {
      expect(FormValidation.validateMaxLength('hello', 3)).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should validate valid phone numbers', () => {
      expect(FormValidation.validatePhone('+1-555-123-4567')).toBe(true);
      expect(FormValidation.validatePhone('555 123 4567')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(FormValidation.validatePhone('123')).toBe(false);
      expect(FormValidation.validatePhone('abc-def-ghij')).toBe(false);
    });
  });

  describe('validateUser', () => {
    it('should validate correct user', () => {
      const user = {
        userLoginId: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        emailId: 'test@example.com',
        statusValue: 'Active',
      };

      const result = FormValidation.validateUser(user);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should catch missing required fields', () => {
      const user = {
        userLoginId: '',
        firstName: 'Test',
        lastName: 'User',
        emailId: 'test@example.com',
        statusValue: 'Active',
      };

      const result = FormValidation.validateUser(user);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'userLoginId')).toBe(true);
    });

    it('should catch invalid email', () => {
      const user = {
        userLoginId: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        emailId: 'invalid-email',
        statusValue: 'Active',
      };

      const result = FormValidation.validateUser(user);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'emailId')).toBe(true);
    });
  });

  describe('validateRole', () => {
    it('should validate correct role', () => {
      const role = {
        roleName: 'Admin',
        roleDescription: 'Administrator role',
      };

      const result = FormValidation.validateRole(role);
      expect(result.isValid).toBe(true);
    });

    it('should validate role name length', () => {
      const role = {
        roleName: 'AB',
        roleDescription: 'Short name',
      };

      const result = FormValidation.validateRole(role);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'roleName')).toBe(true);
    });
  });

  describe('validateBranch', () => {
    it('should validate correct branch', () => {
      const branch = {
        branchCode: 'BR001',
        branchName: 'Main Branch',
      };

      const result = FormValidation.validateBranch(branch);
      expect(result.isValid).toBe(true);
    });

    it('should catch missing branch code', () => {
      const branch = {
        branchCode: '',
        branchName: 'Main Branch',
      };

      const result = FormValidation.validateBranch(branch);
      expect(result.isValid).toBe(false);
    });
  });
});
