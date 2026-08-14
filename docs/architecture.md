# Architecture

The project is a modular monolith. It has one API and one database so that releases, debugging, backups, and data consistency stay manageable.

## Core domains

- Auth and users
- Businesses and branches
- Products
- Inventory
- POS sales and returns
- Payments
- Customers
- Reports
- Audit log

E-commerce is an optional module and must reuse the same product, customer, order, and inventory records.

## Non-negotiable business rules

1. Store money as integer minor units; do not use JavaScript floating-point values for totals.
2. Inventory changes only through inventory movements, never by directly overwriting a quantity.
3. Sales, refunds, price changes, and stock adjustments produce audit-log records.
4. POS operations are scoped to a business, branch, register, and authenticated user.
5. Database changes are introduced only through reviewed migrations.
