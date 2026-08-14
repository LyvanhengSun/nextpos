import 'dotenv/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const prisma = new PrismaClient();
const apiOrigin = `http://localhost:${process.env.API_PORT ?? 4000}`;
const uploadsRoot = join(process.cwd(), 'uploads');
const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

function contentType(filePath: string) {
  const ext = extname(filePath).toLowerCase();
  return ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
}

async function main() {
  if (!publicUrl || !process.env.R2_ENDPOINT || !process.env.R2_BUCKET_NAME || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 environment variables are incomplete.');
  }
  const apply = process.argv.includes('--apply');
  const client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });
  const products = await prisma.product.findMany({ where: { imageUrl: { not: null } }, select: { id: true, name: true, imageUrl: true } });
  let migrated = 0;
  for (const product of products) {
    const imageUrl = product.imageUrl ?? '';
    if (!imageUrl.includes('/uploads/')) continue;
    const fileName = basename(new URL(imageUrl.startsWith('http') ? imageUrl : `${apiOrigin}${imageUrl}`).pathname);
    const filePath = join(uploadsRoot, 'products', fileName);
    if (!existsSync(filePath)) {
      console.log(`SKIP ${product.name}: local file not found (${fileName})`);
      continue;
    }
    const key = `products/migrated-${product.id}-${fileName}`;
    console.log(`${apply ? 'COPY' : 'WOULD COPY'} ${product.name}: ${fileName}`);
    if (apply) {
      await client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: readFileSync(filePath), ContentType: contentType(filePath), CacheControl: 'public, max-age=31536000, immutable' }));
      await prisma.product.update({ where: { id: product.id }, data: { imageUrl: `${publicUrl}/${key}` } });
    }
    migrated++;
  }
  console.log(`${apply ? 'Migrated' : 'Ready to migrate'} ${migrated} image(s).`);
  if (!apply && migrated > 0) console.log('Run again with --apply to copy files and update product URLs.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
