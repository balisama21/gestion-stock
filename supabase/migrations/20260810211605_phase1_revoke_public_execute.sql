REVOKE EXECUTE ON FUNCTION create_order_with_items(uuid, uuid, text, date, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_order_status(uuid, order_status) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION refund_order(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION refund_sale(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_sale(uuid, date, uuid, int, numeric, text, text, uuid, numeric, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION delete_sale(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION update_sale_quantity(uuid, int, numeric, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION add_purchase(uuid, date, uuid, text, text, text, numeric, int, int, numeric, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION delete_purchase(uuid) FROM PUBLIC;

-- Re-affirme l'accès pour les utilisateurs connectés uniquement
GRANT EXECUTE ON FUNCTION create_order_with_items(uuid, uuid, text, date, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION set_order_status(uuid, order_status) TO authenticated;
GRANT EXECUTE ON FUNCTION refund_order(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION refund_sale(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_sale(uuid, date, uuid, int, numeric, text, text, uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_sale(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_sale_quantity(uuid, int, numeric, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION add_purchase(uuid, date, uuid, text, text, text, numeric, int, int, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_purchase(uuid) TO authenticated;