export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export class FormValidation {
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateRequired(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  static validateMinLength(value: string, minLength: number): boolean {
    return value.length >= minLength;
  }

  static validateMaxLength(value: string, maxLength: number): boolean {
    return value.length <= maxLength;
  }

  static validatePhone(phone: string): boolean {
    const phoneRegex = /^[0-9\-\+\s\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  static validateAlphanumeric(value: string): boolean {
    const alphanumericRegex = /^[a-zA-Z0-9_-]*$/;
    return alphanumericRegex.test(value);
  }

  static validateUser(user: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!this.validateRequired(user.userLoginId)) {
      errors.push({ field: 'userLoginId', message: 'Login ID is required' });
    }

    if (!this.validateRequired(user.firstName)) {
      errors.push({ field: 'firstName', message: 'First name is required' });
    }

    if (!this.validateRequired(user.lastName)) {
      errors.push({ field: 'lastName', message: 'Last name is required' });
    }

    if (!this.validateRequired(user.emailId)) {
      errors.push({ field: 'emailId', message: 'Email is required' });
    } else if (!this.validateEmail(user.emailId)) {
      errors.push({ field: 'emailId', message: 'Invalid email format' });
    }

    if (user.statusValue && !['Active', 'Inactive', 'Suspended'].includes(user.statusValue)) {
      errors.push({ field: 'statusValue', message: 'Invalid status' });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateRole(role: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!this.validateRequired(role.roleName)) {
      errors.push({ field: 'roleName', message: 'Role name is required' });
    }

    if (role.roleName && !this.validateMinLength(role.roleName, 3)) {
      errors.push({ field: 'roleName', message: 'Role name must be at least 3 characters' });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateResource(resource: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!this.validateRequired(resource.resourceName)) {
      errors.push({ field: 'resourceName', message: 'Resource name is required' });
    }

    if (!this.validateRequired(resource.resourceType)) {
      errors.push({ field: 'resourceType', message: 'Resource type is required' });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateBranch(branch: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!this.validateRequired(branch.branchCode)) {
      errors.push({ field: 'branchCode', message: 'Branch code is required' });
    }

    if (!this.validateRequired(branch.branchName)) {
      errors.push({ field: 'branchName', message: 'Branch name is required' });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateConfig(config: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!this.validateRequired(config.configCode)) {
      errors.push({ field: 'configCode', message: 'Config code is required' });
    }

    if (!this.validateRequired(config.configValue)) {
      errors.push({ field: 'configValue', message: 'Config value is required' });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
