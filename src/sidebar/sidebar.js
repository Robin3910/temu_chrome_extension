document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');

    // 切换表单显示
    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('切换到注册表单');  // 调试日志
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        });
    }

    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('切换到登录表单');  // 调试日志
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        });
    }

    // 登录表单提交
    const loginFormElement = document.getElementById('login');
    if (loginFormElement) {
        loginFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;

            try {
                // 模拟登录成功
                console.log('登录信息:', { username, password });
                
                // 保存登录状态和用户信息
                await chrome.storage.local.set({ 
                    userToken: 'dummy_token',
                    userName: username 
                });

                // 显示登录后的界面
                showLoggedInUI(username);
            } catch (error) {
                console.error('登录失败:', error);
            }
        });
    }

    // 退出登录
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await chrome.storage.local.remove(['userToken', 'userName']);
            showLoggedOutUI();
        });
    }

    // 开始抓取按钮
    const startScrapeBtn = document.getElementById('startScrapeBtn');

    // 开始抓取按钮点击事件
    if (startScrapeBtn) {
        startScrapeBtn.addEventListener('click', async () => {
            try {

                // 获取当前标签页
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                
                if (tab && tab.url.includes('seller.kuajingmaihuo.com/main/order-manage-custom')) {
                    await chrome.tabs.reload(tab.id);
                    // 等待页面加载完成
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    // 然后收集店铺信息
                    try {
                        const response = await chrome.tabs.sendMessage(tab.id, { 
                            type: 'COLLECT_ORDERS' 
                        }).catch(error => {
                            console.error('发送消息失败:', error);
                            throw new Error('无法连接到页面，请刷新页面后重试');
                        });
                        
                        // 更新状态消息
                        const statusMessage = document.getElementById('statusMessage');
                        if (statusMessage) {
                            statusMessage.textContent = '正在收集订单...';
                        }

                    } catch (error) {
                        alert(error.message);
                    }
                } else {
                    alert('请先打开TEMU后台【定制建议】页面：https://seller.kuajingmaihuo.com/main/order-manage-custom');
                }
            } catch (error) {
                console.error('操作失败:', error);
                alert('操作失败，请确保在正确的页面上');
            }
        });
    }

    // 检查登录状态并显示相应界面
    const checkAuthStatus = async () => {
        try {
            const { userToken, userName } = await chrome.storage.local.get(['userToken', 'userName']);
            if (userToken) {
                showLoggedInUI(userName);
            } else {
                showLoggedOutUI();
            }
        } catch (error) {
            console.error('检查登录状态失败:', error);
            showLoggedOutUI();
        }
    };

    // 显示登录后的界面
    function showLoggedInUI(username) {
        document.getElementById('beforeLogin').classList.add('hidden');
        document.getElementById('afterLogin').classList.remove('hidden');
        document.getElementById('userNameDisplay').textContent = `欢迎, ${username}`;
        
        // 获取并显示店铺信息
        chrome.storage.local.get(['shopId', 'shopName'], function(result) {
            if (result.shopId || result.shopName) {
                const shopInfoElement = document.createElement('div');
                shopInfoElement.className = 'shop-info';
                
                let infoText = '';
                if (result.shopId) {
                    infoText += `店铺ID: ${result.shopId}`;
                }
                if (result.shopName) {
                    infoText += infoText ? '<br>' : '';
                    infoText += `店铺名称: ${result.shopName}`;
                }
                
                shopInfoElement.innerHTML = infoText;
                document.querySelector('.user-info').appendChild(shopInfoElement);
            }
        });
    }

    // 监听店铺信息更新
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'UPDATE_ENTITY_NAME') {
            const existingShopInfo = document.querySelector('.shop-info');
            const infoText = `店铺ID: ${message.data.shopId}<br>店铺名称: ${message.data.shopName}`;
            
            if (existingShopInfo) {
                existingShopInfo.innerHTML = infoText;
            } else {
                const shopInfoElement = document.createElement('div');
                shopInfoElement.className = 'shop-info';
                shopInfoElement.innerHTML = infoText;
                document.querySelector('.user-info').appendChild(shopInfoElement);
            }
        }
    });

    // 显示登录前的界面
    function showLoggedOutUI() {
        document.getElementById('beforeLogin').classList.remove('hidden');
        document.getElementById('afterLogin').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
    }

    // 注册表单提交
    const registerFormElement = document.getElementById('register');
    if (registerFormElement) {
        registerFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('registerUsername').value;
            const phone = document.getElementById('registerPhone').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                alert('两次输入的密码不一致');
                return;
            }

            try {
                console.log('注册信息:', { username, phone, password });
                // TODO: 实现注册API调用
            } catch (error) {
                console.error('注册失败:', error);
            }
        });
    }

    // 初始检查登录状态
    checkAuthStatus();
}); 