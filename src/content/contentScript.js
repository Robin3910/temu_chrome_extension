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
            collectShopId();
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

// 点击元素的通用方法
async function clickElement(selector, timeout = 5000, description = '') {
    const element = await waitForElement(selector, timeout);
    if (!element) {
        const errorMsg = description ? `未找到${description}元素` : `未找到元素: ${selector}`;
        throw new Error(errorMsg);
    }
    log(description ? `找到[${description}]元素，准备点击` : `找到元素 ${selector}，准备点击`);
    element.click();
    return element;
}


// 添加收集店铺ID的功能
async function collectShopId() {
    // 点击账户信息区域
    const accountInfoDiv = document.querySelector('div[class*="account-info_accountInfo"]');
    if (accountInfoDiv) {
        accountInfoDiv.click();

        await delay(1000);
        const entityNameElement = document.querySelector('div[class*="account-info_entityName"]');
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
    } else {
        log('未找到账户信息元素');
        throw new Error('未找到账户信息元素');
    }
}

// 点击分页器选择器
async function clickPagination(cssSelector, pageSize) {
    // 1. 点击分页器选择器
    const pageSizeSelector = document.querySelector(cssSelector);
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
        item.textContent.includes(pageSize)
    );
    
    if (!option100) {
        throw new Error(`未找到${pageSize}条/页选项`);
    }

    log(`找到${pageSize}条/页选项，准备点击`);
    option100.click();

    // 4. 等待表格重新加载
    await delay(1000);
    return;
}

// 添加收集订单的功能
async function collectOrders() {
    try {

        await clickPagination('ul[data-testid="beast-core-pagination"] li:nth-child(2) div', '100');

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
    const is_loaded = await waitForElement('tbody[data-testid="beast-core-table-middle-tbody"] tr', 10000);
    if (!is_loaded) {
        throw new Error('未找到定制内容表格');
    }

    await clickPagination('ul[data-testid="beast-core-pagination"] li:nth-child(2) div', '200');

    await delay(1000);

    const tbody = document.querySelector('tbody[data-testid="beast-core-table-middle-tbody"]');

    // 存储订单图片数据
    const orderImages = [];

    // 获取的订单图片文字数据，key是td元素数量，value是定制区域内容和图片预览的index
    const index_obj = {
        // 15的是订单的第一个tr
        15: {
            custom_text_index: 11,
            image_index: 12,
        },
        // 4的是后面的tr
        4: {
            custom_text_index: 2,
            image_index: 3,
        }
    }

    // 遍历表格行
    // 如果tr里面只有4个td，则表示是多个定制区域，要以该订单的第一个tr为准
    // 第一个td里面有rowspan，rowspan的值就是当前订单的定制区域数量

    let orderIdText = "";
    let customSkuText = "";
    let orderImageData = {
        orderId: "",
        customSkuId: "",
        images: [],
        customTexts: []
    };
    const rows = tbody.querySelectorAll('tr');
    for (const row of rows) {
        // 如果td_length大于15，则表示这是订单的第一个tr
        const td_length = row.querySelectorAll('td').length;
        // 获取到当前的index obj
        const cur_index_obj = index_obj[td_length];

        if (td_length == 15) {
            // 只有在不是第一个tr时才push之前收集的数据
            if (orderImageData.orderId) {
                orderImages.push(orderImageData);
            }
            // 识别到是订单的第一个tr，重置所有信息
            orderImageData = {
                orderId: "",
                customSkuId: "",
                images: [],
                customTexts: []
            };
            // 第一行有订单信息
            // 获取订单ID
            const orderIdCell = row.querySelector('td:nth-child(4)');
            orderIdText = orderIdCell?.querySelector('span')?.textContent;
            
            // 获取定制SKU号
            const customSkuCell = row.querySelector('td:nth-child(5)');
            customSkuText = customSkuCell.textContent;
            orderImageData.customSkuId = customSkuText;
            orderImageData.orderId = orderIdText;
        }
      
        // 获取文字定制内容
        const customTextCell = row.querySelector(`td:nth-child(${cur_index_obj.custom_text_index}) > div > div > div > div`);
        const styleTag = customTextCell?.querySelector('style');
        if (styleTag) {
            styleTag.remove();
        }
        const customText = customTextCell?.textContent?.trim() || '';
        
        // 将文字定制内容添加到订单数据中
        orderImageData.customTexts.push(customText);

        // 获取目标图片预览元素
        const previewDivs = row.querySelectorAll(`td:nth-child(${cur_index_obj.image_index}) > div > div > div`);
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
        log('收集到订单图片文字信息:', orderImageData);
        // orderImages.push(orderImageData);
        
    }                

    // 最后一个tr的数据也需要push到orderImages
    if (orderImageData.orderId) {
        orderImages.push(orderImageData);
    }

    // 发送图片数据到后台存储
    chrome.runtime.sendMessage({
        type: 'SAVE_ORDER_IMAGES',
        data: orderImages
    });
    log('收集到的订单图片数据：', orderImages);

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

    let orderIdInfo = null; // 记录当前订单的订单号等信息，可能存在一个订单号对应多个产品
    let title = "";

    // 根据td元素数量来判断订单信息的位置，key是td元素数量，value是订单信息的位置
    const index_obj = {
        11: {
            orderIdCell_index: 2,
            sku_td_index: 5,
            price_td_index: 6,
            quantity_td_index: 7,
            creationTime_td_index: 9
        },
        9: {
            orderIdCell_index: 1,
            sku_td_index: 3,
            price_td_index: 4,
            quantity_td_index: 5,
            creationTime_td_index: 7
        },
        4: {
            orderIdCell_index: 0, // 0代表没有orderIdCell
            sku_td_index: 1,
            price_td_index: 2,
            quantity_td_index: 3,
            creationTime_td_index: 0 // 0代表没有creationTime_td
        }
    }

    // 遍历所有行
    tbody.querySelectorAll('tr').forEach(async tr => {
        // 如果tr里面有11个td，则是一个备货单号中，第一个订单。如果该备货单号中有多个订单，则后续的订单中不会有orderIdCell
        // 所以需要记录一个备货单号中的第一个订单，方便后续进行整合处理
        // 整理后有以下几种情况：
        // 1、一个备货单号中只有一个订单，则直接获取
        // 2、一个备货单号中有多个订单，则遍历到tr为【合计】时，进行统筹处理
        // 3、有的tr还有【查看全部】，则需要点开【查看全部】进行获取
        
        // 获取tr中的所有td元素
        const tdElements = tr.querySelectorAll('td');
        const cur_index_obj = index_obj[tdElements.length];

        // 如果判断到了合计，需要统筹一下前面的订单
        // 检查第一个td是否为"合计"，重置一下orderIdInfo
        const firstTd = tdElements[0];
        if (firstTd && firstTd.textContent.trim() === '合计') {
            log('检测到合计行,重置orderIdInfo');
            // 如果有当前订单信息,将其添加到orders数组
            if (orderIdInfo) {
                // 重置当前订单信息和SKU列表
                orderIdInfo = null;
            }
            return;
        }

        // 如果判断到了查看全部，需要点开【查看全部】进行获取
        // TODO 逻辑还未经过验证
        if (firstTd && firstTd.textContent.trim().includes('查看全部')) {
            log('检测到查看全部，准备点击');
            const button = firstTd.querySelector('a');
            // return;
            if (button) {
                button.click();
                await delay(1000);
                const lookup_orders = await lookupAllOrders();
                lookup_orders.forEach(lookup_order => {
                    // 检查是否已存在相同的定制SKU ID
                    const existingOrder = orders.find(o => o.skus.customSkuId === lookup_order.customSkuId);
                    if (!existingOrder) {
                        let currentOrder = null;
                        currentOrder = JSON.parse(JSON.stringify(orderIdInfo));
                        // 解析SKU信息
                        let skuInfo = {
                            customSkuId: lookup_order.customSkuId,
                        }
                
                        currentOrder.skus = skuInfo;
                        currentOrder.price = lookup_order.price;
                        currentOrder.quantity = lookup_order.quantity;
                        currentOrder.status = '待发货';
                
                        log('获取到当前订单：', JSON.stringify(currentOrder));
                        orders.push(currentOrder);
                    }
                });
            }
            return;
        }

        // 判断td元素数量是否为11个，若是，则是整个table的第一行
        if (tdElements.length == 11 || tdElements.length == 9) {
            log('记录到备货单号中的第一个订单');
            // 检查是否是新订单的开始（通过订单号判断）
            const cell_index = cur_index_obj.orderIdCell_index;
            const orderIdCell = tr.querySelector(`td:nth-child(${cell_index})`);
            log('获取到订单ID');
            if (orderIdCell) {
                // 解析订单基本信息
                const orderInfo = parseOrderInfo(orderIdCell);
                if (tdElements.length == 11) {
                    // 识别到第一个tr之后会更新title
                    const title_cell = tr.querySelector(`td:nth-child(3) > div > div > div:nth-child(3)`);
                    title = title_cell ? title_cell.textContent.trim() : '';
                }
                orderIdInfo = {
                    orderId: orderInfo.orderId,
                    title: title,
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
            // 获取订单创建时间
            const creationTimeDiv = tr.querySelector(`td:nth-child(${cur_index_obj.creationTime_td_index})`);
            const creationTime = creationTimeDiv ? creationTimeDiv.textContent.trim() : '-';
            orderIdInfo.creationTime = creationTime;
        }

        // 获取状态信息
        const status = '待发货';

        const priceElement = tr.querySelector(`td:nth-child(${cur_index_obj.price_td_index})`);
        const quantityElement = tr.querySelector(`td:nth-child(${cur_index_obj.quantity_td_index})`);

        const price = priceElement ? parseFloat(priceElement.textContent.replace(/[^0-9.]/g, '')) : 0;
        const quantity = quantityElement ? parseInt(quantityElement.textContent) : 0;

        let currentOrder = null;

        currentOrder = JSON.parse(JSON.stringify(orderIdInfo));

        // 解析SKU信息
        let skuInfo = null;
        // sku的位置需要根据tdElements.length来判断
        let sku_td_index = cur_index_obj.sku_td_index;

        const skuCell = tr.querySelector(`td:nth-child(${sku_td_index}) > div > div > div:nth-child(2)`);
        skuInfo = parseSkuInfo(skuCell);
        log('获取到SKU信息：', JSON.stringify(skuInfo));

        currentOrder.skus = skuInfo;
        currentOrder.price = price;
        currentOrder.quantity = quantity;
        currentOrder.status = status;

        log('获取到当前订单：', JSON.stringify(currentOrder));
        orders.push(currentOrder);
    });

    log('收集到的订单数据：', orders);

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
        deliveryDeadline: deadlines.delivery,
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
    const titleElement = cell.querySelector('div:nth-child(1)');
    const skuIdElement = cell.querySelector('div:nth-child(2)');
    const customSkuElement = cell.querySelector('div:nth-child(3)');


    return {
        property: titleElement ? titleElement.textContent.replace('属性：', '').trim() : '',
        skuId: skuIdElement ? skuIdElement.textContent.replace('SKU ID：', '').trim() : '',
        customSku: customSkuElement ? customSkuElement.textContent.replace('定制SKU：', '').trim() : '',
    };
}

// 解析查看更多全部数据
async function lookupAllOrders() {
    const tr_list = await waitForElement('div[data-testid="beast-core-drawer-content"] tbody[data-testid="beast-core-table-middle-tbody"]', 20000);

    await clickPagination('div[data-testid="beast-core-drawer-content"] ul[data-testid="beast-core-pagination"] li:nth-child(2) div', '40');

    await delay(1000);

    const orderIdCell = document.querySelector('div[data-testid="beast-core-drawer-content"] > div > div:nth-child(2) > div > div:nth-child(2)');
    const orders = [];
    let orderId = '';
    if (orderIdCell) {
        // 订单ID的文本内容："备货单号: WB2503291450067"
        orderId = orderIdCell.textContent.trim().match(/WB\d+/)?.[0] || '';
        log('获取到订单ID：', orderId);
    }

    for (const tr of tr_list) {
        const custom_id_cell = tr.querySelector('td:nth-child(1) > div > div > div:nth-child(2) > div:nth-child(2)');
        // 定制SKU_ID的文本内容："定制SKU_ID: 1234567890"
        const custom_sku_id = custom_id_cell ? custom_id_cell.textContent.trim().match(/SKU ID:\s*(\d+)/)?.[1] || '' : '';

        const property_cell = tr.querySelector('td:nth-child(1) > div > div > div:nth-child(2) > div:nth-child(2)');
        // 属性的文本内容："属性：8in"
        const property = property_cell ? property_cell.textContent.trim().match(/属性：\s*(.+)/)?.[1] || '' : '';
        // 获取数量和价格
        const quantityCell = tr.querySelector('td:nth-child(2)');
        const priceCell = tr.querySelector('td:nth-child(3)');
        const quantity = quantityCell ? quantityCell.textContent.trim() : '';
        const price = priceCell ? priceCell.textContent.trim() : '';
        const orderInfo = {
            orderId: orderId,
            customSkuId: custom_sku_id,
            property: property,
            quantity: quantity,
            price: price
        }
        orders.push(orderInfo);
    }

    // 关闭抽屉弹窗
    await clickElement('body svg', 5000, '关闭抽屉弹窗');
    return orders;
}
