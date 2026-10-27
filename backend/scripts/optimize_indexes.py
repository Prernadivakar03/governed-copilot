import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db import connect

ANALYTICS_INDEXES = [
    # Primary & Foreign Key Joins
    "CREATE INDEX IF NOT EXISTS ix_orders_id ON analytics.orders(order_id)",
    "CREATE INDEX IF NOT EXISTS ix_orders_cust ON analytics.orders(customer_id)",
    "CREATE INDEX IF NOT EXISTS ix_items_order ON analytics.order_items(order_id)",
    "CREATE INDEX IF NOT EXISTS ix_items_prod ON analytics.order_items(product_id)",
    "CREATE INDEX IF NOT EXISTS ix_items_seller ON analytics.order_items(seller_id)",
    "CREATE INDEX IF NOT EXISTS ix_pay_order ON analytics.order_payments(order_id)",
    "CREATE INDEX IF NOT EXISTS ix_rev_order ON analytics.order_reviews(order_id)",
    "CREATE INDEX IF NOT EXISTS ix_cust_id ON analytics.customers(customer_id)",
    
    # Critical Analytical Filters & Aggregations
    "CREATE INDEX IF NOT EXISTS ix_orders_status ON analytics.orders(order_status)",
    "CREATE INDEX IF NOT EXISTS ix_orders_purchase_timestamp ON analytics.orders(order_purchase_timestamp)",
    "CREATE INDEX IF NOT EXISTS ix_cust_unique_id ON analytics.customers(customer_unique_id)",
    "CREATE INDEX IF NOT EXISTS ix_cust_state ON analytics.customers(customer_state)",
    "CREATE INDEX IF NOT EXISTS ix_cust_city ON analytics.customers(customer_city)",
    "CREATE INDEX IF NOT EXISTS ix_prod_cat ON analytics.products(product_category_name)",
    "CREATE INDEX IF NOT EXISTS ix_trans_cat ON analytics.category_translation(product_category_name)",
    "CREATE INDEX IF NOT EXISTS ix_pay_type ON analytics.order_payments(payment_type)",
    "CREATE INDEX IF NOT EXISTS ix_rev_score ON analytics.order_reviews(review_score)",
    "CREATE INDEX IF NOT EXISTS ix_items_price ON analytics.order_items(price)",
]

TABLES_TO_ANALYZE = [
    "analytics.orders",
    "analytics.order_items",
    "analytics.order_payments",
    "analytics.order_reviews",
    "analytics.customers",
    "analytics.products",
    "analytics.sellers",
    "analytics.category_translation",
]


import psycopg


def optimize() -> None:
    with connect() as conn, conn.cursor() as cur:
        for idx_sql in ANALYTICS_INDEXES:
            try:
                cur.execute(idx_sql)
                print(f"Index applied: {idx_sql.split()[5]}")
            except psycopg.Error as e:
                print(f"Skipping index ({e})")
        for tbl in TABLES_TO_ANALYZE:
            try:
                cur.execute(f"ANALYZE {tbl}")
                print(f"Analyzed {tbl}")
            except psycopg.Error as e:
                print(f"Skipping analyze for {tbl} ({e})")
    print("Database performance optimization complete.")


if __name__ == "__main__":
    optimize()
