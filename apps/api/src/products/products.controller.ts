import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { mkdirSync, writeFile } from 'node:fs';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProductsService } from './products.service';
class CreateProductDto {
  @IsString() name!: string;
  @IsString() sku!: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsInt() @Min(0) regularPrice!: number;
  @IsOptional() @IsInt() @Min(0) price?: number | null;
  @IsOptional() @IsInt() @Min(0) cost?: number;
  @IsOptional() @IsInt() @Min(0) reorderLevel?: number;
  @IsOptional() @IsString() categoryId?: string;
}
class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsInt() @Min(0) regularPrice?: number;
  @IsOptional() @IsInt() @Min(0) price?: number | null;
  @IsOptional() @IsInt() @Min(0) cost?: number | null;
  @IsOptional() @IsInt() @Min(0) reorderLevel?: number;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class AddModifierOptionDto {
  @IsString() groupName!: string;
  @IsString() optionName!: string;
  @IsOptional() @IsInt() priceAdjustment?: number;
  @IsOptional() @IsInt() @Min(0) minSelections?: number;
  @IsOptional() @IsInt() @Min(1) maxSelections?: number;
}
class CreateOptionSetDto {
  @IsOptional() @IsString() preset?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() optionNames?: string[];
  @IsOptional() @IsInt() @Min(0) minSelections?: number;
  @IsOptional() @IsInt() @Min(1) maxSelections?: number;
}
class ApplyOptionSetDto {
  @IsString() optionSetId!: string;
}
class CreateCategoryDto {
  @IsString() name!: string;
}
class UpdateCategoryDto {
  @IsString() name!: string;
}
class ModifierPriceDto {
  @IsString() optionId!: string;
  @IsInt() priceAdjustment!: number;
}
class UpdateModifierPricesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifierPriceDto)
  items!: ModifierPriceDto[];
}
class CsvImportDto { @IsString() csv!: string; }
class CreateVariantDto {
  @IsString() name!: string;
  @IsString() sku!: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsInt() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(0) openingStock?: number;
}
class UpdateVariantOptionValueDto {
  @IsString() name!: string;
}
class CreateVariantCombinationsDto {
  @IsArray() options!: { name: string; values: string[] }[];
  @IsArray() variants!: { name: string; sku: string; barcode?: string; price?: number; openingStock?: number; values: string[] }[];
}
class AddVariantValueImageDto { @IsString() imageUrl!: string; }
class UpdateVariantDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsInt() @Min(0) price?: number | null;
  @IsOptional() @IsInt() @Min(0) regularPrice?: number;
  @IsOptional() @IsInt() @Min(0) cost?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class SaveSupplierCatalogDto { @IsString() supplierId!: string; @IsOptional() @IsString() variantId?: string; @IsOptional() @IsString() supplierSku?: string; @IsOptional() @IsInt() @Min(0) lastCost?: number | null; @IsOptional() @IsBoolean() isPreferred?: boolean; }
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}
  @Get() list(@Req() req: { user: AuthUser }) {
    return this.products.list(req.user.businessId);
  }
  @Put('reorder') reorder(
    @Req() req: { user: AuthUser },
    @Body() input: { items: { id: string; sortOrder: number }[] },
  ) {
    return this.products.reorderProducts(req.user.businessId, input.items ?? []);
  }
  @Get('categories') categories(@Req() req: { user: AuthUser }) {
    return this.products.listCategories(req.user.businessId);
  }
  @Put('categories/reorder') reorderCategories(
    @Req() req: { user: AuthUser },
    @Body() input: { items: { id: string; sortOrder: number }[] },
  ) {
    return this.products.reorderCategories(req.user.businessId, input.items ?? []);
  }
  @Get(':productId/supplier-catalog') supplierCatalog(@Req() req: { user: AuthUser }, @Param('productId') productId: string) { return this.products.listSupplierCatalog(req.user.businessId, productId); }
  @Get(':productId/supplier-price-history') supplierPriceHistory(@Req() req: { user: AuthUser }, @Param('productId') productId: string) { return this.products.listSupplierPriceHistory(req.user.businessId, productId); }
  @Post(':productId/supplier-catalog') saveSupplierCatalog(@Req() req: { user: AuthUser }, @Param('productId') productId: string, @Body() input: SaveSupplierCatalogDto) { return this.products.saveSupplierCatalogItem(req.user.businessId, productId, input); }
  @Post('categories') createCategory(
    @Req() req: { user: AuthUser },
    @Body() input: CreateCategoryDto,
  ) {
    return this.products.createCategory(req.user.businessId, input.name);
  }
  @Patch('categories/:categoryId') updateCategory(
    @Req() req: { user: AuthUser },
    @Param('categoryId') categoryId: string,
    @Body() input: UpdateCategoryDto,
  ) {
    return this.products.updateCategory(req.user.businessId, categoryId, input.name);
  }
  @Delete('categories/:categoryId') deleteCategory(
    @Req() req: { user: AuthUser },
    @Param('categoryId') categoryId: string,
  ) {
    return this.products.deleteCategory(req.user.businessId, categoryId);
  }
  @Get('option-sets') optionSets(@Req() req: { user: AuthUser }) {
    return this.products.listOptionSets(req.user.businessId);
  }
  @Post('option-sets') createOptionSet(
    @Req() req: { user: AuthUser },
    @Body() input: CreateOptionSetDto,
  ) {
    return this.products.createOptionSet(req.user.businessId, input);
  }
  @Post() create(
    @Req() req: { user: AuthUser },
    @Body() input: CreateProductDto,
  ) {
    return this.products.create(req.user.businessId, input);
  }
  @Post('image-upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => callback(null, file.mimetype.startsWith('image/')),
  }))
  async uploadImage(@UploadedFile() file: { originalname: string; mimetype: string; buffer: Buffer } | undefined) {
    if (!file) throw new Error('Choose a valid image file (maximum 5 MB).');

    const safeName = file.originalname.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 60);
    const extension = extname(safeName).toLowerCase() || '.bin';
    const objectKey = `products/${randomUUID()}-${safeName.replace(/\.[^.]+$/, '')}${extension}`;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (
      publicUrl &&
      process.env.R2_ENDPOINT &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
    ) {
      const client = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      });
      await client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      return { imageUrl: `${publicUrl.replace(/\/$/, '')}/${objectKey}` };
    }

    // Local fallback when R2 is not configured.
    const directory = join(process.cwd(), 'uploads', 'products');
    mkdirSync(directory, { recursive: true });
    const localName = `${Date.now()}-${safeName}`;
    await new Promise<void>((resolve, reject) =>
      writeFile(join(directory, localName), file.buffer, (error) => error ? reject(error) : resolve()),
    );
    return { imageUrl: `/uploads/products/${localName}` };
  }
  @Post('import-preview') previewImport(
    @Req() req: { user: AuthUser },
    @Body() input: CsvImportDto,
  ) {
    return this.products.previewImport(req.user.businessId, input.csv);
  }
  @Post('import') importCsv(
    @Req() req: { user: AuthUser },
    @Body() input: CsvImportDto,
  ) {
    if (!req.user.branchId) throw new Error('No active branch.');
    return this.products.importCsv(req.user.businessId, req.user.branchId, req.user.sub, input.csv);
  }
  @Post(':id/variants') createVariant(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: CreateVariantDto,
  ) {
    if (!req.user.branchId) throw new Error('No active branch.');
    return this.products.createVariant(
      req.user.businessId,
      req.user.branchId,
      id,
      input,
    );
  }
  @Post(':id/variants/batch') createVariantCombinations(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: CreateVariantCombinationsDto,
  ) {
    if (!req.user.branchId) throw new Error('No active branch.');
    return this.products.createVariantCombinations(
      req.user.businessId,
      req.user.branchId,
      id,
      input,
    );
  }
  @Get(':id/variants') variants(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.products.listVariants(req.user.businessId, id);
  }
  @Get(':id/variant-options') variantOptions(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.products.listVariantOptions(req.user.businessId, id);
  }
  @Patch(':id/variant-option-values/:valueId') updateVariantOptionValue(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Param('valueId') valueId: string,
    @Body() input: UpdateVariantOptionValueDto,
  ) {
    return this.products.updateVariantOptionValue(req.user.businessId, id, valueId, input.name);
  }
  @Delete(':id/variant-option-values/:valueId') deleteVariantOptionValue(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Param('valueId') valueId: string,
  ) {
    return this.products.deleteVariantOptionValue(req.user.businessId, id, valueId);
  }
  @Post(':id/variant-option-values/:valueId/images') addVariantValueImage(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Param('valueId') valueId: string,
    @Body() input: AddVariantValueImageDto,
  ) {
    return this.products.addVariantValueImage(req.user.businessId, id, valueId, input.imageUrl);
  }
  @Delete(':id/variant-option-values/:valueId/images/:imageId') removeVariantValueImage(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.products.removeVariantValueImage(req.user.businessId, id, imageId);
  }
  @Patch(':id/variants/:variantId') updateVariant(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() input: UpdateVariantDto,
  ) {
    return this.products.updateVariant(req.user.businessId, id, variantId, input);
  }
  @Delete(':id/variants/:variantId') deleteVariant(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Param('variantId') variantId: string,
  ) {
    return this.products.deleteVariant(req.user.businessId, id, variantId);
  }
  @Post(':id/apply-option-set') applyOptionSet(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: ApplyOptionSetDto,
  ) {
    return this.products.applyOptionSet(
      req.user.businessId,
      id,
      input.optionSetId,
    );
  }
  @Patch(':id/modifier-option-prices') updateModifierPrices(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: UpdateModifierPricesDto,
  ) {
    return this.products.updateModifierPrices(
      req.user.businessId,
      id,
      input.items,
    );
  }
  @Post(':id/modifier-options') addModifierOption(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: AddModifierOptionDto,
  ) {
    return this.products.addModifierOption(req.user.businessId, id, input);
  }
  @Delete(':id/modifier-groups/:groupId') removeModifierGroup(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Param('groupId') groupId: string,
  ) {
    return this.products.removeModifierGroup(req.user.businessId, id, groupId);
  }
  @Delete(':id/modifier-options/:optionId') removeModifierOption(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Param('optionId') optionId: string,
  ) {
    return this.products.removeModifierOption(
      req.user.businessId,
      id,
      optionId,
    );
  }
  @Patch(':id') update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.products.update(req.user.businessId, id, input);
  }
  @Delete(':id')
  @Roles('OWNER')
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.products.remove(req.user.businessId, id);
  }
}
