import {
  Model,
  Document,
  FilterQuery,
  UpdateQuery,
  QueryOptions,
  Types,
  SaveOptions,
  UpdateWriteOpResult,
  mongo,
} from 'mongoose';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantViolationException } from '../tenant-context/tenant-context.exceptions';

export interface TenantScopedEntity {
  organizationId: Types.ObjectId | string;
}

/**
 * Reusable abstract base repository for all tenant-owned entities.
 * Automatically enforces tenant isolation by injecting the active organizationId
 * into all reads, writes, updates, and deletes.
 */
export abstract class TenantAwareRepository<T extends Document & TenantScopedEntity> {
  constructor(
    protected readonly model: Model<T>,
    protected readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Enforces that the active tenant context matches the filter's tenant (if specified),
   * and merges the required { organizationId } constraint into the final query filter.
   */
  protected applyTenantFilter(filter: FilterQuery<T> = {}): FilterQuery<T> {
    const activeTenantId = this.tenantContext.requireOrganizationId();

    if (filter['organizationId'] !== undefined) {
      const requestedId = String(filter['organizationId']);
      if (requestedId !== String(activeTenantId)) {
        throw new TenantViolationException(requestedId, activeTenantId);
      }
    }

    return {
      ...filter,
      organizationId: activeTenantId,
    };
  }

  /**
   * Find documents matching query within the active tenant context.
   */
  async find(
    filter: FilterQuery<T> = {},
    projection?: unknown,
    options?: QueryOptions<T>,
  ): Promise<T[]> {
    const scopedFilter = this.applyTenantFilter(filter);
    return this.model.find(scopedFilter, projection as any, options).exec();
  }

  /**
   * Find a single document matching query within the active tenant context.
   */
  async findOne(
    filter: FilterQuery<T> = {},
    projection?: unknown,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    const scopedFilter = this.applyTenantFilter(filter);
    return this.model.findOne(scopedFilter, projection as any, options).exec();
  }

  /**
   * Find a single document by its _id within the active tenant context.
   */
  async findById(
    id: string | Types.ObjectId,
    projection?: unknown,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    const scopedFilter = this.applyTenantFilter({ _id: id } as FilterQuery<T>);
    return this.model.findOne(scopedFilter, projection as any, options).exec();
  }

  /**
   * Create and persist a new document, automatically stamped with the active organizationId.
   */
  async create(doc: Partial<T>, options?: SaveOptions): Promise<T> {
    const activeTenantId = this.tenantContext.requireOrganizationId();

    if (doc.organizationId !== undefined) {
      const requestedId = String(doc.organizationId);
      if (requestedId !== String(activeTenantId)) {
        throw new TenantViolationException(requestedId, activeTenantId);
      }
    }

    const createdDoc = new this.model({
      ...doc,
      organizationId: activeTenantId,
    });

    return createdDoc.save(options);
  }

  /**
   * Update one document matching query within the active tenant context.
   */
  async updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: (mongo.UpdateOptions & Record<string, unknown>) | null,
  ): Promise<UpdateWriteOpResult> {
    const scopedFilter = this.applyTenantFilter(filter);
    return this.model.updateOne(scopedFilter, update, options).exec();
  }

  /**
   * Find one document and update it within the active tenant context.
   */
  async findOneAndUpdate(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    const scopedFilter = this.applyTenantFilter(filter);
    return this.model.findOneAndUpdate(scopedFilter, update, options).exec();
  }

  /**
   * Delete one document matching query within the active tenant context.
   */
  async deleteOne(
    filter: FilterQuery<T>,
    options?: (mongo.DeleteOptions & Record<string, unknown>) | null,
  ): Promise<{ deletedCount: number }> {
    const scopedFilter = this.applyTenantFilter(filter);
    return this.model.deleteOne(scopedFilter, options).exec();
  }

  /**
   * Count documents matching query within the active tenant context.
   */
  async countDocuments(
    filter: FilterQuery<T> = {},
    options?: (mongo.CountOptions & Record<string, unknown>) | null,
  ): Promise<number> {
    const scopedFilter = this.applyTenantFilter(filter);
    return this.model.countDocuments(scopedFilter, options).exec();
  }
}
