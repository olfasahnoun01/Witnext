
-- Server-side dashboard stats function to avoid transferring all product data
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'totalProducts', COALESCE((SELECT COUNT(*) FROM products), 0),
    'totalValue', COALESCE((SELECT SUM(price * quantity) FROM products), 0),
    'lowStockCount', COALESCE((SELECT COUNT(*) FROM products WHERE quantity > 0 AND quantity <= min_stock), 0),
    'outOfStockCount', COALESCE((SELECT COUNT(*) FROM products WHERE quantity = 0), 0),
    'categoryValues', COALESCE(
      (SELECT json_agg(row_to_json(t)) FROM (
        SELECT category, SUM(price * quantity) as value
        FROM products
        GROUP BY category
        ORDER BY SUM(price * quantity) DESC
      ) t),
      '[]'::json
    )
  );
$$;
