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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    }

    if (message.type === 'SAVE_ORDER_IMAGES') {
        saveOrderImages(message.data);
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
                progress: 100  // 完成时进度为100%
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

