<?php
/**
 * TTPayPal REST API Integration
 * Complete fixed version with all endpoints and proper error handling
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Add CORS headers for development
add_action('rest_api_init', function () {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function ($value) {
        // In a production environment, you should restrict this to your app's domain
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Credentials: true');
        return $value;
    });
});

// Register all REST API routes
add_action('rest_api_init', function () {
    register_rest_route('ttpaypal/v1', '/link', [
        'methods' => 'POST',
        'callback' => 'ttpaypal_rest_link_wallet',
        'permission_callback' => 'is_user_logged_in',
    ]);
    
    register_rest_route('ttpaypal/v1', '/status', [
        'methods' => 'GET',
        'callback' => 'ttpaypal_rest_wallet_status',
        'permission_callback' => 'is_user_logged_in',
    ]);
    
    register_rest_route('ttpaypal/v1', '/user-limits', [
        'methods' => 'GET',
        'callback' => 'ttpaypal_rest_user_limits',
        'permission_callback' => 'is_user_logged_in',
    ]);
    
    register_rest_route('ttpaypal/v1', '/validate-passcode', [
        'methods' => 'POST',
        'callback' => 'ttpaypal_rest_validate_passcode',
        'permission_callback' => 'is_user_logged_in',
    ]);
    
    register_rest_route('ttpaypal/v1', '/balance', [
        'methods' => 'GET',
        'callback' => 'ttpaypal_rest_balance',
        'permission_callback' => 'is_user_logged_in',
    ]);
    
    register_rest_route('ttpaypal/v1', '/transactions', [
        'methods' => 'GET',
        'callback' => 'ttpaypal_rest_transactions',
        'permission_callback' => 'is_user_logged_in',
    ]);
    
    register_rest_route('ttpaypal/v1', '/transaction-stats', [
        'methods' => 'GET',
        'callback' => 'ttpaypal_rest_transaction_stats',
        'permission_callback' => 'is_user_logged_in',
    ]);
    
    register_rest_route('ttpaypal/v1', '/transaction/(?P<id>\d+)', [
        'methods' => 'GET',
        'callback' => 'ttpaypal_rest_get_transaction',
        'permission_callback' => 'is_user_logged_in',
    ]);
    
    register_rest_route('ttpaypal/v1', '/deposit', [
        'methods' => 'POST',
        'callback' => 'ttpaypal_rest_deposit',
        'permission_callback' => 'is_user_logged_in',
    ]);
    
    register_rest_route('ttpaypal/v1', '/withdraw', [
        'methods' => 'POST',
        'callback' => 'ttpaypal_rest_withdraw',
        'permission_callback' => 'is_user_logged_in',
    ]);
    
    register_rest_route('ttpaypal/v1', '/wallet-transfer', [
        'methods' => 'POST',
        'callback' => 'ttpaypal_rest_wallet_transfer',
        'permission_callback' => 'is_user_logged_in',
    ]);
    
    register_rest_route('ttpaypal/v1', '/unlink', [
        'methods' => 'POST',
        'callback' => 'ttpaypal_rest_unlink_wallet',
        'permission_callback' => 'is_user_logged_in',
    ]);
});

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

/**
 * Verify JWT token from Authorization header
 */
function ttpaypal_verify_token($request) {
    $auth_header = $request->get_header('Authorization');
    
    if (!$auth_header || !preg_match('/Bearer\s+(.*)$/i', $auth_header, $matches)) {
        return false;
    }
    
    $token = $matches[1];
    $secret_key = 'YOUR_SUPER_SECRET_KEY'; // Replace with your real secret key, store securely
    try {
        $decoded = JWT::decode($token, new Key($secret_key, 'HS256'));
        $user_id = $decoded->data->user_id ?? null;
        if (!$user_id) return false;
        wp_set_current_user($user_id);
        return true;
    } catch (Exception $e) {
        error_log('JWT validation failed: ' . $e->getMessage());
        return false;
    }
}

/**
 * Link TTPayPal wallet to user account
 */
function ttpaypal_rest_link_wallet($request) {
    $params = $request->get_json_params();
    $email = sanitize_email($params['email']);
    $password = sanitize_text_field($params['password']);
    $passcode = sanitize_text_field($params['passcode']);
    $user_id = get_current_user_id();

    // Call TTPayPal API to authenticate user and get user role
    $response = wp_remote_post('https://ttpaypal.com/wp-json/cac-plugin/v1/ttpaypal/ttpaypal.php', [
        'body' => [
            'action' => 'authenticate_user',
            'email' => $email,
            'password' => $password
        ],
        'timeout' => 30
    ]);
    
    if (is_wp_error($response)) {
        return new WP_Error('api_error', 'Failed to connect to TTPayPal system', ['status' => 500]);
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (!$data || !isset($data['success']) || !$data['success']) {
        return new WP_Error('invalid_credentials', 'Invalid email or password', ['status' => 401]);
    }

    // Store wallet information
    update_user_meta($user_id, 'ttpaypal_wallet_email', $email);
    update_user_meta($user_id, 'ttpaypal_wallet_passcode', $passcode);
    
    // Store user role and limits from TTPayPal
    if (isset($data['user_role'])) {
        update_user_meta($user_id, 'ttpaypal_user_role', $data['user_role']);
    }
    if (isset($data['per_transaction_limit'])) {
        update_user_meta($user_id, 'ttpaypal_per_transaction_limit', $data['per_transaction_limit']);
    }
    if (isset($data['max_wallet_balance'])) {
        update_user_meta($user_id, 'ttpaypal_max_wallet_balance', $data['max_wallet_balance']);
    }
    if (isset($data['max_monthly_transactions'])) {
        update_user_meta($user_id, 'ttpaypal_max_monthly_transactions', $data['max_monthly_transactions']);
    }

    return rest_ensure_response([
        'success' => true, 
        'message' => 'Wallet linked successfully',
        'data' => [
            'email' => $email,
            'user_role' => $data['user_role'] ?? 'customer',
            'per_transaction_limit' => $data['per_transaction_limit'] ?? 0,
            'max_wallet_balance' => $data['max_wallet_balance'] ?? 0,
            'max_monthly_transactions' => $data['max_monthly_transactions'] ?? 0
        ]
    ]);
}

/**
 * Get wallet status
 */
function ttpaypal_rest_wallet_status($request) {
    $user_id = get_current_user_id();
    $wallet = get_user_meta($user_id, 'ttpaypal_wallet_email', true);
    return rest_ensure_response(['linked' => !empty($wallet)]);
}

/**
 * Get user limits using the TTPayPal limits configuration
 */
function ttpaypal_rest_user_limits($request) {
    $user_id = get_current_user_id();
    
    // Get user's WordPress roles
    $user = get_userdata($user_id);
    $user_roles = $user ? (array) $user->roles : ['customer'];
    
    // Get limits based on user roles using your existing functions
    $per_transaction_limit = ttpaypal_get_user_per_transaction_limit($user_id);
    $max_wallet_balance = ttpaypal_get_user_wallet_max_limit($user_id);
    $max_monthly_transactions = ttpaypal_get_user_max_monthly_transactions($user_id);
    
    // Get the highest role (for display purposes)
    $primary_role = !empty($user_roles) ? $user_roles[0] : 'customer';
    
    return rest_ensure_response([
        'user_roles' => $user_roles,
        'primary_role' => $primary_role,
        'per_transaction_limit' => (float)$per_transaction_limit ?: 0,
        'max_wallet_balance' => (float)$max_wallet_balance ?: 0,
        'max_monthly_transactions' => (float)$max_monthly_transactions ?: 0
    ]);
}

/**
 * Validate passcode
 */
function ttpaypal_rest_validate_passcode($request) {
    $params = $request->get_json_params();
    $passcode = sanitize_text_field($params['passcode']);
    $_POST['passcode'] = $passcode;
    ob_start();
    ttpaypal_validate_passcode_upi_user_data();
    $output = ob_get_clean();
    $response = json_decode($output, true);
    if (isset($response['success']) && $response['success']) {
        return rest_ensure_response(['success' => true]);
    } else {
        return new WP_Error('invalid_passcode', 'Invalid passcode.', ['status' => 400]);
    }
}

/**
 * Get wallet balance
 */
function ttpaypal_rest_balance($request) {
    $user_id = get_current_user_id();
    $balance = function_exists('woo_wallet') ? woo_wallet()->wallet->get_wallet_balance($user_id) : 0;
    $trinicredit = floatval(get_user_meta($user_id, 'trinicredit_balance', true));
    
    // Get user's actual WordPress roles
    $user = get_userdata($user_id);
    $user_roles = $user ? (array) $user->roles : ['customer'];
    $primary_role = !empty($user_roles) ? $user_roles[0] : 'customer';
    
    // Get limits based on user roles
    $per_transaction_limit = ttpaypal_get_user_per_transaction_limit($user_id);
    $max_wallet_balance = ttpaypal_get_user_wallet_max_limit($user_id);
    $max_monthly_transactions = ttpaypal_get_user_max_monthly_transactions($user_id);
    
    return rest_ensure_response([
        'balance' => $balance,
        'trinicredit' => $trinicredit,
        'currency' => 'TT$',
        'user_roles' => $user_roles,
        'primary_role' => $primary_role,
        'per_transaction_limit' => (float)$per_transaction_limit ?: 0,
        'max_wallet_balance' => (float)$max_wallet_balance ?: 0,
        'max_monthly_transactions' => (float)$max_monthly_transactions ?: 0
    ]);
}

/**
 * Get transactions from woo_wallet_transactions table
 */
function ttpaypal_rest_transactions($request) {
    $user_id = get_current_user_id();
    $limit = intval($request->get_param('limit')) ?: 10;
    $offset = intval($request->get_param('offset')) ?: 0;
    
    global $wpdb;
    
    // Get transactions from woo_wallet_transactions table
    $transactions = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}woo_wallet_transactions 
         WHERE user_id = %d 
         ORDER BY date_created DESC 
         LIMIT %d OFFSET %d",
        $user_id, $limit, $offset
    ));
    
    // Format transactions for response
    $formatted_transactions = [];
    foreach ($transactions as $transaction) {
        $formatted_transactions[] = [
            'id' => $transaction->transaction_id,
            'user_id' => $transaction->user_id,
            'type' => $transaction->type, // credit/debit
            'amount' => floatval($transaction->amount),
            'description' => $transaction->description,
            'date_created' => $transaction->date_created,
            'date_updated' => $transaction->date_updated,
            'currency' => $transaction->currency ?: 'TT$'
        ];
    }
    
    // Get total count for pagination
    $total_count = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$wpdb->prefix}woo_wallet_transactions 
         WHERE user_id = %d",
        $user_id
    ));
    
    return rest_ensure_response([
        'transactions' => $formatted_transactions,
        'total_count' => intval($total_count),
        'limit' => $limit,
        'offset' => $offset
    ]);
}

/**
 * Get transaction statistics
 */
function ttpaypal_rest_transaction_stats($request) {
    $user_id = get_current_user_id();
    $period = $request->get_param('period') ?: 'month'; // month, week, year
    
    global $wpdb;
    
    // Calculate date range based on period
    $current_date = current_time('Y-m-d H:i:s');
    switch ($period) {
        case 'week':
            $start_date = date('Y-m-d H:i:s', strtotime('-1 week'));
            break;
        case 'year':
            $start_date = date('Y-m-d H:i:s', strtotime('-1 year'));
            break;
        default: // month
            $start_date = date('Y-m-d H:i:s', strtotime('-1 month'));
            break;
    }
    
    // Get total credits and debits for the period
    $credits = $wpdb->get_var($wpdb->prepare(
        "SELECT COALESCE(SUM(amount), 0) FROM {$wpdb->prefix}woo_wallet_transactions 
         WHERE user_id = %d AND type = 'credit' AND date_created >= %s",
        $user_id, $start_date
    ));
    
    $debits = $wpdb->get_var($wpdb->prepare(
        "SELECT COALESCE(SUM(amount), 0) FROM {$wpdb->prefix}woo_wallet_transactions 
         WHERE user_id = %d AND type = 'debit' AND date_created >= %s",
        $user_id, $start_date
    ));
    
    // Get transaction count for the period
    $transaction_count = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$wpdb->prefix}woo_wallet_transactions 
         WHERE user_id = %d AND date_created >= %s",
        $user_id, $start_date
    ));
    
    // Get recent transaction types breakdown
    $type_breakdown = $wpdb->get_results($wpdb->prepare(
        "SELECT type, COUNT(*) as count, SUM(amount) as total_amount 
         FROM {$wpdb->prefix}woo_wallet_transactions 
         WHERE user_id = %d AND date_created >= %s 
         GROUP BY type",
        $user_id, $start_date
    ));
    
    $type_stats = [];
    foreach ($type_breakdown as $type) {
        $type_stats[$type->type] = [
            'count' => intval($type->count),
            'total_amount' => floatval($type->total_amount)
        ];
    }
    
    return rest_ensure_response([
        'period' => $period,
        'start_date' => $start_date,
        'end_date' => $current_date,
        'total_credits' => floatval($credits),
        'total_debits' => floatval($debits),
        'net_amount' => floatval($credits) - floatval($debits),
        'transaction_count' => intval($transaction_count),
        'type_breakdown' => $type_stats
    ]);
}

/**
 * Get specific transaction by ID
 */
function ttpaypal_rest_get_transaction($request) {
    $user_id = get_current_user_id();
    $transaction_id = intval($request->get_param('id'));
    
    global $wpdb;
    
    // Get transaction from woo_wallet_transactions table
    $transaction = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}woo_wallet_transactions 
         WHERE transaction_id = %d AND user_id = %d",
        $transaction_id, $user_id
    ));
    
    if (!$transaction) {
        return new WP_Error('transaction_not_found', 'Transaction not found', ['status' => 404]);
    }
    
    return rest_ensure_response([
        'id' => $transaction->transaction_id,
        'user_id' => $transaction->user_id,
        'type' => $transaction->type,
        'amount' => floatval($transaction->amount),
        'description' => $transaction->description,
        'date_created' => $transaction->date_created,
        'date_updated' => $transaction->date_updated,
        'currency' => $transaction->currency ?: 'TT$',
        'balance' => floatval($transaction->balance),
        'reference' => $transaction->reference
    ]);
}

/**
 * Process deposit
 */
function ttpaypal_rest_deposit($request) {
    $params = $request->get_json_params();
    $amount = floatval($params['amount']);
    $user_id = get_current_user_id();

    if ($amount <= 0) {
        return new WP_Error('invalid_amount', 'Amount must be positive', ['status' => 400]);
    }

    $balance = function_exists('woo_wallet') ? woo_wallet()->wallet->get_wallet_balance($user_id) : 0;
    if ($balance < $amount) {
        return new WP_Error('insufficient_funds', 'Not enough balance', ['status' => 400]);
    }

    $result = woo_wallet()->wallet->debit($user_id, $amount, 'Deposit to Limey app', 'ttpaypal_deposit');
    if ($result) {
        // Credit TriniCredit
        $current = floatval(get_user_meta($user_id, 'trinicredit_balance', true));
        update_user_meta($user_id, 'trinicredit_balance', $current + $amount);

        return rest_ensure_response(['success' => true, 'message' => 'Deposit successful']);
    } else {
        return new WP_Error('wallet_error', 'Not enough wallet balance', ['status' => 500]);
    }
}

/**
 * Process withdrawal
 */
function ttpaypal_rest_withdraw($request) {
    $params = $request->get_json_params();
    $amount = floatval($params['amount']);
    $user_id = get_current_user_id();

    if ($amount <= 0) {
        return new WP_Error('invalid_amount', 'Amount must be positive', ['status' => 400]);
    }

    // Check and debit TriniCredit
    $current = floatval(get_user_meta($user_id, 'trinicredit_balance', true));
    if ($current < $amount) {
        return new WP_Error('insufficient_trinicredit', 'Not enough TriniCredit', ['status' => 400]);
    }
    update_user_meta($user_id, 'trinicredit_balance', $current - $amount);

    $result = woo_wallet()->wallet->credit($user_id, $amount, 'Withdraw from Limey app', 'ttpaypal_withdraw');
    if ($result) {
        return rest_ensure_response(['success' => true, 'message' => 'Withdraw successful']);
    } else {
        // Rollback TriniCredit if wallet credit fails
        update_user_meta($user_id, 'trinicredit_balance', $current);
        return new WP_Error('wallet_error', 'Could not credit wallet', ['status' => 500]);
    }
}

/**
 * Process wallet transfer
 */
function ttpaypal_rest_wallet_transfer($request) {
    $params = $request->get_json_params();
    $receiver_username = sanitize_text_field($params['receiver_username']);
    $amount = floatval($params['amount']);
    $passcode = sanitize_text_field($params['passcode']);
    $_POST['receiver_username'] = $receiver_username;
    $_POST['amount'] = $amount;
    $_POST['passcode'] = $passcode;
    $_POST['nonce'] = wp_create_nonce('ttpaypal_wallet_transfer_nonce');
    ob_start();
    ttpaypal_process_wallet_transfer();
    $output = ob_get_clean();
    $response = json_decode($output, true);
    if (isset($response['success']) && $response['success']) {
        return rest_ensure_response(['success' => true, 'message' => $response['data'] ?? 'Transfer successful.']);
    } else {
        return new WP_Error('wallet_transfer_failed', $response['data'] ?? 'Transfer failed.', ['status' => 400]);
    }
}

/**
 * Unlink wallet
 */
function ttpaypal_rest_unlink_wallet($request) {
    $user_id = get_current_user_id();
    
    // Remove all TTPayPal related user meta
    delete_user_meta($user_id, 'ttpaypal_wallet_email');
    delete_user_meta($user_id, 'ttpaypal_wallet_passcode');
    delete_user_meta($user_id, 'ttpaypal_user_role');
    delete_user_meta($user_id, 'ttpaypal_per_transaction_limit');
    delete_user_meta($user_id, 'ttpaypal_max_wallet_balance');
    delete_user_meta($user_id, 'ttpaypal_max_monthly_transactions');
    
    return rest_ensure_response([
        'success' => true, 
        'message' => 'Wallet unlinked successfully'
    ]);
}

/**
 * Create database tables on plugin activation
 */
function ttpaypal_create_tables() {
    global $wpdb;
    
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}ttpaypal_users (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        user_id bigint(20) NOT NULL,
        email varchar(255) NOT NULL,
        username varchar(255) NOT NULL,
        password varchar(255) NOT NULL,
        user_role varchar(50) NOT NULL,
        per_transaction_limit decimal(10,2) DEFAULT 0.00,
        max_wallet_balance decimal(10,2) DEFAULT 0.00,
        max_monthly_transactions decimal(10,2) DEFAULT 0.00,
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY user_id (user_id),
        UNIQUE KEY email (email)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}

// Hook to create tables on plugin activation
register_activation_hook(__FILE__, 'ttpaypal_create_tables');

/**
 * Helper function to get TriniCredit balance
 */
function get_trincredits_balance($user_id) {
    return floatval(get_user_meta($user_id, 'trinicredit_balance', true));
}

/**
 * Helper function to update TriniCredit balance
 */
function update_trincredits_balance($user_id, $amount) {
    $current_balance = get_trincredits_balance($user_id);
    $new_balance = $current_balance + $amount;
    update_user_meta($user_id, 'trinicredit_balance', $new_balance);
    return $new_balance;
}

/**
 * Helper function to safely debit TriniCredit balance
 */
function debit_trincredits_balance($user_id, $amount) {
    $current_balance = get_trincredits_balance($user_id);
    
    if ($current_balance < $amount) {
        error_log("TTPayPal Debit Error - Insufficient balance: $current_balance < $amount for user: $user_id");
        return false;
    }
    
    $new_balance = $current_balance - $amount;
    $update_result = update_user_meta($user_id, 'trinicredit_balance', $new_balance);
    
    if ($update_result) {
        error_log("TTPayPal Debit Success - User: $user_id, Amount: $amount, New Balance: $new_balance");
    } else {
        error_log("TTPayPal Debit Error - Failed to update balance for user: $user_id");
    }
    
    return $update_result ? $new_balance : false;
}

/**
 * Helper function to get detailed balance information
 */
function get_detailed_balance_info($user_id) {
    $trinicredit_balance = get_trincredits_balance($user_id);
    $wallet_balance = 0;
    
    if (function_exists('woo_wallet')) {
        $wallet_balance = woo_wallet()->wallet->get_wallet_balance($user_id);
    }
    
    return [
        'user_id' => $user_id,
        'trinicredit_balance' => $trinicredit_balance,
        'wallet_balance' => $wallet_balance,
        'currency' => 'TT$'
    ];
}

/**
 * TTPayPal Limits Configuration
 */
function ttpaypal_get_limits_config() {
    static $limits = null;
    if ($limits === null) {
        $limits = array(
            'per_transaction_limit' => array(
                'administrator' => 1000000,
                'seller-account' => 25000,
                'customer' => 5000,
                'cashier' => 25000,
                'employer' => 100000,
                'topup-withdraw' => 10000,
            ),
            'max_wallet_balance' => array(
                'administrator' => 100000000000,
                'seller-account' => 500000,
                'customer' => 20000,
                'cashier' => 100000,
                'employer' => 100000,
                'topup-withdraw' => 1000000,
                'utility' => 1000000,
            ),
            'max_monthly_transactions' => array(
                'administrator' => 100000000000,
                'seller-account' => 500000,
                'customer' => 20000,
                'cashier' => 100000,
                'employer' => 100000,
                'topup-withdraw' => 1000000,
                'utility' => 1000000,
            ),
        );
    }
    return $limits;
}

/**
 * Get user role limit based on user's WordPress roles
 */
function ttpaypal_get_user_role_limit($user_id, $type='per_transaction_limit') {
    $limits = ttpaypal_get_limits_config();
    $role_limits = $limits[$type];

    $user = get_userdata($user_id);
    if (!$user) return null;

    $user_roles = (array) $user->roles;
    $max_limit = 0;
    
    foreach ($user_roles as $role) {
        if (isset($role_limits[$role]) && $role_limits[$role] > $max_limit) {
            $max_limit = $role_limits[$role];
        }
    }
    return $max_limit;
}

/**
 * Get user per transaction limit
 */
function ttpaypal_get_user_per_transaction_limit($user_id) {
    return ttpaypal_get_user_role_limit($user_id, 'per_transaction_limit');
}

/**
 * Get user wallet max limit
 */
function ttpaypal_get_user_wallet_max_limit($user_id) {
    return ttpaypal_get_user_role_limit($user_id, 'max_wallet_balance');
}

/**
 * Get user max monthly transactions
 */
function ttpaypal_get_user_max_monthly_transactions($user_id) {
    return ttpaypal_get_user_role_limit($user_id, 'max_monthly_transactions');
}

/**
 * Utility function to check if the user is logged in
 */
function ttpaypal_check_user_logged_in() {
    $sender_id = get_current_user_id();
    if ($sender_id === 0) {
        return false; // Return false if not logged in
    }
    return $sender_id; // Return the user ID if logged in
}
?> 