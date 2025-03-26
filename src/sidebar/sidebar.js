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
    const collectShopIdBtn = document.getElementById('collectShopIdBtn');
    const refreshPageBtn = document.getElementById('refreshPageBtn');

    // 刷新页面按钮点击事件
    if (refreshPageBtn) {
        refreshPageBtn.addEventListener('click', async () => {
            try {
                // 获取当前标签页
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                
                if (tab) {
                    // 刷新当前标签页
                    await chrome.tabs.reload(tab.id);
                    
                    // 更新状态消息
                    const statusMessage = document.getElementById('statusMessage');
                    if (statusMessage) {
                        statusMessage.textContent = '页面刷新中...';
                    }
                }
            } catch (error) {
                console.error('刷新页面失败:', error);
                alert('刷新页面失败，请手动刷新');
            }
        });
    }

    // 收集店铺ID按钮点击事件
    if (collectShopIdBtn) {
        collectShopIdBtn.addEventListener('click', async () => {
            try {
                // 获取当前标签页
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                
                if (tab && tab.url.includes('seller.kuajingmaihuo.com')) {
                    try {
                        // 发送消息到内容脚本并等待响应
                        const response = await chrome.tabs.sendMessage(tab.id, { 
                            type: 'COLLECT_SHOP_ID' 
                        }).catch(error => {
                            console.error('发送消息失败:', error);
                            throw new Error('无法连接到页面，请刷新页面后重试');
                        });
                        
                        // 更新状态消息
                        const statusMessage = document.getElementById('statusMessage');
                        if (statusMessage) {
                            statusMessage.textContent = '正在收集店铺ID...';
                        }
                    } catch (error) {
                        alert(error.message);
                    }
                } else {
                    alert('请先打开跨境买货网站');
                }
            } catch (error) {
                console.error('收集店铺ID失败:', error);
                alert('收集店铺ID失败，请确保在正确的页面上');
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
        
        // 获取并显示实体名称
        chrome.storage.local.get(['entityName'], function(result) {
            if (result.entityName) {
                const entityNameElement = document.createElement('div');
                entityNameElement.className = 'entity-name';
                entityNameElement.textContent = `店铺名称: ${result.entityName}`;
                document.querySelector('.user-info').appendChild(entityNameElement);
            }
        });
    }

    // 监听实体名称更新
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'UPDATE_ENTITY_NAME') {
            const existingEntityName = document.querySelector('.entity-name');
            if (existingEntityName) {
                existingEntityName.textContent = `店铺名称: ${message.data}`;
            } else {
                const entityNameElement = document.createElement('div');
                entityNameElement.className = 'entity-name';
                entityNameElement.textContent = `店铺名称: ${message.data}`;
                document.querySelector('.user-info').appendChild(entityNameElement);
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