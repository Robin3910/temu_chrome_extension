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
                
                // 获取店铺名称
                const shopNameElement = document.querySelector('span[data-testid="beast-core-icon"] span');
                const shopName = shopNameElement ? shopNameElement.textContent.trim() : '';
                
                chrome.runtime.sendMessage({
                    type: 'ENTITY_NAME_FOUND',
                    data: {
                        entityName: entityName,
                        shopName: shopName
                    }
                });
                console.log('已收集店铺信息:', { entityName, shopName });
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

// 添加收集订单ID的功能
async function collectOrderIds() {
    try {
        // 使用更精确的选择器查找"定制品备货建议"的div
        const customStockDiv = document.querySelector('.index-module__tabWrapper___2-i0y div:first-child');
        
        if (!customStockDiv || customStockDiv.textContent.trim() !== '定制品备货建议') {
            throw new Error('未找到"定制品备货建议"按钮');
        }

        console.log('找到定制品备货建议按钮:', customStockDiv);
        customStockDiv.click();
        
        // 通知后台脚本已经点击
        chrome.runtime.sendMessage({
            type: 'CUSTOM_STOCK_CLICKED',
            data: { status: 'clicked' }
        });

    } catch (error) {
        console.error('收集订单ID失败:', error);
        throw error;
    }
}


