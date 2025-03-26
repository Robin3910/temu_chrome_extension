class AuthService {
  constructor() {
    this.apiBaseUrl = 'YOUR_API_BASE_URL';
  }

  async login(username, password) {
    // TODO: 实现登录逻辑
    return await fetch(`${this.apiBaseUrl}/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  async register(username, password, email) {
    // TODO: 实现注册逻辑
    return await fetch(`${this.apiBaseUrl}/register`, {
      method: 'POST',
      body: JSON.stringify({ username, password, email })
    });
  }

  async logout() {
    // TODO: 实现登出逻辑
  }
}

export default new AuthService();
