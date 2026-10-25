"""Load Olist CSVs into the `analytics` schema and add synthetic PII columns."""
import hashlib

import pandas as pd
from app.config import ROOT, settings
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

RAW = ROOT / "data" / "raw"

FILES = {
    "olist_customers_dataset.csv": "customers",
    "olist_orders_dataset.csv": "orders",
    "olist_order_items_dataset.csv": "order_items",
    "olist_order_payments_dataset.csv": "order_payments",
    "olist_order_reviews_dataset.csv": "order_reviews",
    "olist_products_dataset.csv": "products",
    "olist_sellers_dataset.csv": "sellers",
    "product_category_name_translation.csv": "category_translation",
}

ORDER_DATES = [
    "order_purchase_timestamp",
    "order_approved_at",
    "order_delivered_carrier_date",
    "order_delivered_customer_date",
    "order_estimated_delivery_date",
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_orders_id ON analytics.orders(order_id)",
    "CREATE INDEX IF NOT EXISTS ix_orders_cust ON analytics.orders(customer_id)",
    "CREATE INDEX IF NOT EXISTS ix_items_order ON analytics.order_items(order_id)",
    "CREATE INDEX IF NOT EXISTS ix_items_prod ON analytics.order_items(product_id)",
    "CREATE INDEX IF NOT EXISTS ix_pay_order ON analytics.order_payments(order_id)",
    "CREATE INDEX IF NOT EXISTS ix_rev_order ON analytics.order_reviews(order_id)",
    "CREATE INDEX IF NOT EXISTS ix_cust_id ON analytics.customers(customer_id)",
]


def synth_email(customer_id: str) -> str:
    h = hashlib.md5(customer_id.encode()).hexdigest()[:10]
    return f"user_{h}@example.com"


def synth_phone(customer_id: str) -> str:
    n = int(hashlib.md5(("p" + customer_id).encode()).hexdigest(), 16) % 10**8
    return f"+55-11-9{n:08d}"


def main() -> None:
    url = URL.create(
        "postgresql+psycopg",
        username=settings.postgres_user,
        password=settings.postgres_password,
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
    )
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS analytics"))

    for filename, table in FILES.items():
        path = RAW / filename
        if not path.exists():
            raise SystemExit(f"Missing file: {path}")
        df = pd.read_csv(path)

        if table == "orders":
            for c in ORDER_DATES:
                df[c] = pd.to_datetime(df[c])
        if table == "order_items":
            df["shipping_limit_date"] = pd.to_datetime(df["shipping_limit_date"])
        if table == "customers":
            df["customer_email"] = df["customer_id"].map(synth_email)
            df["customer_phone"] = df["customer_id"].map(synth_phone)
        if table == "order_reviews":
            # free-text comments can contain personal data, so drop them entirely
            df = df[["review_id", "order_id", "review_score", "review_creation_date"]]
            df["review_creation_date"] = pd.to_datetime(df["review_creation_date"])

        df.to_sql(table, engine, schema="analytics", if_exists="replace",
                  index=False, chunksize=10000)
        print(f"loaded analytics.{table}: {len(df):,} rows")

    with engine.begin() as conn:
        for stmt in INDEXES:
            conn.execute(text(stmt))
    print("done")


if __name__ == "__main__":
    main()