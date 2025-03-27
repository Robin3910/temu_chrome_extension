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
    }
});

// 保存订单数据到本地存储
async function saveOrders(orders) {
    try {
        // 获取现有订单数据
        const result = await chrome.storage.local.get('orders');
        let existingOrders = result.orders || [];

        // 更新或添加新订单
        orders.forEach(newOrder => {
            const existingIndex = existingOrders.findIndex(order => order.orderId === newOrder.orderId);
            if (existingIndex >= 0) {
                existingOrders[existingIndex] = newOrder;
            } else {
                existingOrders.push(newOrder);
            }
        });

        // 保存更新后的订单数据
        await chrome.storage.local.set({ 
            orders: existingOrders,
            lastUpdated: new Date().toISOString()
        });

        console.log('订单数据已保存，总数：', existingOrders.length);
    } catch (error) {
        console.error('保存订单数据失败：', error);
    }
}

// 其他后台逻辑...

// chrome.storage.local.get(['orders', 'lastUpdated'], function(result) {
//     console.log('保存的订单数据：', result.orders);
//     console.log('最后更新时间：', result.lastUpdated);
// });
