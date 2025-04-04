console.log('This is a popup!');

// 监听扩展图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  // 打开侧边栏
  await chrome.sidePanel.open({tabId: tab.id});
  
  // 可选：设置侧边栏为默认打开
  await chrome.sidePanel.setOptions({
    enabled: true
  });
});

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
        await sendOrdersToServer(message.data);
    }

    if (message.type === 'SAVE_ORDER_IMAGES') {
        saveOrderImages(message.data);
        await sendOrdersToServer(message.data);
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
async function sendOrdersToServer(orders) {
    try {
        // 获取店铺信息
        const { shopId, shopName } = await chrome.storage.local.get(['shopId', 'shopName']);
        
        // 准备发送的数据
        const requestData = {
            shopId,
            shopName,
            orders: orders
        };
        console.log('准备发送的数据:', requestData);

        const API_URL = 'http://127.0.0.1:48080/admin-api/system/temu/save';
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
        const result = await chrome.storage.local.get('orders');
        let orders = result.orders || [];
        let successCount = 0;
        let failCount = 0;

        // 更新订单数据，添加图片信息
        orders = orders.map(order => {
            const imageData = orderImages.find(img => img.orderId === order.orderId);
            if (imageData) {
                successCount++;
                return {
                    ...order,
                    customImages: imageData.images,
                    customTexts: imageData.customTexts
                };
            }
            failCount++;
            return order;
        });

        await chrome.storage.local.set({ 
            orders: orders,
            lastUpdated: new Date().toISOString()
        });

        // 向sidebar发送更新消息，包含完整的状态信息
        chrome.runtime.sendMessage({
            type: 'UPDATE_SIDEBAR_ORDERS',
            data: orders,
            status: {
                message: '定制图片抓取完成',
                count: orderImages.length,
                success: successCount,
                fail: failCount,
                progress: 100  // 完成时进度为100%
            }
        });

        console.log('订单图片数据已保存: ', orders);
    } catch (error) {
        console.error('保存订单图片数据失败：', error);
        chrome.runtime.sendMessage({
            type: 'UPDATE_STATUS',
            status: {
                message: '定制图片抓取失败：' + error.message,
                error: true,
                success: 0,
                fail: 1,
                progress: 0
            }
        });
    }
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


