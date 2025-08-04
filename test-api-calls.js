// Test script to debug wallet linking API calls
// Run this in your browser console or as a Node.js script

const SUPABASE_URL = "https://hhcirfvubsugcuypjyxp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoY2lyZnZ1YnN1Z2N1eXBqeXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MjE4OTMsImV4cCI6MjA2Njk5Nzg5M30.1B5paA-hI-zL0NG2st5xiJwecR8z9JBHzCTaAtwX38k";

// Test 1: WordPress JWT Authentication
async function testWordPressAuth(email, password) {
  console.log('🔐 Testing WordPress JWT Authentication...');
  console.log('Email:', email);
  console.log('Password:', password ? '***' : 'undefined');
  
  try {
    const response = await fetch('https://ttpaypal.com/wp-json/jwt-auth/v1/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ username: email, password })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ WordPress JWT Auth SUCCESS');
      return data.token;
    } else {
      console.log('❌ WordPress JWT Auth FAILED');
      console.log('Error message:', data.message || 'Unknown error');
      return null;
    }
  } catch (error) {
    console.log('❌ WordPress JWT Auth ERROR:', error);
    return null;
  }
}

// Test 2: Supabase Wallet Links Table Access
async function testSupabaseWalletLinks(userId) {
  console.log('\n🗄️ Testing Supabase Wallet Links Table Access...');
  console.log('User ID:', userId);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/wallet_links?select=wallet_email&user_id=eq.${userId}`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('Response data:', data);
      console.log('✅ Supabase Wallet Links Access SUCCESS');
      return data;
    } else {
      const errorText = await response.text();
      console.log('Response error text:', errorText);
      console.log('❌ Supabase Wallet Links Access FAILED');
      return null;
    }
  } catch (error) {
    console.log('❌ Supabase Wallet Links Access ERROR:', error);
    return null;
  }
}

// Test 3: Supabase Table Schema Check
async function testSupabaseTableSchema() {
  console.log('\n📋 Testing Supabase Table Schema...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/wallet_links?select=*&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Table structure (first row):', data);
      console.log('✅ Supabase Table Schema Check SUCCESS');
      return true;
    } else {
      const errorText = await response.text();
      console.log('Response error text:', errorText);
      console.log('❌ Supabase Table Schema Check FAILED');
      return false;
    }
  } catch (error) {
    console.log('❌ Supabase Table Schema Check ERROR:', error);
    return false;
  }
}

// Test 4: TTPayPal Link API (requires JWT token)
async function testTTPayPalLink(token, email, password) {
  console.log('\n🔗 Testing TTPayPal Link API...');
  console.log('Email:', email);
  console.log('Has JWT Token:', !!token);
  
  if (!token) {
    console.log('❌ Cannot test TTPayPal Link API without JWT token');
    return null;
  }
  
  try {
    const response = await fetch("https://ttpaypal.com/wp-json/ttpaypal/v1/link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, password, passcode: "" })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ TTPayPal Link API SUCCESS');
      return data;
    } else {
      console.log('❌ TTPayPal Link API FAILED');
      console.log('Error message:', data.message || 'Unknown error');
      return null;
    }
  } catch (error) {
    console.log('❌ TTPayPal Link API ERROR:', error);
    return null;
  }
}

// Main test function
async function runAllTests() {
  console.log('🚀 Starting API Tests...\n');
  
  // Replace these with actual test values
  const testEmail = 'your-test-email@example.com';
  const testPassword = 'your-test-password';
  const testUserId = 'your-test-user-id';
  
  console.log('⚠️  IMPORTANT: Replace the test values in the script with your actual credentials!');
  console.log('Test Email:', testEmail);
  console.log('Test User ID:', testUserId);
  console.log('');
  
  // Test 1: WordPress JWT Auth
  const jwtToken = await testWordPressAuth(testEmail, testPassword);
  
  // Test 2: Supabase Table Schema
  const tableExists = await testSupabaseTableSchema();
  
  // Test 3: Supabase Wallet Links Access
  const walletLinks = await testSupabaseWalletLinks(testUserId);
  
  // Test 4: TTPayPal Link API (only if we have JWT token)
  if (jwtToken) {
    await testTTPayPalLink(jwtToken, testEmail, testPassword);
  }
  
  console.log('\n📊 Test Summary:');
  console.log('- WordPress JWT Auth:', jwtToken ? '✅ SUCCESS' : '❌ FAILED');
  console.log('- Supabase Table Schema:', tableExists ? '✅ SUCCESS' : '❌ FAILED');
  console.log('- Supabase Wallet Links Access:', walletLinks !== null ? '✅ SUCCESS' : '❌ FAILED');
  console.log('- TTPayPal Link API:', jwtToken ? '✅ TESTED' : '❌ SKIPPED (no JWT)');
}

// Export functions for use in browser console
window.testWalletAPIs = {
  testWordPressAuth,
  testSupabaseWalletLinks,
  testSupabaseTableSchema,
  testTTPayPalLink,
  runAllTests
};

console.log('🔧 API Test functions loaded!');
console.log('Usage:');
console.log('- window.testWalletAPIs.runAllTests() - Run all tests');
console.log('- window.testWalletAPIs.testWordPressAuth(email, password) - Test WordPress auth');
console.log('- window.testWalletAPIs.testSupabaseWalletLinks(userId) - Test Supabase access');
console.log('- window.testWalletAPIs.testSupabaseTableSchema() - Test table structure'); 