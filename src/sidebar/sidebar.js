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

    // 开始抓取按钮
    const startScrapeImagesBtn = document.getElementById('startScrapeImagesBtn');

    // 开始抓取按钮点击事件
    if (startScrapeImagesBtn) {
        startScrapeImagesBtn.addEventListener('click', async () => {
            try {
                // 获取当前标签页
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                
                if (tab && tab.url.includes('https://agentseller.temu.com/main/customize-goods')) {
                    await chrome.tabs.reload(tab.id);
                    // 等待页面加载完成
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    // 然后收集店铺信息
                    try {
                        const response = await chrome.tabs.sendMessage(tab.id, { 
                            type: 'COLLECT_ORDER_IMAGES' 
                        }).catch(error => {
                            console.error('发送消息失败:', error);
                            throw new Error('无法连接到页面，请刷新页面后重试');
                        });
                        
                        // 更新状态消息
                        const statusMessage = document.getElementById('statusMessage');
                        if (statusMessage) {
                            statusMessage.textContent = '正在收集定制图片...';
                        }

                    } catch (error) {
                        alert(error.message);
                    }
                } else {
                    alert('请先打开TEMU后台【定制内容】页面：https://agentseller.temu.com/main/customize-goods');
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

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_SHOP_INFO') {
        updateShopInfo(message.data);
    }
    if (message.type === 'UPDATE_SIDEBAR_ORDERS') {
        displayOrders(message.data);
        // 更新状态信息
        if (message.status) {
            updateStatus(message.status);
        }
    }
    if (message.type === 'UPDATE_STATUS') {
        updateStatus(message.status);
    }
});

// 页面加载时获取并显示已存储的订单
document.addEventListener('DOMContentLoaded', async () => {
    const result = await chrome.storage.local.get('orders');
    if (result.orders) {
        displayOrders(result.orders);
    }
});

function displayOrders(orders) {
    const ordersList = document.getElementById('ordersList');
    ordersList.innerHTML = '';

    // 对订单按创建时间进行排序（倒序）
    const sortedOrders = [...orders].sort((a, b) => {
        const timeA = new Date(a.creationTime).getTime();
        const timeB = new Date(b.creationTime).getTime();
        return timeB - timeA;
    });

    sortedOrders.forEach(order => {
        const orderElement = document.createElement('div');
        orderElement.className = 'order-item';
        
        // 构建定制图片预览HTML，添加data-full-image属性
        const imagesHtml = order.customImages ? 
            `<div class="custom-images">
                <p>定制图片：</p>
                <div class="images-container">
                    ${order.customImages.map(img => 
                        `<img src="${img}" alt="定制图片" class="custom-image" data-full-image="${img}">`
                    ).join('')}
                </div>
            </div>` : '';

        // 构建定制文字HTML
        const textsHtml = order.customTexts ? 
            `<div class="custom-texts">
                <p>定制文字：</p>
                <div class="texts-container">
                    ${order.customTexts.map(text => 
                        `<div class="custom-text">${text}</div>`
                    ).join('')}
                </div>
            </div>` : '';

        orderElement.innerHTML = `
            <div class="order-header">
                <span class="order-id">订单号：${order.orderId}</span>
                <span class="order-status">${order.status}</span>
            </div>
            <div class="order-details">
                <p class="order-title">商品标题：${order.title || '暂无标题'}</p>
                <p>创建时间：${order.creationTime}</p>
                <p>发货期限：${order.shippingDeadline}</p>
                <p>送达期限：${order.deliveryDeadline}</p>
                <p>商品属性：${order.skus.property}</p>
                <p>SKU ID：${order.skus.skuId}</p>
                <p>定制 SKU：${order.skus.customSku}</p>
                <p>数量：${order.quantity}</p>
                <p>价格：￥${order.price}</p>
                ${textsHtml}
                ${imagesHtml}
            </div>
        `;
        ordersList.appendChild(orderElement);

        // 为新添加的图片绑定点击事件
        const images = orderElement.querySelectorAll('.custom-image');
        images.forEach(img => {
            img.addEventListener('click', showModal);
        });
    });
}

// 添加显示和关闭模态框的函数
function showModal(event) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const fullImage = event.target.getAttribute('data-full-image');
    
    modalImg.src = fullImage;
    modal.classList.add('show');
}

// 在文档加载完成后添加模态框点击关闭事件
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('imageModal');
    modal.addEventListener('click', () => {
        modal.classList.remove('show');
    });
});

// 更新店铺信息显示
function updateShopInfo(data) {
    const shopInfoContainer = document.querySelector('.shop-info');
    const infoText = `
        <p>店铺ID：${data.shopId}</p>
        <p>店铺名称：${data.shopName}</p>
    `;
    
    if (shopInfoContainer) {
        shopInfoContainer.innerHTML = infoText;
    } else {
        const newShopInfo = document.createElement('div');
        newShopInfo.className = 'shop-info';
        newShopInfo.innerHTML = infoText;
        document.querySelector('.user-info').appendChild(newShopInfo);
    }
}

// 更新状态显示
function updateStatus(status) {
    const statusMessage = document.getElementById('statusMessage');
    const orderCount = document.getElementById('orderCount');
    const successCount = document.getElementById('successCount');
    const failCount = document.getElementById('failCount');
    const progressBar = document.querySelector('.progress');
    
    if (statusMessage) {
        statusMessage.textContent = status.message;
        if (status.error) {
            statusMessage.classList.add('error');
        } else {
            statusMessage.classList.remove('error');
        }
    }
    
    if (orderCount && status.count !== undefined) {
        orderCount.textContent = status.count;
    }

    if (successCount && status.success !== undefined) {
        successCount.textContent = status.success;
    }

    if (failCount && status.fail !== undefined) {
        failCount.textContent = status.fail;
    }

    if (progressBar && status.progress !== undefined) {
        progressBar.style.width = `${status.progress}%`;
    }
} 