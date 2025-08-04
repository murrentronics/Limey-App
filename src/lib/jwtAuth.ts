export async function wpLogin(username: string, password: string) {
  try {
    const res = await fetch('https://theronm18.sg-host.com/wp-json/jwt-auth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      let error = 'WordPress login failed';
      try {
        const data = await res.json();
        error = data.message || error;
      } catch { }
      throw new Error(error);
    }

    const data = await res.json();

    // Store the token if successful
    if (data.token) {
      storeWpToken(data.token);
    }

    return data; // { token, ... }
  } catch (error) {
    console.error('WordPress login error:', error);
    throw error;
  }
}

export function storeWpToken(token: string) {
  localStorage.setItem('wp_jwt_token', token);
  localStorage.setItem('wp_jwt_validated', 'true');
  localStorage.setItem('wp_jwt_validation_time', Date.now().toString());
}

export function getWpToken() {
  const token = localStorage.getItem('wp_jwt_token');
  const validated = localStorage.getItem('wp_jwt_validated');
  const validationTime = localStorage.getItem('wp_jwt_validation_time');

  // Check if token is still valid (24 hours)
  if (token && validated === 'true' && validationTime) {
    const tokenAge = Date.now() - parseInt(validationTime);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (tokenAge > maxAge) {
      clearWpToken();
      return null;
    }

    return token;
  }

  return null;
}

export function clearWpToken() {
  localStorage.removeItem('wp_jwt_token');
  localStorage.removeItem('wp_jwt_validated');
  localStorage.removeItem('wp_jwt_validation_time');
}

export function isWpTokenValid(): boolean {
  const token = getWpToken();
  return token !== null;
} 