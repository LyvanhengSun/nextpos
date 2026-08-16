# Web translations

The web app uses one typed translation dictionary for English and Khmer.

## Editing text

Edit `dictionaries.ts` only. Add a key to `english`, then add the same key to
`khmer`. TypeScript checks that Khmer contains every English key, so missing
translations fail the production build.

Keep keys grouped by feature, for example:

```ts
'entity.product': 'Product',
'entity.product': 'ផលិតផល',
```

Use `entity.*` for reusable business nouns and `payment.*` for reusable payment
terms. A single-word label such as Product must always use
`t('entity.product')`; do not create `nav.product`, `form.product`, or another
duplicate key for the same meaning.

English is the source language. Do not create separate translation objects in
pages or use locale ternaries such as `locale === 'km' ? ... : ...`.

Use feature keys for complete phrases because Khmer grammar and word order may
require a translation written for that context. For example,
`products.empty: 'No products found'` should remain a complete translation
rather than being assembled from shared words.

## Using translated text

Client components use the shared hook:

```tsx
const { t } = useI18n();

return <h1>{t('products.title')}</h1>;
```

Values can be inserted with named parameters:

```tsx
t('pos.items', { count: cartItems.length });
```

## Locale behavior

- `I18nProvider` owns the active locale.
- `LanguageSwitcher` is the only shared language control.
- The locale is saved as `pos_locale` in local storage and a same-site cookie.
- The app waits for the saved locale before rendering, preventing an
  English-to-Khmer flash.
- Business data such as product, customer, branch, and promotion names is not
  translated automatically.
- Khmer uses Noto Sans Khmer for consistent readability.
