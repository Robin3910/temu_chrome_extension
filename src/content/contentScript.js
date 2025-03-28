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
            log('收集订单时出错:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true; // 保持消息通道开启
    }

    // 收集定制图片
    if (message.type === 'COLLECT_ORDER_IMAGES') {
        try {
            collectOrderImages();
            sendResponse({ success: true });
        } catch (error) {
            log('收集定制图片时出错:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true; // 保持消息通道开启
    }
});

// 添加延时函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


// 添加等待元素出现的函数
async function waitForElement(selector, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
        await delay(100); // 每100ms检查一次
    }
    
    // 超时返回null
    log(`等待元素 ${selector} 超时`);
    return null;
}

// 添加收集店铺ID的功能
function collectShopId() {
    // 点击账户信息区域
    const accountInfoDiv = document.querySelector('.account-info_accountInfo__wc0kw');
    if (accountInfoDiv) {
        accountInfoDiv.click();
        
        // 等待一小段时间后获取店铺名称（因为可能需要等待UI更新）
        setTimeout(() => {
            const entityNameElement = document.querySelector('.account-info_entityName__kct3g');
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
        // 1. 点击分页器选择器
        const pageSizeSelector = document.querySelector('ul[data-testid="beast-core-pagination"] li:nth-child(2) div');
        if (!pageSizeSelector) {
            throw new Error('未找到分页选择器');
        }
        log('找到分页选择器，准备点击');
        pageSizeSelector.click();

        // 2. 等待下拉列表出现
        await delay(1000);
        
        // 3. 选择100条选项
        const listbox = document.querySelector('ul[role="listbox"]');
        if (!listbox) {
            throw new Error('未找到分页选项列表');
        }

        const items = listbox.querySelectorAll('li');
        const option100 = Array.from(items).find(item => 
            item.textContent.includes('100')
        );
        
        if (!option100) {
            throw new Error('未找到100条/页选项');
        }

        log('找到100条/页选项，准备点击');
        option100.click();

        // 4. 等待表格重新加载
        await delay(1000);

        // 解析表格数据
        const orders = parseOrdersFromTable();

        await redirectToSellerCenter();
        
        chrome.runtime.sendMessage({
            type: 'SAVE_ORDERS',
            data: orders
        });

    } catch (error) {
        log('收集订单失败:', error);
        throw error;
    }
}


// 收集订单图片
async function collectOrderImages() {
    // 获取表格数据
    const tbody = await waitForElement('tbody[data-testid="beast-core-table-middle-tbody"] tr', 20000);
    if (!tbody) {
        throw new Error('未找到定制内容表格');
    }

    // 存储订单图片数据
    const orderImages = [];

    // 遍历表格行
    const rows = tbody.querySelectorAll('tr');
    for (const row of rows) {
        // 获取订单ID
        const orderIdCell = row.querySelector('td:nth-child(4)');
        const orderIdText = orderIdCell?.querySelector('span')?.textContent;
        
        if (!orderIdText) continue;

        const orderImageData = {
            orderId: orderIdText,
            images: [],
            customText: ''
        };

        // 获取文字定制内容
        const customTextCell = row.querySelector('td:nth-child(11) > div > div > div');
        const styleTag = customTextCell?.querySelector('style');
        if (styleTag) {
            styleTag.remove();
        }
        const customText = customTextCell?.textContent?.trim() || '';
        
        // 将文字定制内容添加到订单数据中
        orderImageData.customText = customText;

        // 获取目标图片预览元素
        const previewDivs = row.querySelectorAll('td:nth-child(12) > div > div > div');
        for (const previewDiv of previewDivs) { // 改用 for...of 循环以支持 await
            previewDiv.click();
            // 等待大图元素出现
            const modalImage = await waitForElement('img[data-testid="beast-core-preview-img"]', 5000);
            if (modalImage) {
                orderImageData.images.push(modalImage.src);
                
                // 关闭预览模态框
                const closeButton = document.querySelector('div[data-testid="beast-core-modal-container"] > div > div > div:nth-child(2)');
                if (closeButton) {
                    closeButton.click();
                }
            }
        }
        log('收集到订单图片:', orderImageData);
        
        if (orderImageData.images.length > 0) {
            orderImages.push(orderImageData);
        }
    }

    // 发送图片数据到后台存储
    chrome.runtime.sendMessage({
        type: 'SAVE_ORDER_IMAGES',
        data: orderImages
    });

    return orderImages;
}

// 跳转到sellerCenter页面
async function redirectToSellerCenter() {
        const headerCheckbox = document.querySelector('thead tr th span input');
        if (!headerCheckbox) {
            throw new Error('未找到表头复选框');
        }
        log('找到表头复选框，准备点击');
        headerCheckbox.click();

        await delay(500);

        const batchViewButton = Array.from(document.querySelectorAll('button span')).find(
            span => span.textContent.trim() === '批量去查看定制内容'
        );
        
        if (!batchViewButton) {
            throw new Error('未找到批量查看按钮');
        }
        log('找到批量查看按钮，准备点击');
        batchViewButton.click();

        // 等待页面更新
        await delay(1000);
        // 跳转到新的页面进行收集

        const redirectButton = Array.from(document.querySelectorAll('button span')).find(
            span => span.textContent.trim() === '跳转到agentseller查看'
        );
        
        if (!redirectButton) {
            throw new Error('未找到跳转按钮');
        }
        log('找到跳转按钮，准备点击');
        redirectButton.click();

        // 等待页面更新
        await delay(1000);

        // 使用更精确的选择器找到全球按钮
        const sellerCenterButton = Array.from(document.querySelectorAll('div')).find(
            div => div.textContent.trim() === '除欧区、美国'
        );
        // 或者通过文本内容查找
        // const sellerCenterButton = Array.from(document.querySelectorAll('button')).find(
        //     button => button.textContent.includes('除欧区、美国')
        // );
        
        if (!sellerCenterButton) {
            throw new Error('未找到sellerCenter按钮');
        }
        log('找到[sellerCenter]按钮，准备点击');
        sellerCenterButton.click();

        // 等待页面更新
        await delay(10000);

        // TODO: 实现图片收集逻辑
        return [];
}

// 解析表格中的订单数据
function parseOrdersFromTable() {
    const orders = [];
    const tbody = document.querySelector('tbody[data-testid="beast-core-table-middle-tbody"]');
    log('执行抓取');
    if (!tbody) return orders;

    log('获取到表格数据');

    let currentOrder = null;
    let currentSkus = [];

    // 遍历所有行
    tbody.querySelectorAll('tr').forEach(tr => {
        // 跳过偶数行
        if (Array.from(tbody.querySelectorAll('tr')).indexOf(tr) % 2 === 1) {
            return;
        }

        // 检查是否是新订单的开始（通过订单号判断）
        const orderIdCell = tr.querySelector('td:nth-child(2)');
        log('获取到订单ID');
        if (orderIdCell) {
            // 如果已有当前订单，保存它
            if (currentOrder) {
                currentOrder.skus = currentSkus;
                orders.push(currentOrder);
                currentSkus = [];
            }

            // 解析订单基本信息
            const orderInfo = parseOrderInfo(orderIdCell);
            // 获取状态信息
            const statusDiv = tr.querySelector('td:nth-child(4)');
            const status = statusDiv ? statusDiv.textContent.trim() : '待发货';
            orderInfo.status = status;

            // 获取订单创建时间
            const creationTimeDiv = tr.querySelector('td:nth-child(9)');
            orderInfo.creationTime = creationTimeDiv ? creationTimeDiv.textContent.trim() : '-';

            currentOrder = {
                orderId: orderInfo.orderId,
                creationType: orderInfo.creationType,
                warehouseGroup: orderInfo.warehouseGroup,
                status: orderInfo.status,
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
        const skuCell = tr.querySelector('.sku-info_contentInfo__6n9hH');
        if (skuCell && currentOrder) {
            const skuInfo = parseSkuInfo(skuCell);
            currentSkus.push(skuInfo);
            log('获取到SKU信息：', JSON.stringify(skuInfo));
        }
        log('获取到当前订单：', JSON.stringify(currentOrder));
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
    // "WB2503282286588系统创建广东仓组1含缺货/售罄SKU1履约考核中72h需03-30 07:59:50前发货38小时8分后逾期需04-02 07:59:50前到货110小时8分后逾期"
    const orderText = cell.textContent;
    const orderIdMatch = orderText.match(/WB\d+/);
    const deadlines = parseDeadlines(cell);

    return {
        orderId: orderIdMatch ? orderIdMatch[0] : '',
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
    };
}


