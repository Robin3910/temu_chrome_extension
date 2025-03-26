// 监听页面变化的观察器
const observer = new MutationObserver(() => {
    if (window.location.href.includes('order-manage-custom')) {
        const entityNameElement = document.querySelector('.account-info_entityName__kct3g');
        if (entityNameElement) {
            const entityName = entityNameElement.textContent.trim();
            // 将数据发送到背景脚本
            chrome.runtime.sendMessage({
                type: 'ENTITY_NAME_FOUND',
                data: entityName
            });
            
            // 停止观察（如果不需要继续监听）
            observer.disconnect();
        }
    }
});

// 开始观察
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// 页面加载完成后也检查一次
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.href.includes('order-manage-custom')) {
        const entityNameElement = document.querySelector('.account-info_entityName__kct3g');
        console.log("获取到店铺DIV：",entityNameElement);
        if (entityNameElement) {
            const entityName = entityNameElement.textContent.trim();
            chrome.runtime.sendMessage({
                type: 'ENTITY_NAME_FOUND',
                data: entityName
            });
        }
    }
});

// 监听来自扩展的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'COLLECT_SHOP_ID') {
        try {
            collectShopId();
            sendResponse({ success: true });
        } catch (error) {
            console.error('收集店铺ID时出错:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true; // 保持消息通道开启
    }
});

// 添加收集店铺ID的功能
function collectShopId() {
    // 点击账户信息区域
    const accountInfoDiv = document.querySelector('.account-info_accountInfo__wc0kw');
    if (accountInfoDiv) {
        accountInfoDiv.click();
        
        // 等待一小段时间后获取店铺名称（因为可能需要等待UI更新）
        setTimeout(() => {
            const entityNameElement = document.querySelector('.account-info_entityName__kct3g');
            console.log("获取到店铺DIV：",entityNameElement);
            if (entityNameElement) {
                const entityName = entityNameElement.textContent.trim();
                chrome.runtime.sendMessage({
                    type: 'ENTITY_NAME_FOUND',
                    data: entityName
                });
                console.log('已收集店铺ID:', entityName);
            } else {
                console.log('未找到店铺ID元素');
                throw new Error('未找到店铺ID元素');
            }
        }, 500); // 500ms 延迟
    } else {
        console.log('未找到账户信息元素');
        throw new Error('未找到账户信息元素');
    }
}

// 通知背景脚本内容脚本已加载
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_LOADED' });

