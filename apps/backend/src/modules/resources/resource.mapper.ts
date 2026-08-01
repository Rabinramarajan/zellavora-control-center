import { Resource } from '@prisma/client';
import { ResourceListQueryDto } from './resource.dto';

const resourceTypeLabels: Record<string, string> = {
  API: 'API',
  FEATURE: 'Feature',
  DATA: 'Data',
  MENU: 'Menu',
  REPORT: 'Report',
  INTEGRATION: 'Integration',
};

export interface ResourceListItemDto {
  id: string;
  name: string;
  key: string;
  type: string;
  typeLabel: string;
  category: string | null;
  description: string | null;
  status: string;
  parentId: string | null;
  ownerId: string | null;
  isSystem: boolean;
  actionCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceActionDto {
  id: string;
  action: string;
  permissionId: string | null;
  permissionKey: string | null;
}

export interface ResourceDetailDto extends ResourceListItemDto {
  metadata: Record<string, unknown> | null;
  actions: ResourceActionDto[];
  children: { id: string; name: string }[];
  parents: Array<{ id: string; name: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResourceRow = Resource & {
  actions?: Array<{ id: string; action: string; permissionId: string | null; permission?: { key: string } | null }>;
  children?: Array<{ id: string; name: string }>;
  _count?: { children: number };
};

export class ResourceMapper {
  static toListItem(row: ResourceRow, parents: Array<{ id: string; name: string }> = []): ResourceListItemDto {
    return {
      id: row.id,
      name: row.name,
      key: row.key,
      type: row.type,
      typeLabel: resourceTypeLabels[row.type] ?? row.type,
      category: row.category ?? null,
      description: row.description ?? null,
      status: row.status,
      parentId: row.parentId ?? null,
      ownerId: row.ownerId ?? null,
      isSystem: row.isSystem,
      actionCount: row.actions?.length ?? 0,
      childCount: row._count?.children ?? row.children?.length ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  static toDetail(row: ResourceRow, parents: Array<{ id: string; name: string }>): ResourceDetailDto {
    return {
      ...this.toListItem(row, parents),
      metadata: (row.metadata as Record<string, unknown>) ?? null,
      actions: (row.actions ?? []).map((a) => ({
        id: a.id,
        action: a.action,
        permissionId: a.permissionId ?? null,
        permissionKey: a.permission?.key ?? null,
      })),
      children: row.children ?? [],
      parents,
    };
  }
}
