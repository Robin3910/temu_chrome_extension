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
        // 存储实体名称
        chrome.storage.local.set({
            entityName: message.data,
            lastUpdated: new Date().toISOString()
        });

        console.log("获取到实体名称：",message.data);
        
        // 通知侧边栏更新显示
        chrome.runtime.sendMessage({
            type: 'UPDATE_ENTITY_NAME',
            data: message.data
        });
    }
});

// 其他后台逻辑...
