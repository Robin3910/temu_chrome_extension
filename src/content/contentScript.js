// 添加统一的日志函数
function log(...args) {
    console.log('[订单采集]', ...args);
    window.postMessage({
        type: 'FROM_CONTENT_SCRIPT',
        text: args
    }, '*');
}

// 监听来自扩展的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 收集店铺ID和待发货订单
    if (message.type === 'COLLECT_ORDERS') {
        try {
            collectShopId();
            collectOrders();
            sendResponse({ success: true });
        } catch (error) {
            log('收集店铺ID时出错:', error);
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
            log("获取到店铺DIV：", entityNameElement);
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
                log('已收集店铺信息:', { entityName, shopName });
            } else {
                log('未找到店铺ID元素');
                throw new Error('未找到店铺ID元素');
            }
        }, 500); // 500ms 延迟
    } else {
        log('未找到账户信息元素');
        throw new Error('未找到账户信息元素');
    }
}

// 添加收集订单的功能
async function collectOrders() {
    try {
        // 等待表格数据加载
        setTimeout(() => {
            const orders = parseOrdersFromTable();
            // 发送订单数据到后台存储
            chrome.runtime.sendMessage({
                type: 'SAVE_ORDERS',
                data: orders
            });
        }, 1000);

    } catch (error) {
        log('收集订单失败:', error);
        throw error;
    }
}

// 解析表格中的订单数据
function parseOrdersFromTable() {
    const orders = [];
    const tbody = document.querySelector('tbody[data-testid="beast-core-table-middle-tbody"]');
    if (!tbody) return orders;

    log('获取到表格数据：', tbody);

    let currentOrder = null;
    let currentSkus = [];

    // 遍历所有行
    tbody.querySelectorAll('tr').forEach(tr => {
        // 检查是否是新订单的开始（通过订单号判断）
        const orderIdCell = tr.querySelector('td[style*="left: 36px"]');
        log('获取到订单ID：', orderIdCell);
        if (orderIdCell) {
            // 如果已有当前订单，保存它
            if (currentOrder) {
                currentOrder.skus = currentSkus;
                orders.push(currentOrder);
                currentSkus = [];
            }

            // 解析订单基本信息
            const orderInfo = parseOrderInfo(orderIdCell);
            currentOrder = {
                orderId: orderInfo.orderId,
                creationType: orderInfo.creationType,
                warehouseGroup: orderInfo.warehouseGroup,
                status: '待发货',
                creationTime: orderInfo.creationTime,
                shippingDeadline: orderInfo.shippingDeadline,
                deliveryDeadline: orderInfo.deliveryDeadline,
                shippingInfo: {
                    shippingTime: '-',
                    shippingNumber: '-',
                    receivingTime: '-',
                    actualWarehouse: '-'
                }
            };
        }

        // 解析SKU信息
        const skuCell = tr.querySelector('.sku-info_skuInfo__Y46cz');
        if (skuCell && currentOrder) {
            const skuInfo = parseSkuInfo(skuCell);
            currentSkus.push(skuInfo);
            log('获取到SKU信息：', skuInfo);
        }
        log('获取到当前订单：', currentOrder);
    });

    // 保存最后一个订单
    if (currentOrder) {
        currentOrder.skus = currentSkus;
        orders.push(currentOrder);
    }

    log('收集到的订单数据：', JSON.stringify(orders));

    return orders;
}

// 解析订单基本信息
function parseOrderInfo(cell) {
    const orderText = cell.textContent;
    const orderIdMatch = orderText.match(/WB\d+/);
    const creationTimeCell = cell.closest('tr').querySelector('td:nth-child(8)');
    const deadlines = parseDeadlines(cell);

    return {
        orderId: orderIdMatch ? orderIdMatch[0] : '',
        creationType: '系统创建',
        warehouseGroup: '广东仓组1',
        creationTime: creationTimeCell ? creationTimeCell.textContent.trim() : '',
        shippingDeadline: deadlines.shipping,
        deliveryDeadline: deadlines.delivery
    };
}

// 解析截止时间
function parseDeadlines(cell) {
    const deadlineTexts = cell.querySelectorAll('.order-status-tag_item__Qpx\\+a');
    let shipping = '';
    let delivery = '';

    deadlineTexts.forEach(text => {
        const content = text.textContent;
        if (content.includes('需') && content.includes('前发货')) {
            shipping = content.match(/(\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)[0];
        } else if (content.includes('需') && content.includes('前到货')) {
            delivery = content.match(/(\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)[0];
        }
    });

    return { shipping, delivery };
}

// 解析SKU信息
function parseSkuInfo(cell) {
    const titleElement = cell.querySelector('.sku-info_title__DXMN7');
    const skuIdElement = cell.querySelector('div:nth-child(2)');
    const customSkuElement = cell.querySelector('div:nth-child(3)');
    const priceElement = cell.closest('tr').querySelector('td:nth-child(6)');
    const quantityElement = cell.closest('tr').querySelector('td:nth-child(7)');

    return {
        property: titleElement ? titleElement.textContent.replace('属性：', '').trim() : '',
        skuId: skuIdElement ? skuIdElement.textContent.replace('SKU ID：', '').trim() : '',
        customSku: customSkuElement ? customSkuElement.textContent.replace('定制SKU：', '').trim() : '',
        price: priceElement ? parseFloat(priceElement.textContent.replace(/[^0-9.]/g, '')) : 0,
        quantity: quantityElement ? parseInt(quantityElement.textContent) : 0,
        processStatus: '0/0',
        processType: '单一工艺'
    };
}


