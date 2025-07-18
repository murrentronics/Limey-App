// Debug script for 403 Forbidden error from WordPress JWT endpoint
console.log('🔍 Debugging 403 Forbidden Error...\n');

// Test 1: Basic CORS and endpoint availability
async function testEndpointAvailability() {
  console.log('🌐 Testing endpoint availability and CORS...');
  
  try {
    // Test with OPTIONS request first (CORS preflight)
    const optionsResponse = await fetch('https://ttpaypal.com/wp-json/jwt-auth/v1/token', {
      method: 'OPTIONS',
      headers: {
        'Origin': window.location.origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log('OPTIONS response status:', optionsResponse.status);
    console.log('CORS headers:', {
      'Access-Control-Allow-Origin': optionsResponse.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': optionsResponse.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': optionsResponse.headers.get('Access-Control-Allow-Headers')
    });
    
    // Test with POST request (actual JWT auth)
    const postResponse = await fetch('https://ttpaypal.com/wp-json/jwt-auth/v1/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': window.location.origin
      },
      body: JSON.stringify({ 
        username: 'test@example.com', 
        password: 'testpassword' 
      })
    });
    
    console.log('POST response status:', postResponse.status);
    console.log('POST response headers:', Object.fromEntries(postResponse.headers.entries()));
    
    const responseText = await postResponse.text();
    console.log('Response body:', responseText);
    
    if (postResponse.status === 403) {
      console.log('❌ 403 Forbidden - Possible causes:');
      console.log('1. CORS is blocked');
      console.log('2. JWT plugin is disabled');
      console.log('3. Endpoint is protected by security measures');
      console.log('4. Rate limiting');
      console.log('5. WordPress authentication requirements changed');
    }
    
  } catch (error) {
    console.log('❌ Network error:', error);
  }
}

// Test 2: Check if WordPress site is accessible
async function testWordPressSite() {
  console.log('\n🏠 Testing WordPress site accessibility...');
  
  try {
    const response = await fetch('https://ttpaypal.com/wp-json/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('WordPress API status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('WordPress API info:', data);
      console.log('✅ WordPress site is accessible');
    } else {
      console.log('❌ WordPress site might be down or restricted');
    }
  } catch (error) {
    console.log('❌ Cannot access WordPress site:', error);
  }
}

// Test 3: Check JWT plugin availability
async function testJWTPlugin() {
  console.log('\n🔑 Testing JWT plugin availability...');
  
  try {
    // Try to access JWT plugin info
    const response = await fetch('https://ttpaypal.com/wp-json/jwt-auth/v1/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('JWT plugin status:', response.status);
    
    if (response.ok) {
      const data = await response.text();
      console.log('JWT plugin response:', data);
      console.log('✅ JWT plugin appears to be active');
    } else {
      console.log('❌ JWT plugin might be disabled or misconfigured');
    }
  } catch (error) {
    console.log('❌ Cannot access JWT plugin:', error);
  }
}

// Test 4: Try different authentication methods
async function testAlternativeAuth() {
  console.log('\n🔄 Testing alternative authentication methods...');
  
  const testCases = [
    {
      name: 'Standard JWT Auth',
      body: { username: 'test@example.com', password: 'testpassword' }
    },
    {
      name: 'Email instead of username',
      body: { email: 'test@example.com', password: 'testpassword' }
    },
    {
      name: 'With application password',
      body: { username: 'test@example.com', password: 'testpassword', app_password: true }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\nTesting: ${testCase.name}`);
    
    try {
      const response = await fetch('https://ttpaypal.com/wp-json/jwt-auth/v1/token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(testCase.body)
      });
      
      console.log('Status:', response.status);
      const responseText = await response.text();
      console.log('Response:', responseText);
      
    } catch (error) {
      console.log('Error:', error);
    }
  }
}

// Test 5: Check for rate limiting
async function testRateLimiting() {
  console.log('\n⏱️ Testing for rate limiting...');
  
  const requests = [];
  for (let i = 0; i < 5; i++) {
    requests.push(
      fetch('https://ttpaypal.com/wp-json/jwt-auth/v1/token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ username: 'test@example.com', password: 'testpassword' })
      })
    );
  }
  
  try {
    const responses = await Promise.all(requests);
    responses.forEach((response, index) => {
      console.log(`Request ${index + 1} status:`, response.status);
    });
    
    const all403 = responses.every(r => r.status === 403);
    if (all403) {
      console.log('❌ All requests returned 403 - likely not rate limiting');
    } else {
      console.log('⚠️ Mixed responses - might be rate limiting');
    }
  } catch (error) {
    console.log('Error testing rate limiting:', error);
  }
}

// Main debug function
async function runDebugTests() {
  console.log('🚀 Starting 403 Forbidden Debug Tests...\n');
  
  await testEndpointAvailability();
  await testWordPressSite();
  await testJWTPlugin();
  await testAlternativeAuth();
  await testRateLimiting();
  
  console.log('\n📊 Debug Summary:');
  console.log('Check the results above to identify the cause of the 403 error.');
  console.log('\n🔧 Common Solutions:');
  console.log('1. If CORS issue: Contact WordPress admin to allow your domain');
  console.log('2. If JWT plugin disabled: Enable JWT Authentication plugin');
  console.log('3. If security measures: Check WordPress security plugins');
  console.log('4. If rate limiting: Wait and try again later');
  console.log('5. If authentication changed: Update credentials or method');
}

// Export for browser console
window.debug403Error = {
  testEndpointAvailability,
  testWordPressSite,
  testJWTPlugin,
  testAlternativeAuth,
  testRateLimiting,
  runDebugTests
};

console.log('🔧 Debug functions loaded!');
console.log('Run: window.debug403Error.runDebugTests() to start debugging'); 