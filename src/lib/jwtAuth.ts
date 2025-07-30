export async function wpLogin(username: string, password: string) {
  const res = await fetch('https://theronm18.sg-host.com/wp-json/jwt-auth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    let error = 'WordPress login failed';
    try { const data = await res.json(); error = data.message || error; } catch {}
    throw new Error(error);
  }
  return res.json(); // { token, ... }
}

export function storeWpToken(token: string) {
  localStorage.setItem('wp_jwt_token', token);
}

export function getWpToken() {
  return localStorage.getItem('wp_jwt_token');
}

export function clearWpToken() {
  localStorage.removeItem('wp_jwt_token');
} 