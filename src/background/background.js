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

        console.log("获取到店铺信息：", { shopId, shopName });
        
        // 通知侧边栏更新显示
        chrome.runtime.sendMessage({
            type: 'UPDATE_ENTITY_NAME',
            data: {
                shopId: shopId,
                shopName: shopName
            }
        });
    }
});

// 其他后台逻辑...
