import { Injectable, signal, computed } from '@angular/core';
import {
  ComponentPermissionState,
  ComponentState,
  ComponentType,
  ComponentPermission,
} from '../../shared/models/component-permission.model';

/**
 * Component Permission Signal Store
 * Manages component permission state reactively using Angular signals
 */
@Injectable({ providedIn: 'root' })
export class ComponentPermissionStore {
  // State signals
  private readonly componentStates = signal<Map<string, ComponentPermissionState>>(new Map());
  private readonly componentConfigs = signal<Map<string, ComponentPermission>>(new Map());
  private readonly componentVisibility = signal<Map<string, boolean>>(new Map());
  private readonly componentEditable = signal<Map<string, boolean>>(new Map());
  private readonly componentDisabled = signal<Map<string, boolean>>(new Map());
  private readonly componentReadonly = signal<Map<string, boolean>>(new Map());
  private readonly lastUpdate = signal<number>(Date.now());

  // Read-only accessors
  readonly states = this.componentStates.asReadonly();
  readonly configs = this.componentConfigs.asReadonly();
  readonly visibility = this.componentVisibility.asReadonly();
  readonly editable = this.componentEditable.asReadonly();
  readonly disabled = this.componentDisabled.asReadonly();
  readonly readonly = this.componentReadonly.asReadonly();

  // Computed selectors
  readonly visibleComponents = computed(() => {
    const visible: string[] = [];
    this.componentVisibility().forEach((isVisible, componentId) => {
      if (isVisible) visible.push(componentId);
    });
    return visible;
  });

  readonly hiddenComponents = computed(() => {
    const hidden: string[] = [];
    this.componentVisibility().forEach((isVisible, componentId) => {
      if (!isVisible) hidden.push(componentId);
    });
    return hidden;
  });

  readonly disabledComponents = computed(() => {
    const disabled: string[] = [];
    this.componentDisabled().forEach((isDisabled, componentId) => {
      if (isDisabled) disabled.push(componentId);
    });
    return disabled;
  });

  readonly editableComponents = computed(() => {
    const editable: string[] = [];
    this.componentEditable().forEach((isEditable, componentId) => {
      if (isEditable) editable.push(componentId);
    });
    return editable;
  });

  readonly readonlyComponents = computed(() => {
    const readonly: string[] = [];
    this.componentReadonly().forEach((isReadonly, componentId) => {
      if (isReadonly) readonly.push(componentId);
    });
    return readonly;
  });

  /**
   * Set component state
   */
  setComponentState(componentId: string, state: ComponentPermissionState): void {
    const updated = new Map(this.componentStates());
    updated.set(componentId, state);
    this.componentStates.set(updated);

    // Update derived states
    this.updateDerivedStates(componentId, state);
    this.lastUpdate.set(Date.now());
  }

  /**
   * Set multiple component states
   */
  setComponentStates(states: Map<string, ComponentPermissionState> | Record<string, ComponentPermissionState>): void {
    const map = states instanceof Map ? states : new Map(Object.entries(states));
    const updated = new Map(this.componentStates());

    map.forEach((state, componentId) => {
      updated.set(componentId, state);
      this.updateDerivedStates(componentId, state);
    });

    this.componentStates.set(updated);
    this.lastUpdate.set(Date.now());
  }

  /**
   * Register component configuration
   */
  registerComponentConfig(componentId: string, config: ComponentPermission): void {
    const updated = new Map(this.componentConfigs());
    updated.set(componentId, config);
    this.componentConfigs.set(updated);
  }

  /**
   * Get component state
   */
  getComponentState(componentId: string): ComponentPermissionState | undefined {
    return this.componentStates().get(componentId);
  }

  /**
   * Get component config
   */
  getComponentConfig(componentId: string): ComponentPermission | undefined {
    return this.componentConfigs().get(componentId);
  }

  /**
   * Check if component is visible
   */
  isVisible(componentId: string): boolean {
    return this.componentVisibility().get(componentId) ?? true;
  }

  /**
   * Check if component is disabled
   */
  isDisabled(componentId: string): boolean {
    return this.componentDisabled().get(componentId) ?? false;
  }

  /**
   * Check if component is readonly
   */
  isReadonly(componentId: string): boolean {
    return this.componentReadonly().get(componentId) ?? false;
  }

  /**
   * Check if component is editable
   */
  isEditable(componentId: string): boolean {
    return this.componentEditable().get(componentId) ?? false;
  }

  /**
   * Get component CSS classes
   */
  getComponentClasses(componentId: string, baseClasses?: string): string {
    const state = this.componentStates().get(componentId);
    if (!state) return baseClasses || '';

    let classes = baseClasses || '';

    if (!state.isVisible) {
      classes += ' hidden';
    } else if (state.isDisabled) {
      classes += ' disabled opacity-50 cursor-not-allowed';
    } else if (state.isReadonly) {
      classes += ' readonly opacity-75 pointer-events-none';
    }

    return classes.trim();
  }

  /**
   * Get component attribute bindings
   */
  getComponentAttributes(componentId: string): {
    disabled?: boolean;
    readonly?: boolean;
    hidden?: boolean;
  } {
    const state = this.componentStates().get(componentId);
    if (!state) return {};

    return {
      disabled: state.isDisabled ? true : undefined,
      readonly: state.isReadonly ? true : undefined,
      hidden: !state.isVisible ? true : undefined,
    };
  }

  /**
   * Clear state for component
   */
  clearComponentState(componentId: string): void {
    const updated = new Map(this.componentStates());
    updated.delete(componentId);
    this.componentStates.set(updated);

    this.clearDerivedStates(componentId);
    this.lastUpdate.set(Date.now());
  }

  /**
   * Clear all states
   */
  clearAll(): void {
    this.componentStates.set(new Map());
    this.componentConfigs.set(new Map());
    this.componentVisibility.set(new Map());
    this.componentEditable.set(new Map());
    this.componentDisabled.set(new Map());
    this.componentReadonly.set(new Map());
    this.lastUpdate.set(Date.now());
  }

  /**
   * Get store snapshot
   */
  getSnapshot() {
    return {
      states: new Map(this.componentStates()),
      configs: new Map(this.componentConfigs()),
      visibility: new Map(this.componentVisibility()),
      editable: new Map(this.componentEditable()),
      disabled: new Map(this.componentDisabled()),
      readonly: new Map(this.componentReadonly()),
      lastUpdate: this.lastUpdate(),
    };
  }

  /**
   * Private helper methods
   */

  private updateDerivedStates(componentId: string, state: ComponentPermissionState): void {
    const visibilityMap = new Map(this.componentVisibility());
    visibilityMap.set(componentId, state.isVisible);
    this.componentVisibility.set(visibilityMap);

    const disabledMap = new Map(this.componentDisabled());
    disabledMap.set(componentId, state.isDisabled);
    this.componentDisabled.set(disabledMap);

    const readonlyMap = new Map(this.componentReadonly());
    readonlyMap.set(componentId, state.isReadonly);
    this.componentReadonly.set(readonlyMap);

    const editableMap = new Map(this.componentEditable());
    editableMap.set(componentId, state.isEditable);
    this.componentEditable.set(editableMap);
  }

  private clearDerivedStates(componentId: string): void {
    const visibilityMap = new Map(this.componentVisibility());
    visibilityMap.delete(componentId);
    this.componentVisibility.set(visibilityMap);

    const disabledMap = new Map(this.componentDisabled());
    disabledMap.delete(componentId);
    this.componentDisabled.set(disabledMap);

    const readonlyMap = new Map(this.componentReadonly());
    readonlyMap.delete(componentId);
    this.componentReadonly.set(readonlyMap);

    const editableMap = new Map(this.componentEditable());
    editableMap.delete(componentId);
    this.componentEditable.set(editableMap);
  }
}
