import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}
  private async removeR2Image(imageUrl: string | null | undefined) {
    const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
    const bucket = process.env.R2_BUCKET_NAME;
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!imageUrl || !publicUrl || !bucket || !endpoint || !accessKeyId || !secretAccessKey) return;
    if (!imageUrl.startsWith(`${publicUrl}/`)) return;
    const key = imageUrl.slice(publicUrl.length + 1);
    try {
      await new S3Client({ region: 'auto', endpoint, credentials: { accessKeyId, secretAccessKey } }).send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
    } catch (error) {
      // Do not fail a product update just because cleanup is unavailable.
      console.warn(`Unable to remove old R2 image ${key}.`, error);
    }
  }
  list(businessId: string) {
    return this.prisma.product.findMany({
      where: { businessId },
      include: {
        category: true,
        modifierGroups: {
          include: { options: true },
          orderBy: { createdAt: 'asc' },
        },
        variants: {
          select: { id: true, name: true, sku: true, cost: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }
  listCategories(businessId: string) {
    return this.prisma.category.findMany({
      where: { businessId },
      include: { _count: { select: { products: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
  async reorderProducts(businessId: string, items: { id: string; sortOrder: number }[]) {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.product.updateMany({
          where: { id: item.id, businessId },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    return { success: true };
  }
  async reorderCategories(businessId: string, items: { id: string; sortOrder: number }[]) {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.category.updateMany({
          where: { id: item.id, businessId },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    return { success: true };
  }
  async createCategory(businessId: string, name: string) {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName) throw new BadRequestException('Category name is required.');
    const existing = await this.prisma.category.findFirst({
      where: { businessId, name: { equals: cleanName, mode: 'insensitive' } },
    });
    if (existing)
      throw new ConflictException(`“${existing.name}” already exists.`);
    return this.prisma.category.create({
      data: { businessId, name: cleanName },
    });
  }
  async updateCategory(businessId: string, categoryId: string, name: string) {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName) throw new BadRequestException('Category name is required.');
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, businessId } });
    if (!category) throw new NotFoundException('Category not found.');
    const duplicate = await this.prisma.category.findFirst({
      where: { businessId, id: { not: categoryId }, name: { equals: cleanName, mode: 'insensitive' } },
    });
    if (duplicate) throw new ConflictException(`“${duplicate.name}” already exists.`);
    return this.prisma.category.update({ where: { id: categoryId }, data: { name: cleanName } });
  }
  async deleteCategory(businessId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, businessId },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException('Category not found.');
    if (category._count.products) {
      throw new BadRequestException(`Move or remove the ${category._count.products} product(s) in “${category.name}” before deleting this category.`);
    }
    await this.prisma.category.delete({ where: { id: categoryId } });
    return { message: `Category “${category.name}” deleted.` };
  }
  listOptionSets(businessId: string) {
    return this.prisma.modifierOptionSet.findMany({
      where: { businessId },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async listVariantOptions(businessId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId }, select: { id: true } });
    if (!product) throw new NotFoundException('Product not found.');
    return this.prisma.productVariantOption.findMany({
      where: { productId },
      include: { values: { include: { images: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } } },
      orderBy: { position: 'asc' },
    });
  }

  async listVariants(businessId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId }, select: { id: true } });
    if (!product) throw new NotFoundException('Product not found.');
    return this.prisma.productVariant.findMany({
      where: { productId },
      select: { id: true, name: true, sku: true, barcode: true, regularPrice: true, price: true, cost: true, isActive: true, inventory: { select: { quantity: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async listSupplierCatalog(businessId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId }, select: { id: true } });
    if (!product) throw new NotFoundException('Product not found.');
    return this.prisma.supplierCatalogItem.findMany({ where: { businessId, productId }, include: { supplier: { select: { id: true, name: true } }, variant: { select: { id: true, name: true, sku: true } } }, orderBy: [{ isPreferred: 'desc' }, { supplier: { name: 'asc' } }] });
  }

  async listSupplierPriceHistory(businessId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId }, select: { id: true } });
    if (!product) throw new NotFoundException('Product not found.');
    return this.prisma.stockReceipt.findMany({
      where: { businessId, productId, supplierId: { not: null }, unitCost: { not: null } },
      select: { id: true, createdAt: true, quantity: true, unitCost: true, reference: true, supplier: { select: { id: true, name: true } }, variant: { select: { id: true, name: true, sku: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async saveSupplierCatalogItem(businessId: string, productId: string, input: { supplierId: string; variantId?: string; supplierSku?: string; lastCost?: number | null; isPreferred?: boolean }) {
    const [product, supplier] = await Promise.all([this.prisma.product.findFirst({ where: { id: productId, businessId } }), this.prisma.supplier.findFirst({ where: { id: input.supplierId, businessId, isActive: true } })]);
    if (!product || !supplier) throw new NotFoundException('Product or supplier not found.');
    if (input.variantId) { const variant = await this.prisma.productVariant.findFirst({ where: { id: input.variantId, productId } }); if (!variant) throw new NotFoundException('Variant not found for this product.'); }
    return this.prisma.$transaction(async (tx) => { if (input.isPreferred) await tx.supplierCatalogItem.updateMany({ where: { businessId, productId, variantId: input.variantId ?? null }, data: { isPreferred: false } }); const existing = await tx.supplierCatalogItem.findFirst({ where: { supplierId: input.supplierId, productId, variantId: input.variantId ?? null } }); const data = { supplierSku: input.supplierSku?.trim() || null, lastCost: input.lastCost ?? null, ...(input.isPreferred !== undefined ? { isPreferred: input.isPreferred } : {}) }; return existing ? tx.supplierCatalogItem.update({ where: { id: existing.id }, data }) : tx.supplierCatalogItem.create({ data: { businessId, supplierId: input.supplierId, productId, variantId: input.variantId ?? null, ...data } }); });
  }

  async updateVariantOptionValue(businessId: string, productId: string, valueId: string, name: string) {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName) throw new BadRequestException('Variant value name is required.');
    const value = await this.prisma.productVariantOptionValue.findFirst({
      where: { id: valueId, option: { productId, product: { businessId } } },
      include: { option: true },
    });
    if (!value) throw new NotFoundException('Variant option value not found.');
    const duplicate = await this.prisma.productVariantOptionValue.findFirst({
      where: { optionId: value.optionId, name: { equals: cleanName, mode: 'insensitive' }, NOT: { id: value.id } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException(`“${cleanName}” already exists for ${value.option.name}.`);

    return this.prisma.$transaction(async (tx) => {
      await tx.productVariantOptionValue.update({ where: { id: value.id }, data: { name: cleanName } });
      const variants = await tx.productVariant.findMany({
        where: { productId, selections: { some: { optionValueId: value.id } } },
        include: { selections: { include: { optionValue: { include: { option: true } } } } },
      });
      await Promise.all(variants.map((variant) => {
        const variantName = variant.selections
          .sort((a, b) => a.optionValue.option.position - b.optionValue.option.position)
          .map((selection) => selection.optionValue.name)
          .join(' / ');
        return tx.productVariant.update({ where: { id: variant.id }, data: { name: variantName } });
      }));
      return { id: value.id, name: cleanName };
    });
  }

  async deleteVariantOptionValue(businessId: string, productId: string, valueId: string) {
    const value = await this.prisma.productVariantOptionValue.findFirst({
      where: { id: valueId, option: { productId, product: { businessId } } },
      include: {
        option: { include: { values: { select: { id: true } } } },
        selections: {
          select: {
            variantId: true,
            variant: {
              select: {
                _count: { select: { saleItems: true, stockTransfers: true, stockReceipts: true, purchaseOrderItems: true } },
              },
            },
          },
        },
      },
    });
    if (!value) throw new NotFoundException('Variant option value not found.');
    const blocked = value.selections.some(({ variant }) => (
      variant._count.saleItems || variant._count.stockTransfers || variant._count.stockReceipts || variant._count.purchaseOrderItems
    ));
    if (blocked)
      throw new ConflictException(`Cannot delete “${value.name}” because one or more of its variants have sales or stock history. Deactivate those variants instead.`);

    const variantIds = value.selections.map((selection) => selection.variantId);
    await this.prisma.$transaction(async (tx) => {
      if (variantIds.length) {
        await tx.productVariantInventory.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.productVariant.deleteMany({ where: { id: { in: variantIds } } });
      }
      await tx.productVariantOptionValue.delete({ where: { id: value.id } });
      if (value.option.values.length === 1)
        await tx.productVariantOption.delete({ where: { id: value.optionId } });
    });
    return { deleted: true, deletedVariants: variantIds.length };
  }

  async addVariantValueImage(businessId: string, productId: string, optionValueId: string, imageUrl: string) {
    const value = await this.prisma.productVariantOptionValue.findFirst({
      where: { id: optionValueId, option: { productId, product: { businessId } } },
      include: { images: true },
    });
    if (!value) throw new NotFoundException('Variant option value not found.');
    const cleanUrl = imageUrl.trim();
    if (!cleanUrl) throw new BadRequestException('Image URL is required.');
    return this.prisma.productVariantOptionValueImage.create({
      data: { optionValueId: value.id, imageUrl: cleanUrl, position: value.images.length },
    });
  }

  async removeVariantValueImage(businessId: string, productId: string, imageId: string) {
    const deleted = await this.prisma.productVariantOptionValueImage.deleteMany({
      where: { id: imageId, optionValue: { option: { productId, product: { businessId } } } },
    });
    if (!deleted.count) throw new NotFoundException('Variant image not found.');
    return { deleted: true };
  }

  async createOptionSet(
    businessId: string,
    input: {
      preset?: string;
      name?: string;
      optionNames?: string[];
      minSelections?: number;
      maxSelections?: number;
    },
  ) {
    const preset = this.optionSetPreset(input.preset ?? 'CUSTOM');
    const name = (input.name?.trim() || preset.name).replace(/\s+/g, ' ');
    const optionNames =
      input.optionNames?.map((value) => value.trim()).filter(Boolean) ??
      preset.options;
    const minSelections = input.minSelections ?? 0;
    const maxSelections = input.maxSelections ?? 1;
    if (!name) throw new BadRequestException('Option set name is required.');
    if (!optionNames.length)
      throw new BadRequestException('Add at least one option to the set.');
    if (minSelections < 0 || maxSelections < 1 || minSelections > maxSelections)
      throw new BadRequestException('Option selection limits are invalid.');
    const uniqueOptions = Array.from(
      new Map(
        optionNames.map((value) => [value.toLowerCase(), value]),
      ).values(),
    );
    if (uniqueOptions.length !== optionNames.length)
      throw new ConflictException(
        'An option set cannot contain duplicate option names.',
      );
    const existing = await this.prisma.modifierOptionSet.findFirst({
      where: { businessId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing)
      throw new ConflictException(
        `An option set named “${existing.name}” already exists.`,
      );
    try {
      return await this.prisma.modifierOptionSet.create({
        data: {
          businessId,
          name,
          minSelections,
          maxSelections,
          options: {
            create: uniqueOptions.map((optionName, sortOrder) => ({
              name: optionName,
              sortOrder,
            })),
          },
        },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'An option set with this name already exists.',
        );
      throw error;
    }
  }

  async applyOptionSet(
    businessId: string,
    productId: string,
    optionSetId: string,
  ) {
    const [product, optionSet] = await Promise.all([
      this.prisma.product.findFirst({ where: { id: productId, businessId } }),
      this.prisma.modifierOptionSet.findFirst({
        where: { id: optionSetId, businessId },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      }),
    ]);
    if (!product) throw new NotFoundException('Product not found.');
    if (!optionSet) throw new NotFoundException('Option set not found.');
    return this.prisma.$transaction(async (tx) => {
      let group = await tx.productModifierGroup.findFirst({
        where: {
          productId,
          name: { equals: optionSet.name, mode: 'insensitive' },
        },
      });
      if (!group)
        group = await tx.productModifierGroup.create({
          data: {
            productId,
            name: optionSet.name,
            minSelections: optionSet.minSelections,
            maxSelections: optionSet.maxSelections,
          },
        });
      else if (
        group.name !== optionSet.name ||
        group.minSelections !== optionSet.minSelections ||
        group.maxSelections !== optionSet.maxSelections
      )
        group = await tx.productModifierGroup.update({
          where: { id: group.id },
          data: {
            name: optionSet.name,
            minSelections: optionSet.minSelections,
            maxSelections: optionSet.maxSelections,
          },
        });
      for (const option of optionSet.options) {
        const exists = await tx.productModifierOption.findFirst({
          where: {
            groupId: group.id,
            name: { equals: option.name, mode: 'insensitive' },
          },
        });
        if (!exists)
          await tx.productModifierOption.create({
            data: { groupId: group.id, name: option.name },
          });
      }
      return tx.productModifierGroup.findUnique({
        where: { id: group.id },
        include: { options: true },
      });
    });
  }

  async updateModifierPrices(
    businessId: string,
    productId: string,
    items: { optionId: string; priceAdjustment: number }[],
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, businessId },
    });
    if (!product) throw new NotFoundException('Product not found.');
    if (!items.length)
      throw new BadRequestException('No option prices were provided.');
    const optionIds = items.map((item) => item.optionId);
    if (new Set(optionIds).size !== optionIds.length)
      throw new BadRequestException('Each option can only be priced once.');
    const options = await this.prisma.productModifierOption.findMany({
      where: { id: { in: optionIds }, group: { productId } },
    });
    if (options.length !== items.length)
      throw new BadRequestException(
        'One or more options do not belong to this product.',
      );
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.productModifierOption.update({
          where: { id: item.optionId },
          data: { priceAdjustment: item.priceAdjustment },
        }),
      ),
    );
    return this.list(businessId);
  }

  async removeModifierGroup(
    businessId: string,
    productId: string,
    groupId: string,
  ) {
    const deleted = await this.prisma.productModifierGroup.deleteMany({
      where: { id: groupId, productId, product: { businessId } },
    });
    if (!deleted.count)
      throw new NotFoundException('Modifier group not found.');
    return { deleted: true };
  }

  async removeModifierOption(
    businessId: string,
    productId: string,
    optionId: string,
  ) {
    const deleted = await this.prisma.productModifierOption.deleteMany({
      where: { id: optionId, group: { productId, product: { businessId } } },
    });
    if (!deleted.count)
      throw new NotFoundException('Modifier option not found.');
    return { deleted: true };
  }
  async create(
    businessId: string,
    input: {
      name: string;
      sku: string;
      barcode?: string;
      imageUrl?: string;
      regularPrice: number;
      price?: number | null;
      cost?: number;
      reorderLevel?: number;
      categoryId?: string;
    },
  ) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { defaultInventoryAlertLevel: true },
    });
    if (!business) throw new NotFoundException('Business not found.');
    if (
      input.categoryId &&
      !(await this.prisma.category.findFirst({
        where: { id: input.categoryId, businessId },
      }))
    )
      throw new NotFoundException('Category not found.');
    try {
      return await this.prisma.product.create({
        data: {
          ...input,
          businessId,
          sku: input.sku.toUpperCase(),
          reorderLevel: input.reorderLevel ?? business.defaultInventoryAlertLevel,
          barcode: input.barcode || null,
          imageUrl: input.imageUrl?.trim() || null,
        },
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException('SKU or barcode already exists.');
      throw error;
    }
  }

  async createVariant(
    businessId: string,
    branchId: string,
    productId: string,
    input: {
      name: string;
      sku: string;
      barcode?: string;
      price?: number;
      openingStock?: number;
    },
  ) {
    const name = input.name.trim().replace(/\s+/g, ' ');
    const sku = input.sku.trim().toUpperCase();
    const barcode = input.barcode?.trim() || null;
    if (!name || !sku)
      throw new BadRequestException('Variant name and SKU are required.');
    const openingStock = input.openingStock ?? 0;
    if (!Number.isInteger(openingStock) || openingStock < 0)
      throw new BadRequestException('Opening stock must be a whole number of zero or more.');
    const product = await this.prisma.product.findFirst({
      where: { id: productId, businessId },
    });
    if (!product) throw new NotFoundException('Product not found.');
    const [sameSku, sameBarcode, productBarcode] = await Promise.all([
      this.prisma.productVariant.findFirst({
        where: { businessId, sku: { equals: sku, mode: 'insensitive' } },
      }),
      barcode
        ? this.prisma.productVariant.findFirst({
            where: { barcode, product: { businessId } },
          })
        : Promise.resolve(null),
      barcode
        ? this.prisma.product.findFirst({ where: { businessId, barcode } })
        : Promise.resolve(null),
    ]);
    if (sameSku) throw new ConflictException('This business already has a variant with that SKU.');
    if (sameBarcode || productBarcode)
      throw new ConflictException('This barcode is already in use.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const variant = await tx.productVariant.create({
          data: {
            businessId,
            productId,
            name,
            sku,
            barcode,
            price: input.price,
          },
        });
        if (openingStock > 0) {
          await tx.productVariantInventory.create({
            data: { branchId, variantId: variant.id, quantity: openingStock },
          });
        }
        return variant;
      });
    } catch (error) {
      if (
        typeof error === 'object' && error !== null && 'code' in error &&
        error.code === 'P2002'
      ) throw new ConflictException('A variant with this name or SKU already exists.');
      throw error;
    }
  }

  async createVariantCombinations(
    businessId: string,
    branchId: string,
    productId: string,
    input: {
      options: { name: string; values: string[] }[];
      variants: { name: string; sku: string; barcode?: string; price?: number; openingStock?: number; values: string[] }[];
    },
  ) {
    if (!input.options.length || input.options.length > 3)
      throw new BadRequestException('Add between one and three variant options.');
    if (!input.variants.length || input.variants.length > 100)
      throw new BadRequestException('Create between one and 100 variants at a time.');
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!product) throw new NotFoundException('Product not found.');
    const options = input.options.map((option) => ({
      name: option.name.trim().replace(/\s+/g, ' '),
      values: Array.from(new Set(option.values.map((value) => value.trim()).filter(Boolean))),
    }));
    if (options.some((option) => !option.name || !option.values.length))
      throw new BadRequestException('Each variant option needs a name and at least one value.');
    if (new Set(options.map((option) => option.name.toLowerCase())).size !== options.length)
      throw new BadRequestException('Variant option names must be unique.');
    const normalizedVariants = input.variants.map((variant) => ({
      ...variant,
      name: variant.name.trim().replace(/\s+/g, ' '),
      sku: variant.sku.trim().toUpperCase(),
      barcode: variant.barcode?.trim() || null,
      openingStock: variant.openingStock ?? 0,
    }));
    if (normalizedVariants.some((variant) => !variant.name || !variant.sku || variant.values.length !== options.length || !Number.isInteger(variant.openingStock) || variant.openingStock < 0))
      throw new BadRequestException('Each variant needs a name, SKU, matching option values, and valid opening stock.');
    if (new Set(normalizedVariants.map((variant) => variant.name.toLowerCase())).size !== normalizedVariants.length || new Set(normalizedVariants.map((variant) => variant.sku)).size !== normalizedVariants.length)
      throw new ConflictException('Variant names and SKUs must be unique.');
    const existing = await this.prisma.productVariant.findMany({
      where: {
        OR: [
          { productId, name: { in: normalizedVariants.map((variant) => variant.name) } },
          { businessId, sku: { in: normalizedVariants.map((variant) => variant.sku) } },
        ],
      },
      select: { name: true, sku: true },
    });
    if (existing.length) throw new ConflictException('One or more variants already exist.');

    return this.prisma.$transaction(async (tx) => {
      const optionValues = await Promise.all(options.map(async (option, position) => {
        const record = await tx.productVariantOption.upsert({
          where: { productId_name: { productId, name: option.name } },
          update: { position },
          create: { productId, name: option.name, position },
        });
        const values = await Promise.all(option.values.map((name, valuePosition) =>
          tx.productVariantOptionValue.upsert({
            where: { optionId_name: { optionId: record.id, name } },
            update: { position: valuePosition },
            create: { optionId: record.id, name, position: valuePosition },
          }),
        ));
        return { option, values };
      }));
      const created = [];
      for (const variant of normalizedVariants) {
        const selectionIds = variant.values.map((value, index) => {
          const found = optionValues[index].values.find((candidate) => candidate.name === value);
          if (!found) throw new BadRequestException(`“${value}” is not a valid ${options[index].name} value.`);
          return found.id;
        });
        const createdVariant = await tx.productVariant.create({
          data: {
            businessId,
            productId,
            name: variant.name,
            sku: variant.sku,
            barcode: variant.barcode,
            regularPrice: variant.price,
            price: null,
            selections: { create: selectionIds.map((optionValueId) => ({ optionValueId })) },
          },
        });
        if (variant.openingStock > 0)
          await tx.productVariantInventory.create({ data: { branchId, variantId: createdVariant.id, quantity: variant.openingStock } });
        created.push(createdVariant);
      }
      return created;
    });
  }

  async updateVariant(
    businessId: string,
    productId: string,
    variantId: string,
    input: { name?: string; sku?: string; barcode?: string; price?: number | null; regularPrice?: number; cost?: number | null; isActive?: boolean },
  ) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, product: { businessId } },
    });
    if (!variant) throw new NotFoundException('Variant not found.');
    const name = input.name === undefined ? undefined : input.name.trim().replace(/\s+/g, ' ');
    const sku = input.sku === undefined ? undefined : input.sku.trim().toUpperCase();
    const barcode = input.barcode === undefined ? undefined : input.barcode.trim() || null;
    if (name !== undefined && !name) throw new BadRequestException('Variant name is required.');
    if (sku !== undefined && !sku) throw new BadRequestException('Variant SKU is required.');
    if (sku) {
      const duplicate = await this.prisma.productVariant.findFirst({
        where: { businessId, sku: { equals: sku, mode: 'insensitive' }, NOT: { id: variantId } },
      });
      if (duplicate) throw new ConflictException('This business already has a variant with that SKU.');
    }
    if (barcode) {
      const [variantBarcode, productBarcode] = await Promise.all([
        this.prisma.productVariant.findFirst({ where: { barcode, product: { businessId }, NOT: { id: variantId } } }),
        this.prisma.product.findFirst({ where: { businessId, barcode } }),
      ]);
      if (variantBarcode || productBarcode) throw new ConflictException('This barcode is already in use.');
    }
    try {
      return await this.prisma.productVariant.update({
        where: { id: variantId },
        data: { ...(name !== undefined ? { name } : {}), ...(sku !== undefined ? { sku } : {}), ...(barcode !== undefined ? { barcode } : {}), ...(input.price !== undefined ? { price: input.price } : {}), ...(input.regularPrice !== undefined ? { regularPrice: input.regularPrice } : {}), ...(input.cost !== undefined ? { cost: input.cost } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002')
        throw new ConflictException('Variant name, SKU, or barcode is already in use.');
      throw error;
    }
  }

  async deleteVariant(businessId: string, productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, product: { businessId } },
      select: { id: true, name: true, _count: { select: { saleItems: true, stockTransfers: true, stockReceipts: true, purchaseOrderItems: true } } },
    });
    if (!variant) throw new NotFoundException('Variant not found.');
    if (variant._count.saleItems || variant._count.stockTransfers || variant._count.stockReceipts || variant._count.purchaseOrderItems)
      throw new ConflictException(`Cannot delete “${variant.name}” because it has sales or stock history. Deactivate it instead.`);
    await this.prisma.$transaction(async (tx) => {
      await tx.productVariantInventory.deleteMany({ where: { variantId } });
      await tx.productVariant.delete({ where: { id: variantId } });
    });
    return { deleted: true };
  }

  async previewImport(businessId: string, csv: string) {
    const rows = this.parseImportCsv(csv);
    if (!rows.length) throw new BadRequestException('The CSV file has no product rows.');
    if (rows.length > 500) throw new BadRequestException('Import up to 500 products at one time.');
    const errors: { row: number; message: string }[] = [];
    const seenSkus = new Set<string>();
    const seenBarcodes = new Set<string>();
    for (const row of rows) {
      if (!row.name) errors.push({ row: row.row, message: 'Product name is required.' });
      if (!row.sku) errors.push({ row: row.row, message: 'SKU is required.' });
      if (row.price === null || row.price < 0) errors.push({ row: row.row, message: 'Price must be a valid number of zero or more.' });
      if (row.openingStock === null || row.openingStock < 0) errors.push({ row: row.row, message: 'Opening stock must be a whole number of zero or more.' });
      if (row.reorderLevel === null || row.reorderLevel < 0) errors.push({ row: row.row, message: 'Reorder level must be a whole number of zero or more.' });
      if (row.sku && seenSkus.has(row.sku)) errors.push({ row: row.row, message: `Duplicate SKU “${row.sku}” in this file.` });
      seenSkus.add(row.sku);
      if (row.barcode && seenBarcodes.has(row.barcode)) errors.push({ row: row.row, message: `Duplicate barcode “${row.barcode}” in this file.` });
      if (row.barcode) seenBarcodes.add(row.barcode);
    }
    const existing = await this.prisma.product.findMany({
      where: { businessId, OR: [{ sku: { in: rows.map((row) => row.sku).filter(Boolean) } }, { barcode: { in: rows.map((row) => row.barcode).filter(Boolean) } }] },
      select: { sku: true, barcode: true },
    });
    const existingSkus = new Set(existing.map((product) => product.sku));
    const existingBarcodes = new Set(existing.flatMap((product) => product.barcode ? [product.barcode] : []));
    for (const row of rows) {
      if (row.sku && existingSkus.has(row.sku)) errors.push({ row: row.row, message: `SKU “${row.sku}” already exists.` });
      if (row.barcode && existingBarcodes.has(row.barcode)) errors.push({ row: row.row, message: `Barcode “${row.barcode}” already exists.` });
    }
    return { valid: errors.length === 0, totalRows: rows.length, errors: errors.slice(0, 50), preview: rows.slice(0, 10).map(({ row, ...product }) => product) };
  }

  async importCsv(businessId: string, branchId: string, actorId: string, csv: string) {
    const preview = await this.previewImport(businessId, csv);
    if (!preview.valid)
      throw new BadRequestException({ message: 'Fix CSV errors before importing.', errors: preview.errors });
    const rows = this.parseImportCsv(csv);
    return this.prisma.$transaction(async (tx) => {
      const existingCategories = await tx.category.findMany({ where: { businessId } });
      const categories = new Map(existingCategories.map((category) => [category.name.toLowerCase(), category]));
      let created = 0;
      let openingStockProducts = 0;
      for (const row of rows) {
        let categoryId: string | undefined;
        if (row.category) {
          const key = row.category.toLowerCase();
          let category = categories.get(key);
          if (!category) {
            category = await tx.category.create({ data: { businessId, name: row.category } });
            categories.set(key, category);
          }
          categoryId = category.id;
        }
        const product = await tx.product.create({
          data: { businessId, name: row.name, sku: row.sku, barcode: row.barcode || null, regularPrice: row.price!, price: null, reorderLevel: row.reorderLevel!, categoryId },
        });
        created += 1;
        if (row.openingStock! > 0) {
          const item = await tx.inventoryItem.create({ data: { branchId, productId: product.id, quantity: row.openingStock! } });
          await tx.stockMovement.create({ data: { inventoryItemId: item.id, quantityChange: row.openingStock!, reason: 'CSV_IMPORT_OPENING_STOCK', actorId } });
          openingStockProducts += 1;
        }
      }
      await tx.auditLog.create({
        data: { businessId, actorId, action: 'PRODUCTS_IMPORTED_FROM_CSV', entityType: 'Product', entityId: 'bulk-import', metadata: { created, openingStockProducts, branchId } },
      });
      return { created, openingStockProducts };
    });
  }

  private parseImportCsv(csv: string) {
    const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];
    const parseLine = (line: string) => {
      const values: string[] = []; let current = ''; let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') { if (quoted && line[index + 1] === '"') { current += '"'; index += 1; } else quoted = !quoted; }
        else if (char === ',' && !quoted) { values.push(current.trim()); current = ''; }
        else current += char;
      }
      values.push(current.trim()); return values;
    };
    const headers = parseLine(lines[0]).map((header) => header.toLowerCase().replaceAll(' ', '_'));
    const required = ['name', 'sku', 'price'];
    if (required.some((header) => !headers.includes(header)))
      throw new BadRequestException('CSV headers must include: name, sku, price.');
    const integer = (value: string) => value === '' ? 0 : (/^\d+$/.test(value) ? Number(value) : null);
    const price = (value: string) => value === '' ? null : (/^\d+(\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : null);
    return lines.slice(1).map((line, index) => {
      const values = parseLine(line); const value = (header: string) => values[headers.indexOf(header)]?.trim() ?? '';
      return { row: index + 2, name: value('name'), sku: value('sku').toUpperCase(), barcode: value('barcode'), price: price(value('price')), openingStock: integer(value('opening_stock')), reorderLevel: integer(value('reorder_level')), category: value('category') };
    });
  }
  async update(
    businessId: string,
    id: string,
    input: {
      name?: string;
      sku?: string;
      barcode?: string;
      imageUrl?: string;
      regularPrice?: number;
      price?: number | null;
      cost?: number | null;
      reorderLevel?: number;
      categoryId?: string;
      isActive?: boolean;
    },
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
    });
    if (!product) throw new NotFoundException('Product not found.');
    if (
      input.categoryId &&
      !(await this.prisma.category.findFirst({
        where: { id: input.categoryId, businessId },
      }))
    )
      throw new NotFoundException('Category not found.');
    try {
      const updated = await this.prisma.product.update({
        where: { id },
        data: {
          ...input,
          ...(input.sku ? { sku: input.sku.toUpperCase() } : {}),
          ...(input.barcode !== undefined
            ? { barcode: input.barcode || null }
            : {}),
          ...(input.imageUrl !== undefined
            ? { imageUrl: input.imageUrl?.trim() || null }
            : {}),
          ...(input.categoryId !== undefined
            ? { categoryId: input.categoryId || null }
            : {}),
        },
      });
      if (input.imageUrl !== undefined && product.imageUrl !== updated.imageUrl)
        await this.removeR2Image(product.imageUrl);
      return updated;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException('SKU or barcode already exists.');
      throw error;
    }
  }

  async remove(businessId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
      select: {
        id: true,
        imageUrl: true,
        _count: {
          select: {
            inventory: true,
            saleItems: true,
            stockTransfers: true,
            stockReceipts: true,
            purchaseOrderItems: true,
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found.');
    const hasHistory =
      product._count.inventory > 0 ||
      product._count.saleItems > 0 ||
      product._count.stockTransfers > 0 ||
      product._count.stockReceipts > 0 ||
      product._count.purchaseOrderItems > 0;
    if (hasHistory)
      throw new ConflictException(
        'This product is used in sales or stock records. Deactivate it instead so your history stays safe.',
      );
    try {
      await this.prisma.product.delete({ where: { id: product.id } });
    } catch (error) {
      // PostgreSQL reports restricted foreign keys as P2003. Prisma can instead
      // report P2014 when it detects the required relation before issuing the
      // database delete, so both cases need the same safe, actionable response.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error.code === 'P2003' || error.code === 'P2014')
      ) {
        throw new ConflictException(
          'This product is used in sales or stock records. Deactivate it instead so your history stays safe.',
        );
      }
      throw error;
    }
    await this.removeR2Image(product.imageUrl);
    return { deleted: true };
  }
  async addModifierOption(
    businessId: string,
    productId: string,
    input: {
      groupName: string;
      optionName: string;
      priceAdjustment?: number;
      minSelections?: number;
      maxSelections?: number;
    },
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, businessId },
    });
    if (!product) throw new NotFoundException('Product not found.');
    const maxSelections = input.maxSelections ?? 1;
    const minSelections = input.minSelections ?? 0;
    if (minSelections < 0 || maxSelections < 1 || minSelections > maxSelections)
      throw new ConflictException('Modifier selection limits are invalid.');
    const groupName = this.normalizeModifierGroup(input.groupName);
    const optionName = input.optionName.trim();
    if (!optionName) throw new BadRequestException('Option name is required.');
    try {
      const group =
        (await this.prisma.productModifierGroup.findFirst({
          where: {
            productId,
            name: { equals: groupName, mode: 'insensitive' },
          },
        })) ??
        (await this.prisma.productModifierGroup.create({
          data: { productId, name: groupName, minSelections, maxSelections },
        }));
      if (
        group.minSelections !== minSelections ||
        group.maxSelections !== maxSelections ||
        group.name !== groupName
      )
        await this.prisma.productModifierGroup.update({
          where: { id: group.id },
          data: { name: groupName, minSelections, maxSelections },
        });
      const existingOption = await this.prisma.productModifierOption.findFirst({
        where: {
          groupId: group.id,
          name: { equals: optionName, mode: 'insensitive' },
        },
      });
      if (existingOption)
        throw new ConflictException(
          `“${optionName}” already exists in ${groupName}.`,
        );
      return await this.prisma.productModifierOption.create({
        data: {
          groupId: group.id,
          name: optionName,
          priceAdjustment: input.priceAdjustment ?? 0,
        },
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'This modifier option already exists in the group.',
        );
      throw error;
    }
  }

  private normalizeModifierGroup(name: string) {
    const raw = name.trim().replace(/\s+/g, ' ');
    const key = raw.toLowerCase();
    if (['size', 'sizes', 's', 'sixe'].includes(key)) return 'Size';
    if (['sugar', 'sugar level', 'sweetness'].includes(key))
      return 'Sugar level';
    if (['ice', 'temperature', 'hot or iced', 'hot/iced'].includes(key))
      return 'Temperature';
    if (
      ['extra', 'extras', 'add on', 'add-on', 'addons', 'add-ons'].includes(key)
    )
      return 'Add-ons';
    return raw;
  }

  private optionSetPreset(value: string) {
    const presets: Record<string, { name: string; options: string[] }> = {
      DRINK_SIZES: { name: 'Drink sizes', options: ['S', 'M', 'L'] },
      SHOE_SIZES: {
        name: 'Shoe sizes',
        options: [
          '34',
          '35',
          '36',
          '37',
          '38',
          '39',
          '40',
          '41',
          '42',
          '43',
          '44',
          '45',
        ],
      },
      CLOTHING_SIZES: {
        name: 'Clothing sizes',
        options: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
      },
      SUGAR_LEVEL: {
        name: 'Sugar level',
        options: ['0%', '25%', '50%', '75%', '100%'],
      },
      TEMPERATURE: { name: 'Temperature', options: ['Hot', 'Iced'] },
      ADD_ONS: { name: 'Add-ons', options: ['Extra shot', 'Whipped cream'] },
      CUSTOM: { name: '', options: [] },
    };
    return presets[value] ?? presets.CUSTOM;
  }
}
