/** Shared shapes for the Zelavora Nexus authentication surfaces. */

export type NexusModuleId =
  | 'organizations'
  | 'teams'
  | 'projects'
  | 'timesheets'
  | 'invoices';

/** A business module orbiting the Nexus hub. */
export interface NexusNode {
  readonly id: NexusModuleId;
  readonly label: string;
  /** Centre of the node in the 0–1000 square viewBox of the network graphic. */
  readonly x: number;
  readonly y: number;
  /** Seconds offset so connector pulses never fire in lockstep. */
  readonly delay: number;
}

export interface ValuePoint {
  readonly icon: 'shield' | 'scale' | 'control';
  readonly label: string;
}

export interface AuthStat {
  readonly icon: 'teams' | 'uptime' | 'globe';
  readonly value: string;
  readonly label: string;
}

export type NexusLogoSize = 'xs' | 'sm' | 'md' | 'lg';
