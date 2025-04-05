console.log('This is a popup!');
  
// 添加自动登录功能
async function autoLogin() {
    try {
        // 检查当前登录状态
        const { isLoggedIn, accessToken, expiresTime } = 
            await chrome.storage.local.get(['isLoggedIn', 'accessToken', 'expiresTime']);
        
        // 如果已登录且令牌未过期，则不需要重新登录
        const currentTime = new Date().getTime();
        if (isLoggedIn && accessToken && expiresTime && currentTime < expiresTime) {
            console.log('已登录状态，不需要重新登录');
            return true;
        }
        
        // 执行自动登录
        console.log('开始自动登录...');
        
        // 使用预设的账号密码登录 (这些应该从配置或环境变量中获取)
        const username = "admin"; // 替换为您的默认账号
        const password = "admin123"; // 替换为您的默认密码
        
        const response = await fetch('http://127.0.0.1:48080/admin-api/system/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'tenant-id': '1'
            },
            body: JSON.stringify({
                username: username,
                password: password,
                uuid: "19",
                code: "48"
            })
        });
        
        const result = await response.json();
        
        if (result.code === 0 && result.data) {
            // 登录成功，保存令牌和用户信息
            await chrome.storage.local.set({ 
                accessToken: result.data.accessToken,
                refreshToken: result.data.refreshToken,
                expiresTime: result.data.expiresTime,
                userId: result.data.userId,
                userName: username,
                isLoggedIn: true,
                loginTime: new Date().getTime()
            });
            
            console.log('自动登录成功');
            return true;
        } else {
            console.error('自动登录失败:', result.msg);
            return false;
        }
    } catch (error) {
        console.error('自动登录出错:', error);
        return false;
    }
}

// 在扩展启动时执行自动登录
chrome.runtime.onStartup.addListener(() => {
    autoLogin();
});

// 在安装/更新后执行自动登录
chrome.runtime.onInstalled.addListener(() => {
    autoLogin();
});

// 监听扩展图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
    // await autoLogin();
    // 打开侧边栏
    await chrome.sidePanel.open({tabId: tab.id});
    
    // 可选：设置侧边栏为默认打开
    // await chrome.sidePanel.setOptions({
    //   enabled: true
    // });
});

// // 修改扩展图标点击事件处理
// chrome.action.onClicked.addListener(async (tab) => {
//   // 尝试自动登录
//   await autoLogin();
// });

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'ENTITY_NAME_FOUND') {
        // 从entityName中提取数字ID
        const shopId = message.data.entityName.replace(/[^0-9]/g, '');
        const shopName = message.data.shopName;
        
        // 存储店铺信息
        chrome.storage.local.set({
            shopId: shopId,
            shopName: shopName,
            lastUpdated: new Date().toISOString()
        });

        // 向sidebar发送更新消息
        chrome.runtime.sendMessage({
            type: 'UPDATE_SHOP_INFO',
            data: {
                shopId: shopId,
                shopName: shopName
            }
        });
    }

    if (message.type === 'SAVE_ORDERS') {
        saveOrders(message.data);
        // 发送数据到服务器
        await sendOrdersToServer();
    }

    if (message.type === 'SAVE_ORDER_IMAGES') {
        await saveOrderImages(message.data);
        await sendOrdersToServer();
    }

    if (message.type === 'FETCH_CATEGORY_DATA') {
        try {
            const data = await fetchCategoryMapping(message.shopId);
            sendResponse({ success: true, data: data });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
        return true; // 保持消息通道开启以进行异步响应
    }

    if (message.type === 'OPEN_SIDEBAR') {
        try {
            if (sender.tab) {
                await chrome.sidePanel.open({ tabId: sender.tab.id });
                sendResponse({ success: true });
            }
        } catch (error) {
            console.error('打开侧边栏失败:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }

    if (message.type === 'SYNC_ORDERS') {
        try {
            // 确保已登录
            const loginSuccess = await autoLogin();
            if (!loginSuccess) {
                console.error('同步订单前登录失败');
                sendResponse({ success: false, error: '登录失败' });
                return true;
            }
            
            // 向对应标签页发送收集订单的指令
            if (sender.tab) {
                try {
                    await chrome.tabs.sendMessage(sender.tab.id, { 
                        type: 'COLLECT_ORDERS' 
                    });
                    sendResponse({ success: true });
                } catch (error) {
                    console.error('发送收集订单消息失败:', error);
                    sendResponse({ success: false, error: error.message });
                }
            }
        } catch (error) {
            console.error('同步订单失败:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
});

// 保存订单数据到本地存储
async function saveOrders(orders) {
    try {
        await chrome.storage.local.set({ 
            orders: orders,
            lastUpdated: new Date().toISOString()
        });

        // 向sidebar发送更新消息，包含完整的状态信息
        chrome.runtime.sendMessage({
            type: 'UPDATE_SIDEBAR_ORDERS',
            data: orders,
            status: {
                message: '订单列表抓取完成',
                count: orders.length,
                success: orders.length,
                fail: 0,
                progress: 100
            }
        });

       console.log('订单数据已保存，总数：', orders.length);
    } catch (error) {
        console.error('保存订单数据失败：', error);
        chrome.runtime.sendMessage({
            type: 'UPDATE_STATUS',
            status: {
                message: '订单抓取失败：' + error.message,
                error: true,
                success: 0,
                fail: 1,
                progress: 0
            }
        });
    }
}

// 发送订单数据到服务器
async function sendOrdersToServer() {
    try {
        // 获取店铺信息
        const { shopId, shopName } = await chrome.storage.local.get(['shopId', 'shopName']);
        const orders = await chrome.storage.local.get('orders');
        
        // 准备发送的数据
        const requestData = {
            shopId,
            shopName,
            orders: orders
        };
        console.log('准备发送的数据:', requestData);

        const API_URL = 'http://127.0.0.1:48080/admin-api/temu/order/save';
        const result = await authenticatedFetch(API_URL, 'POST', requestData);
        
        console.log('数据已成功发送到服务器:', result);

        // 更新状态消息
        chrome.runtime.sendMessage({
            type: 'UPDATE_STATUS',
            status: {
                message: '数据已成功同步到服务器',
                success: orders.length,
                fail: 0,
                progress: 100
            }
        });

    } catch (error) {
        console.error('发送数据到服务器失败:', error);
        chrome.runtime.sendMessage({
            type: 'UPDATE_STATUS',
            status: {
                message: '同步到服务器失败：' + error.message,
                error: true
            }
        });
        throw error;
    }
}

// 保存订单图片数据
async function saveOrderImages(orderImages) {
    try {
        let successCount = 0;
        let failCount = 0;
        let totalImages = 0;
        
        // 获取之前保存的订单数据
        const result = await chrome.storage.local.get('orders');
        let orders = result.orders || [];

        // 处理每个订单的图片
        for (const imageData of orderImages) {
            const orderId = imageData.orderId;
            const customId = imageData.customSkuId;
            totalImages += imageData.images.length;

            console.log('订单图片数据:', imageData);

            // 查找对应的订单
            const orderIndex = orders.findIndex(order => customId == order.skus.customSku);
            if (orderIndex !== -1) {
                // 上传订单图片到云存储
                const uploadedImages = await uploadImagesToCloud(imageData.images, orderId, customId);
                
                orders[orderIndex] = {
                    ...orders[orderIndex],
                    // customImages: uploadedImages.urls,
                    customImages: uploadedImages.cloudUrls, // 新增: 云存储URL
                    customTexts: imageData.customTexts
                };
                
                successCount += uploadedImages.success;
                failCount += uploadedImages.fail;
            } else {
                console.warn(`未找到对应订单: ${orderId}`);
                failCount += imageData.images.length;
            }
        }

        console.log('上传后的订单数据:', orders);

        // 保存更新后的订单数据
        await chrome.storage.local.set({ 
            orders: orders,
            lastUpdated: new Date().toISOString()
        });

        // 发送状态更新消息
        chrome.runtime.sendMessage({
            type: 'UPDATE_SIDEBAR_ORDERS',
            data: orders,
            status: {
                message: '定制图片上传完成',
                count: totalImages,
                success: successCount,
                fail: failCount,
                progress: 100
            }
        });

        console.log('订单图片数据已保存并上传到云存储: ', orders);
    } catch (error) {
        console.error('保存和上传订单图片数据失败：', error);
        chrome.runtime.sendMessage({
            type: 'UPDATE_STATUS',
            status: {
                message: '定制图片上传失败：' + error.message,
                error: true
            }
        });
    }
}

// 上传图片到云存储
async function uploadImagesToCloud(imageUrls, orderId, customId) {
    const results = {
        urls: [],     // 原始URL（备用）
        cloudUrls: [], // 云存储URL
        success: 0,
        fail: 0
    };
    
    try {
        // 获取认证信息
        const { accessToken } = await chrome.storage.local.get(['accessToken']);
        if (!accessToken) {
            throw new Error('未登录或会话已过期');
        }
        
        // 处理每张图片
        for (const imageUrl of imageUrls) {
            try {
                // 先添加原始URL（作为备用）
                results.urls.push(imageUrl);
                
                // 获取图片数据
                const blob = await fetchImageAsBlob(imageUrl);
                
                // 生成唯一文件名
                const fileName = `temu_${orderId}_${customId}_${Date.now()}_${results.urls.length}.png`;
                
                // 准备文件上传
                const formData = new FormData();
                formData.append('file', blob, fileName);

                console.log('准备上传的文件:', formData);
                
                // 上传到您的云存储API
                const API_URL = 'http://127.0.0.1:48080/admin-api/temu/oss/upload';
                
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: formData
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('OSS接口返回:', data);
                // 假设API返回格式 {code: 0, data: {url: '云存储URL'}}
                if (data.code === 0 && data.data) {
                    results.cloudUrls.push(data.data);
                    results.success++;
                    console.log(`图片上传成功: ${data.data}`);
                } else {
                    throw new Error('上传响应格式错误');
                }
            } catch (error) {
                console.error(`上传图片失败:`, error);
                results.cloudUrls.push(''); // 占位
                results.fail++;
            }
        }
        
        return results;
    } catch (error) {
        console.error('上传过程中发生错误:', error);
        // 对于剩余未处理的图片，填充空占位符
        const remaining = imageUrls.length - (results.success + results.fail);
        for (let i = 0; i < remaining; i++) {
            results.cloudUrls.push('');
            results.fail++;
        }
        return results;
    }
}

// 将图片URL转换为Blob对象
async function fetchImageAsBlob(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.blob();
}

// 获取店铺商品类目信息
async function fetchCategoryMapping(shopId) {
    try {
        const API_URL = 'http://127.0.0.1:48080/admin-api/temu/category/page';
        
        const data = await authenticatedFetch(API_URL, 'POST', {});
        
        // 将数据存储到本地
        await chrome.storage.local.set({
            category: data.data,
            categoryLastUpdated: new Date().toISOString()
        });
        
        console.log('成功获取店铺商品类目:', data.data);
        return data.data;
    } catch (error) {
        console.error('获取店铺商品类目失败:', error);
        throw error;
    }
}

// 获取店铺SKU映射信息
async function fetchCategorySkuMapping(shopId) {
    try {
        const API_URL = 'http://127.0.0.1:48080/admin-api/temu/category-sku/page';
        
        const data = await authenticatedFetch(API_URL, 'POST', {
            shopId: shopId
        });
        
        // 将数据存储到本地
        await chrome.storage.local.set({ 
            categorySkuMapping: data.data,
            categoryLastUpdated: new Date().toISOString()
        });
        
        console.log('成功获取店铺SKU映射:', data.data);
        return data.data;
    } catch (error) {
        console.error('获取店铺SKU映射失败:', error);
        throw error;
    }
}

// 带认证令牌的通用API请求函数
async function authenticatedFetch(url, method, body) {
    try {
        // 获取访问令牌
        const { accessToken } = await chrome.storage.local.get(['accessToken']);
        
        if (!accessToken) {
            throw new Error('未登录或会话已过期');
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: body ? JSON.stringify(body) : undefined
        });
        
        if (!response.ok) {
            // 处理特定的错误代码，如401（未授权）
            if (response.status === 401) {
                // 清除过期的令牌
                await chrome.storage.local.remove(['accessToken', 'refreshToken', 'expiresTime', 'isLoggedIn']);
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API请求失败:', error);
        throw error;
    }
}


