# Data dictionary

Semantic layer version: 1. Source: `backend/app/semantic/semantic.yaml`.

Role sensitivities:
- **analyst:** public, internal
- **steward:** public, internal, pii

## Tables and columns

### `customers`

One row per customer record (a customer_id is issued per order).

| Column | Sensitivity | Description |
|---|---|---|
| `customer_id` | internal | Key used by orders |
| `customer_unique_id` | internal | Stable id of a real customer |
| `customer_zip_code_prefix` | internal | Zip code prefix |
| `customer_city` | public | City |
| `customer_state` | public | Brazilian state code, e.g. SP |
| `customer_email` | pii | Customer email (synthetic) |
| `customer_phone` | pii | Customer phone (synthetic) |

### `orders`

One row per order.

| Column | Sensitivity | Description |
|---|---|---|
| `order_id` | internal | Order key |
| `customer_id` | internal | Links to customers.customer_id |
| `order_status` | public | delivered, shipped, canceled, unavailable, invoiced, processing, created, approved |
| `order_purchase_timestamp` | public | When the order was placed |
| `order_approved_at` | public | Payment approval time |
| `order_delivered_carrier_date` | public | Handed to carrier |
| `order_delivered_customer_date` | public | Delivered to customer |
| `order_estimated_delivery_date` | public | Estimated delivery date |

### `order_items`

One row per item in an order.

| Column | Sensitivity | Description |
|---|---|---|
| `order_id` | internal | Links to orders.order_id |
| `order_item_id` | internal | Item sequence number within the order |
| `product_id` | internal | Links to products |
| `seller_id` | internal | Links to sellers |
| `shipping_limit_date` | public | Seller shipping deadline |
| `price` | public | Item price in BRL |
| `freight_value` | public | Shipping cost in BRL |

### `order_payments`

Payments for orders (an order can have several).

| Column | Sensitivity | Description |
|---|---|---|
| `order_id` | internal | Links to orders.order_id |
| `payment_sequential` | internal | Payment sequence number |
| `payment_type` | public | credit_card, boleto, voucher, debit_card |
| `payment_installments` | public | Number of installments |
| `payment_value` | public | Amount paid in BRL |

### `order_reviews`

Customer review scores for orders.

| Column | Sensitivity | Description |
|---|---|---|
| `review_id` | internal | Review key |
| `order_id` | internal | Links to orders.order_id |
| `review_score` | public | Score from 1 (worst) to 5 (best) |
| `review_creation_date` | public | Review creation date |

### `products`

Product catalogue.

| Column | Sensitivity | Description |
|---|---|---|
| `product_id` | internal | Product key |
| `product_category_name` | public | Category name in Portuguese |
| `product_name_lenght` | public | Characters in product name |
| `product_description_lenght` | public | Characters in description |
| `product_photos_qty` | public | Number of photos |
| `product_weight_g` | public | Weight in grams |
| `product_length_cm` | public | Length in cm |
| `product_height_cm` | public | Height in cm |
| `product_width_cm` | public | Width in cm |

### `sellers`

Marketplace sellers.

| Column | Sensitivity | Description |
|---|---|---|
| `seller_id` | internal | Seller key |
| `seller_zip_code_prefix` | internal | Zip code prefix |
| `seller_city` | public | Seller city |
| `seller_state` | public | Seller state code |

### `category_translation`

Maps Portuguese category names to English.

| Column | Sensitivity | Description |
|---|---|---|
| `product_category_name` | public | Portuguese category name |
| `product_category_name_english` | public | English category name |

## Metrics

| Metric | Expression | Tables | Description |
|---|---|---|---|
| `revenue` | `SUM(order_items.price)` | orders, order_items | Item revenue from delivered orders, excluding freight. |
| `gross_revenue_with_freight` | `SUM(order_items.price + order_items.freight_value)` | orders, order_items | Item price plus freight for delivered orders. |
| `order_count` | `COUNT(DISTINCT orders.order_id)` | orders | Number of distinct orders. |
| `unique_customers` | `COUNT(DISTINCT customers.customer_unique_id)` | customers | Number of distinct real customers. |
| `avg_review_score` | `AVG(order_reviews.review_score)` | order_reviews | Average review score (1-5). |
| `avg_order_value` | `SUM(order_items.price) / COUNT(DISTINCT order_items.order_id)` | order_items | Item revenue divided by number of orders with items. |

## Joins

| Left | Right | Cardinality |
|---|---|---|
| `orders.customer_id` | `customers.customer_id` | many-to-one |
| `order_items.order_id` | `orders.order_id` | many-to-one |
| `order_items.product_id` | `products.product_id` | many-to-one |
| `order_items.seller_id` | `sellers.seller_id` | many-to-one |
| `order_payments.order_id` | `orders.order_id` | many-to-one |
| `order_reviews.order_id` | `orders.order_id` | many-to-one |
| `products.product_category_name` | `category_translation.product_category_name` | many-to-one |
