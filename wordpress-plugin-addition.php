<?php
// Add this to your existing WordPress plugin file

// Register the sync-user-limits endpoint
add_action('rest_api_init', function() {
    register_rest_route('ttpaypal/v1', '/sync-user-limits', [
        'methods' => 'POST',
        'callback' => 'ttpaypal_rest_sync_user_limits',
        'permission_callback' => function() {
            return is_user_logged_in();
        }
    ]);
});

function ttpaypal_rest_sync_user_limits($request) {
    $params = $request->get_json_params();
    $user_id = get_current_user_id();
    
    // Extract limits from the request
    $user_roles = isset($params['user_roles']) ? $params['user_roles'] : [];
    $primary_role = isset($params['primary_role']) ? sanitize_text_field($params['primary_role']) : 'customer';
    $per_transaction_limit = isset($params['per_transaction_limit']) ? floatval($params['per_transaction_limit']) : 0;
    $max_wallet_balance = isset($params['max_wallet_balance']) ? floatval($params['max_wallet_balance']) : 0;
    $max_monthly_transactions = isset($params['max_monthly_transactions']) ? floatval($params['max_monthly_transactions']) : 0;
    
    // Validate the limits
    if ($per_transaction_limit < 0 || $max_wallet_balance < 0 || $max_monthly_transactions < 0) {
        return new WP_Error('invalid_limits', 'Limits cannot be negative', ['status' => 400]);
    }
    
    // Update user meta with the limits (these are used by your existing limit functions)
    update_user_meta($user_id, 'ttpaypal_user_role', $primary_role);
    update_user_meta($user_id, 'ttpaypal_per_transaction_limit', $per_transaction_limit);
    update_user_meta($user_id, 'ttpaypal_max_wallet_balance', $max_wallet_balance);
    update_user_meta($user_id, 'ttpaypal_max_monthly_transactions', $max_monthly_transactions);
    
    // Also store the complete limits data as JSON for easy retrieval
    $limits_data = [
        'user_roles' => $user_roles,
        'primary_role' => $primary_role,
        'per_transaction_limit' => $per_transaction_limit,
        'max_wallet_balance' => $max_wallet_balance,
        'max_monthly_transactions' => $max_monthly_transactions,
        'synced_at' => current_time('mysql')
    ];
    
    update_user_meta($user_id, 'ttpaypal_limits_data', $limits_data);
    
    return rest_ensure_response([
        'success' => true, 
        'limits' => $limits_data,
        'message' => 'User limits synced successfully to WordPress'
    ]);
}
?>