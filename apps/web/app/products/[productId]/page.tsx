import ProductsPage from '../page';

export default async function ProductEditorPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return <ProductsPage editorProductId={productId} />;
}
