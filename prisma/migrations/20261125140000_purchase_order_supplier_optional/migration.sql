-- Purchase orders no longer require a supplier. Finance records the real vendor on the expense.
ALTER TABLE "purchase_orders" ALTER COLUMN "supplier_id" DROP NOT NULL;
