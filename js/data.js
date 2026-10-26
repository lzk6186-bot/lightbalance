/* 轻衡 · 本地食物、运动与食谱数据
 * 营养值均为常见食物参考值（每 100g / 100ml），用于日常估算，不替代称重或包装营养标签。
 */
(function () {
  'use strict';

  const FOODS = [
    // ---------- 主食 ----------
    { id: 'rice', name: '米饭', emoji: '🍚', cat: '主食', kcal: 116, p: 2.6, c: 25.9, f: 0.3, serving: 150, servingLabel: '一碗', aliases: ['白米饭', '白饭', '饭'] },
    { id: 'mixed_rice', name: '杂粮饭', emoji: '🍚', cat: '主食', kcal: 110, p: 3.0, c: 23.0, f: 0.5, serving: 150, servingLabel: '一碗', aliases: ['糙米饭', '五谷饭', '粗粮饭'] },
    { id: 'mantou', name: '馒头', emoji: '🍞', cat: '主食', kcal: 223, p: 7.0, c: 47.0, f: 1.1, serving: 100, servingLabel: '一个', aliases: ['白馒头'] },
    { id: 'whole_wheat_bread', name: '全麦面包', emoji: '🍞', cat: '主食', kcal: 246, p: 9.0, c: 41.0, f: 3.5, serving: 35, servingLabel: '一片', aliases: ['吐司', '面包', '全麦吐司'] },
    { id: 'oats', name: '燕麦片（干）', emoji: '🥣', cat: '主食', kcal: 367, p: 15.0, c: 61.0, f: 6.7, serving: 40, servingLabel: '一份', aliases: ['燕麦', '麦片'] },
    { id: 'corn', name: '玉米（煮）', emoji: '🌽', cat: '主食', kcal: 112, p: 4.0, c: 22.8, f: 1.2, serving: 150, servingLabel: '一根', aliases: ['玉米棒', '甜玉米'] },
    { id: 'sweet_potato', name: '红薯（蒸）', emoji: '🍠', cat: '主食', kcal: 86, p: 1.6, c: 20.1, f: 0.1, serving: 200, servingLabel: '一个', aliases: ['地瓜', '番薯'] },
    { id: 'purple_potato', name: '紫薯（蒸）', emoji: '🍠', cat: '主食', kcal: 82, p: 1.8, c: 18.8, f: 0.2, serving: 150, servingLabel: '一个', aliases: ['紫薯'] },
    { id: 'potato', name: '土豆（蒸）', emoji: '🥔', cat: '主食', kcal: 77, p: 2.0, c: 17.0, f: 0.1, serving: 150, servingLabel: '一个', aliases: ['马铃薯', '土豆'] },
    { id: 'noodles', name: '面条（煮）', emoji: '🍜', cat: '主食', kcal: 110, p: 3.9, c: 22.8, f: 0.4, serving: 200, servingLabel: '一碗', aliases: ['挂面', '汤面'] },
    { id: 'congee', name: '白粥', emoji: '🥣', cat: '主食', kcal: 46, p: 1.1, c: 9.9, f: 0.3, serving: 300, servingLabel: '一碗', aliases: ['大米粥', '稀饭'] },
    { id: 'soba', name: '荞麦面（煮）', emoji: '🍜', cat: '主食', kcal: 99, p: 5.0, c: 20.0, f: 0.5, serving: 200, servingLabel: '一碗', aliases: ['荞麦', '荞麦面条'] },
    { id: 'pasta', name: '意面（煮）', emoji: '🍝', cat: '主食', kcal: 157, p: 5.8, c: 30.9, f: 0.9, serving: 180, servingLabel: '一盘', aliases: ['意大利面', '通心粉'] },
    { id: 'yam', name: '山药', emoji: '🥔', cat: '主食', kcal: 57, p: 1.9, c: 12.4, f: 0.2, serving: 150, servingLabel: '一段', aliases: ['淮山'] },
    { id: 'dumplings', name: '猪肉饺子', emoji: '🥟', cat: '主食', kcal: 220, p: 8.0, c: 24.0, f: 10.0, serving: 200, servingLabel: '约10个', aliases: ['饺子', '水饺'] },
    { id: 'baozi', name: '鲜肉包', emoji: '🥟', cat: '主食', kcal: 227, p: 8.0, c: 30.0, f: 8.0, serving: 100, servingLabel: '一个', aliases: ['包子', '肉包'] },
    { id: 'youtiao', name: '油条', emoji: '🥖', cat: '主食', kcal: 388, p: 6.9, c: 51.0, f: 17.6, serving: 60, servingLabel: '一根', aliases: ['油条'] },
    { id: 'fried_rice', name: '蛋炒饭', emoji: '🍛', cat: '主食', kcal: 160, p: 5.0, c: 22.0, f: 6.0, serving: 250, servingLabel: '一盘', aliases: ['炒饭'] },
    { id: 'instant_noodles', name: '方便面', emoji: '🍜', cat: '主食', kcal: 472, p: 9.5, c: 61.0, f: 21.0, serving: 100, servingLabel: '一包', aliases: ['泡面', '方便面'] },

    // ---------- 蛋白质 ----------
    { id: 'egg', name: '鸡蛋', emoji: '🥚', cat: '蛋白', kcal: 144, p: 13.3, c: 2.8, f: 8.8, serving: 50, servingLabel: '一个', aliases: ['水煮蛋', '煎蛋', '蛋'] },
    { id: 'egg_white', name: '鸡蛋白', emoji: '🥚', cat: '蛋白', kcal: 52, p: 10.9, c: 0.7, f: 0.2, serving: 33, servingLabel: '一个', aliases: ['蛋白', '蛋清'] },
    { id: 'chicken_breast', name: '鸡胸肉（熟）', emoji: '🍗', cat: '蛋白', kcal: 165, p: 31.0, c: 0, f: 3.6, serving: 100, servingLabel: '一块', aliases: ['鸡胸', '鸡胸肉'] },
    { id: 'chicken_thigh', name: '鸡腿肉（去皮熟）', emoji: '🍗', cat: '蛋白', kcal: 181, p: 24.0, c: 0, f: 9.0, serving: 100, servingLabel: '一份', aliases: ['鸡腿', '去骨鸡腿'] },
    { id: 'beef_lean', name: '瘦牛肉（熟）', emoji: '🥩', cat: '蛋白', kcal: 187, p: 28.0, c: 0, f: 8.0, serving: 100, servingLabel: '一份', aliases: ['牛肉', '牛里脊', '瘦牛肉'] },
    { id: 'pork_tenderloin', name: '猪里脊（熟）', emoji: '🥩', cat: '蛋白', kcal: 187, p: 27.0, c: 0, f: 8.0, serving: 100, servingLabel: '一份', aliases: ['里脊', '瘦猪肉'] },
    { id: 'salmon', name: '三文鱼', emoji: '🐟', cat: '蛋白', kcal: 208, p: 20.0, c: 0, f: 13.0, serving: 100, servingLabel: '一块', aliases: ['鲑鱼'] },
    { id: 'shrimp', name: '虾仁（熟）', emoji: '🦐', cat: '蛋白', kcal: 99, p: 24.0, c: 0.2, f: 0.3, serving: 100, servingLabel: '一份', aliases: ['虾仁', '基围虾', '虾'] },
    { id: 'tuna', name: '金枪鱼（水浸）', emoji: '🐟', cat: '蛋白', kcal: 116, p: 25.5, c: 0, f: 0.8, serving: 100, servingLabel: '一罐', aliases: ['吞拿鱼', '金枪鱼罐头'] },
    { id: 'tofu_firm', name: '北豆腐', emoji: '🧊', cat: '蛋白', kcal: 98, p: 10.1, c: 3.8, f: 5.3, serving: 150, servingLabel: '半盒', aliases: ['老豆腐', '豆腐'] },
    { id: 'tofu_silken', name: '嫩豆腐', emoji: '🧊', cat: '蛋白', kcal: 57, p: 5.7, c: 2.4, f: 2.7, serving: 150, servingLabel: '半盒', aliases: ['内酯豆腐', '豆腐'] },
    { id: 'soy_milk', name: '无糖豆浆', emoji: '🥛', cat: '蛋白', kcal: 31, p: 3.0, c: 1.2, f: 1.6, serving: 250, servingLabel: '一杯', aliases: ['豆浆', '豆奶'] },
    { id: 'edamame', name: '毛豆（煮）', emoji: '🫛', cat: '蛋白', kcal: 131, p: 13.1, c: 10.5, f: 5.0, serving: 100, servingLabel: '一小碗', aliases: ['毛豆', '枝豆'] },
    { id: 'chickpeas', name: '鹰嘴豆（熟）', emoji: '🫘', cat: '蛋白', kcal: 164, p: 8.9, c: 27.4, f: 2.6, serving: 100, servingLabel: '一小碗', aliases: ['鸡豆', '鹰嘴豆'] },
    { id: 'milk', name: '全脂牛奶', emoji: '🥛', cat: '乳品', kcal: 54, p: 3.0, c: 3.4, f: 3.2, serving: 250, servingLabel: '一杯', aliases: ['牛奶', '纯牛奶'] },
    { id: 'yogurt', name: '无糖酸奶', emoji: '🥣', cat: '乳品', kcal: 63, p: 3.8, c: 4.7, f: 3.0, serving: 150, servingLabel: '一杯', aliases: ['酸奶', '原味酸奶'] },
    { id: 'greek_yogurt', name: '希腊酸奶（无糖）', emoji: '🥣', cat: '乳品', kcal: 97, p: 9.0, c: 3.6, f: 5.0, serving: 150, servingLabel: '一杯', aliases: ['希腊酸奶', '浓缩酸奶'] },
    { id: 'protein_powder', name: '乳清蛋白粉', emoji: '🥤', cat: '蛋白', kcal: 380, p: 75.0, c: 8.0, f: 5.0, serving: 30, servingLabel: '一勺', aliases: ['蛋白粉', '乳清'] },
    { id: 'sea_bass', name: '鲈鱼', emoji: '🐟', cat: '蛋白', kcal: 105, p: 18.6, c: 0, f: 3.4, serving: 200, servingLabel: '一条', aliases: ['鲈鱼', '清蒸鱼'] },

    // ---------- 蔬菜 ----------
    { id: 'broccoli', name: '西兰花', emoji: '🥦', cat: '蔬菜', kcal: 36, p: 2.8, c: 6.6, f: 0.4, serving: 150, servingLabel: '一盘', aliases: ['花椰菜', '绿花菜'] },
    { id: 'spinach', name: '菠菜', emoji: '🥬', cat: '蔬菜', kcal: 28, p: 2.9, c: 3.6, f: 0.4, serving: 150, servingLabel: '一盘', aliases: ['菠菜'] },
    { id: 'lettuce', name: '生菜', emoji: '🥬', cat: '蔬菜', kcal: 15, p: 1.4, c: 2.9, f: 0.2, serving: 100, servingLabel: '一大把', aliases: ['生菜', '球生菜'] },
    { id: 'tomato', name: '番茄', emoji: '🍅', cat: '蔬菜', kcal: 15, p: 0.9, c: 3.9, f: 0.2, serving: 200, servingLabel: '一个', aliases: ['西红柿'] },
    { id: 'cucumber', name: '黄瓜', emoji: '🥒', cat: '蔬菜', kcal: 16, p: 0.7, c: 3.6, f: 0.1, serving: 200, servingLabel: '一根', aliases: ['青瓜'] },
    { id: 'carrot', name: '胡萝卜', emoji: '🥕', cat: '蔬菜', kcal: 39, p: 1.0, c: 9.6, f: 0.2, serving: 100, servingLabel: '一根', aliases: ['红萝卜'] },
    { id: 'mushroom', name: '蘑菇', emoji: '🍄', cat: '蔬菜', kcal: 26, p: 3.1, c: 3.3, f: 0.3, serving: 100, servingLabel: '一份', aliases: ['香菇', '菌菇'] },
    { id: 'bell_pepper', name: '彩椒', emoji: '🫑', cat: '蔬菜', kcal: 22, p: 1.0, c: 5.3, f: 0.2, serving: 100, servingLabel: '一个', aliases: ['甜椒', '灯笼椒'] },
    { id: 'cabbage', name: '大白菜', emoji: '🥬', cat: '蔬菜', kcal: 20, p: 1.5, c: 3.2, f: 0.2, serving: 200, servingLabel: '一盘', aliases: ['白菜', '娃娃菜'] },
    { id: 'asparagus', name: '芦笋', emoji: '🌱', cat: '蔬菜', kcal: 22, p: 2.4, c: 3.9, f: 0.2, serving: 150, servingLabel: '一盘', aliases: ['芦笋'] },
    { id: 'pumpkin', name: '南瓜', emoji: '🎃', cat: '蔬菜', kcal: 23, p: 0.7, c: 5.3, f: 0.1, serving: 200, servingLabel: '一块', aliases: ['贝贝南瓜'] },
    { id: 'lotus_root', name: '莲藕', emoji: '🪷', cat: '蔬菜', kcal: 73, p: 2.6, c: 17.2, f: 0.1, serving: 150, servingLabel: '一盘', aliases: ['藕'] },
    { id: 'okra', name: '秋葵', emoji: '🌿', cat: '蔬菜', kcal: 33, p: 1.9, c: 7.5, f: 0.2, serving: 150, servingLabel: '一盘', aliases: ['秋葵'] },
    { id: 'kelp', name: '海带', emoji: '🌊', cat: '蔬菜', kcal: 13, p: 1.2, c: 2.1, f: 0.1, serving: 100, servingLabel: '一份', aliases: ['海带丝', '昆布'] },
    { id: 'wood_ear', name: '木耳（水发）', emoji: '🍄', cat: '蔬菜', kcal: 27, p: 1.5, c: 6.0, f: 0.2, serving: 100, servingLabel: '一份', aliases: ['黑木耳'] },

    // ---------- 水果 ----------
    { id: 'apple', name: '苹果', emoji: '🍎', cat: '水果', kcal: 53, p: 0.4, c: 13.7, f: 0.2, serving: 200, servingLabel: '一个', aliases: ['苹果'] },
    { id: 'banana', name: '香蕉', emoji: '🍌', cat: '水果', kcal: 93, p: 1.4, c: 22.0, f: 0.2, serving: 120, servingLabel: '一根', aliases: ['香蕉'] },
    { id: 'blueberry', name: '蓝莓', emoji: '🫐', cat: '水果', kcal: 57, p: 0.7, c: 14.5, f: 0.3, serving: 100, servingLabel: '一小盒', aliases: ['蓝莓'] },
    { id: 'strawberry', name: '草莓', emoji: '🍓', cat: '水果', kcal: 32, p: 0.7, c: 7.7, f: 0.3, serving: 150, servingLabel: '一小碗', aliases: ['草莓'] },
    { id: 'orange', name: '橙子', emoji: '🍊', cat: '水果', kcal: 48, p: 0.8, c: 11.8, f: 0.1, serving: 200, servingLabel: '一个', aliases: ['橙子', '橘子', '柑橘'] },
    { id: 'kiwi', name: '猕猴桃', emoji: '🥝', cat: '水果', kcal: 61, p: 1.1, c: 14.5, f: 0.5, serving: 100, servingLabel: '一个', aliases: ['奇异果'] },
    { id: 'watermelon', name: '西瓜', emoji: '🍉', cat: '水果', kcal: 31, p: 0.6, c: 7.6, f: 0.2, serving: 300, servingLabel: '一块', aliases: ['西瓜'] },
    { id: 'pear', name: '梨', emoji: '🍐', cat: '水果', kcal: 51, p: 0.4, c: 13.1, f: 0.1, serving: 200, servingLabel: '一个', aliases: ['雪梨', '梨子'] },
    { id: 'avocado', name: '牛油果', emoji: '🥑', cat: '水果', kcal: 171, p: 2.0, c: 7.4, f: 15.3, serving: 100, servingLabel: '一个', aliases: ['鳄梨'] },
    { id: 'grape', name: '葡萄', emoji: '🍇', cat: '水果', kcal: 69, p: 0.7, c: 18.1, f: 0.2, serving: 150, servingLabel: '一串', aliases: ['提子'] },

    // ---------- 乳品坚果 / 油脂 ----------
    { id: 'almond', name: '杏仁', emoji: '🥜', cat: '坚果', kcal: 579, p: 21.0, c: 21.6, f: 49.9, serving: 15, servingLabel: '一小把', aliases: ['巴旦木', '扁桃仁'] },
    { id: 'walnut', name: '核桃', emoji: '🌰', cat: '坚果', kcal: 646, p: 14.9, c: 13.7, f: 65.2, serving: 15, servingLabel: '一小把', aliases: ['核桃仁'] },
    { id: 'peanut', name: '花生', emoji: '🥜', cat: '坚果', kcal: 574, p: 24.8, c: 21.7, f: 44.3, serving: 15, servingLabel: '一小把', aliases: ['花生米'] },
    { id: 'chia', name: '奇亚籽', emoji: '🌱', cat: '坚果', kcal: 486, p: 16.5, c: 42.0, f: 30.7, serving: 10, servingLabel: '一勺', aliases: ['奇亚籽'] },
    { id: 'peanut_butter', name: '花生酱', emoji: '🥜', cat: '坚果', kcal: 588, p: 25.0, c: 20.0, f: 50.0, serving: 15, servingLabel: '一勺', aliases: ['花生酱'] },
    { id: 'dark_chocolate', name: '黑巧克力（70%）', emoji: '🍫', cat: '零食', kcal: 598, p: 7.8, c: 45.9, f: 42.6, serving: 10, servingLabel: '两小块', aliases: ['黑巧', '巧克力'] },
    { id: 'honey', name: '蜂蜜', emoji: '🍯', cat: '调味', kcal: 321, p: 0.4, c: 82.4, f: 0, serving: 10, servingLabel: '一勺', aliases: ['蜂蜜'] },
    { id: 'olive_oil', name: '橄榄油', emoji: '🫒', cat: '调味', kcal: 899, p: 0, c: 0, f: 99.9, serving: 5, servingLabel: '一勺', aliases: ['食用油', '油'] },
    { id: 'soy_sauce', name: '生抽', emoji: '🥢', cat: '调味', kcal: 63, p: 5.6, c: 10.1, f: 0.1, serving: 10, servingLabel: '一勺', aliases: ['酱油'] },

    // ---------- 常见餐食 / 饮品 ----------
    { id: 'milk_tea', name: '珍珠奶茶（全糖）', emoji: '🧋', cat: '饮品', kcal: 70, p: 0.6, c: 11.0, f: 2.4, serving: 500, servingLabel: '一杯', aliases: ['奶茶', '珍珠奶茶'] },
    { id: 'cola', name: '可乐', emoji: '🥤', cat: '饮品', kcal: 43, p: 0, c: 10.6, f: 0, serving: 330, servingLabel: '一罐', aliases: ['汽水', '可乐'] },
    { id: 'latte', name: '拿铁（全脂）', emoji: '☕', cat: '饮品', kcal: 55, p: 3.0, c: 4.5, f: 3.0, serving: 300, servingLabel: '一杯', aliases: ['拿铁', '咖啡'] },
    { id: 'americano', name: '美式咖啡', emoji: '☕', cat: '饮品', kcal: 2, p: 0.1, c: 0, f: 0, serving: 300, servingLabel: '一杯', aliases: ['美式', '黑咖啡'] },
    { id: 'chips', name: '薯片', emoji: '🥔', cat: '零食', kcal: 536, p: 7.0, c: 53.0, f: 34.6, serving: 50, servingLabel: '一小包', aliases: ['薯片'] },
    { id: 'cake', name: '奶油蛋糕', emoji: '🍰', cat: '零食', kcal: 347, p: 5.0, c: 47.0, f: 16.0, serving: 80, servingLabel: '一块', aliases: ['蛋糕', '甜品'] },
    { id: 'cookie', name: '曲奇饼干', emoji: '🍪', cat: '零食', kcal: 435, p: 5.4, c: 65.0, f: 18.0, serving: 30, servingLabel: '两块', aliases: ['饼干', '曲奇'] },
    { id: 'fried_chicken', name: '炸鸡', emoji: '🍗', cat: '餐食', kcal: 279, p: 22.0, c: 9.0, f: 18.0, serving: 150, servingLabel: '两块', aliases: ['韩式炸鸡', '炸鸡'] },
    { id: 'burger', name: '汉堡', emoji: '🍔', cat: '餐食', kcal: 250, p: 13.0, c: 29.0, f: 10.0, serving: 200, servingLabel: '一个', aliases: ['汉堡包'] },
    { id: 'lanzhou_noodles', name: '兰州牛肉面', emoji: '🍜', cat: '餐食', kcal: 110, p: 6.5, c: 15.0, f: 2.5, serving: 500, servingLabel: '一碗', aliases: ['牛肉面', '拉面'] },
    { id: 'braised_chicken_rice', name: '黄焖鸡米饭', emoji: '🍛', cat: '餐食', kcal: 155, p: 8.0, c: 19.0, f: 5.0, serving: 450, servingLabel: '一份', aliases: ['黄焖鸡'] },
    { id: 'tomato_egg', name: '番茄炒蛋', emoji: '🍳', cat: '餐食', kcal: 100, p: 4.0, c: 3.0, f: 7.0, serving: 200, servingLabel: '一盘', aliases: ['西红柿炒蛋'] },
    { id: 'kungpao_chicken', name: '宫保鸡丁', emoji: '🍲', cat: '餐食', kcal: 180, p: 13.0, c: 8.0, f: 11.0, serving: 200, servingLabel: '一盘', aliases: ['宫保鸡丁'] },
    { id: 'mapo_tofu', name: '麻婆豆腐', emoji: '🍲', cat: '餐食', kcal: 150, p: 8.0, c: 5.0, f: 10.0, serving: 200, servingLabel: '一盘', aliases: ['麻婆豆腐'] },
    { id: 'stir_fried_veg', name: '清炒时蔬', emoji: '🥬', cat: '餐食', kcal: 50, p: 2.0, c: 4.0, f: 3.0, serving: 200, servingLabel: '一盘', aliases: ['炒青菜', '时蔬'] },
    { id: 'chicken_salad', name: '鸡肉沙拉', emoji: '🥗', cat: '餐食', kcal: 90, p: 9.0, c: 5.0, f: 4.0, serving: 250, servingLabel: '一盒', aliases: ['沙拉', '轻食'] },
    { id: 'sandwich', name: '三明治（火腿芝士）', emoji: '🥪', cat: '餐食', kcal: 250, p: 12.0, c: 28.0, f: 10.0, serving: 150, servingLabel: '一个', aliases: ['三明治', '火腿三明治'] },
    { id: 'protein_bar', name: '蛋白棒', emoji: '🍫', cat: '零食', kcal: 380, p: 33.0, c: 30.0, f: 12.0, serving: 40, servingLabel: '一根', aliases: ['能量棒', '蛋白棒'] },
    { id: 'ice_cream', name: '冰淇淋', emoji: '🍨', cat: '零食', kcal: 207, p: 3.5, c: 24.0, f: 11.0, serving: 100, servingLabel: '一杯', aliases: ['雪糕'] }
  ];

  const FOOD_MAP = Object.fromEntries(FOODS.map((food) => [food.id, food]));

  const EXERCISES = [
    { id: 'walk', name: '快走', emoji: '🚶', cat: '有氧', env: 'outdoor', met: { low: 3.0, medium: 4.3, high: 5.5 }, aliases: ['走路', '散步', '健走'] },
    { id: 'jog', name: '慢跑', emoji: '🏃', cat: '有氧', env: 'outdoor', met: { low: 6.0, medium: 7.5, high: 9.8 }, aliases: ['跑步', '跑步'] },
    { id: 'treadmill', name: '跑步机', emoji: '🏃', cat: '有氧', env: 'indoor', met: { low: 6.0, medium: 8.0, high: 10.0 }, aliases: ['跑步机', '室内跑'] },
    { id: 'cycling', name: '骑行', emoji: '🚴', cat: '有氧', env: 'outdoor', met: { low: 4.0, medium: 6.8, high: 10.0 }, aliases: ['自行车', '单车'] },
    { id: 'spinning', name: '动感单车', emoji: '🚴', cat: '有氧', env: 'indoor', met: { low: 5.5, medium: 7.5, high: 10.0 }, aliases: ['飞轮', '室内单车'] },
    { id: 'rope', name: '跳绳', emoji: '🪢', cat: '有氧', env: 'indoor', met: { low: 8.8, medium: 11.0, high: 12.3 }, aliases: ['跳绳'] },
    { id: 'strength', name: '力量训练', emoji: '🏋️', cat: '力量', env: 'indoor', met: { low: 3.0, medium: 5.0, high: 6.0 }, strength: true, aliases: ['撸铁', '器械', '抗阻'] },
    { id: 'bodyweight', name: '自重训练', emoji: '🤸', cat: '力量', env: 'indoor', met: { low: 3.0, medium: 4.5, high: 6.0 }, strength: true, aliases: ['徒手', '俯卧撑', '核心'] },
    { id: 'hiit', name: 'HIIT', emoji: '⚡', cat: '有氧', env: 'indoor', met: { low: 6.0, medium: 8.0, high: 10.0 }, strength: true, aliases: ['高强度间歇', '燃脂操'] },
    { id: 'swim', name: '游泳', emoji: '🏊', cat: '有氧', env: 'indoor', met: { low: 5.0, medium: 6.0, high: 8.0 }, aliases: ['自由泳', '蛙泳'] },
    { id: 'elliptical', name: '椭圆机', emoji: '🏃', cat: '有氧', env: 'indoor', met: { low: 4.5, medium: 5.5, high: 7.0 }, aliases: ['椭圆仪'] },
    { id: 'rowing', name: '划船机', emoji: '🚣', cat: '有氧', env: 'indoor', met: { low: 4.5, medium: 6.0, high: 8.0 }, aliases: ['划船'] },
    { id: 'stairs', name: '爬楼梯', emoji: '🪜', cat: '有氧', env: 'indoor', met: { low: 4.0, medium: 6.0, high: 8.0 }, aliases: ['爬楼', '楼梯'] },
    { id: 'yoga', name: '瑜伽', emoji: '🧘', cat: '轻活动', env: 'indoor', met: { low: 2.0, medium: 2.5, high: 3.0 }, aliases: ['瑜伽'] },
    { id: 'pilates', name: '普拉提', emoji: '🧘', cat: '轻活动', env: 'indoor', met: { low: 2.5, medium: 3.0, high: 4.0 }, aliases: ['普拉提'] },
    { id: 'dance', name: '跳舞', emoji: '💃', cat: '有氧', env: 'indoor', met: { low: 3.5, medium: 5.0, high: 7.0 }, aliases: ['舞蹈', '尊巴'] },
    { id: 'aerobics', name: '跳操', emoji: '🤸', cat: '有氧', env: 'indoor', met: { low: 4.0, medium: 6.0, high: 8.0 }, aliases: ['有氧操', '帕梅拉'] },
    { id: 'badminton', name: '羽毛球', emoji: '🏸', cat: '球类', env: 'indoor', met: { low: 4.5, medium: 5.5, high: 7.0 }, aliases: ['羽毛球'] },
    { id: 'basketball', name: '篮球', emoji: '🏀', cat: '球类', env: 'outdoor', met: { low: 4.5, medium: 6.5, high: 8.0 }, aliases: ['篮球'] },
    { id: 'football', name: '足球', emoji: '⚽', cat: '球类', env: 'outdoor', met: { low: 5.0, medium: 7.0, high: 9.0 }, aliases: ['足球'] },
    { id: 'table_tennis', name: '乒乓球', emoji: '🏓', cat: '球类', env: 'indoor', met: { low: 3.0, medium: 4.0, high: 5.0 }, aliases: ['乒乓球'] },
    { id: 'hike', name: '徒步', emoji: '🥾', cat: '有氧', env: 'outdoor', met: { low: 4.0, medium: 5.5, high: 7.0 }, aliases: ['健行', '远足'] },
    { id: 'mountain', name: '爬山', emoji: '⛰️', cat: '有氧', env: 'outdoor', met: { low: 5.0, medium: 6.5, high: 8.0 }, aliases: ['登山', '爬山'] },
    { id: 'frisbee', name: '飞盘', emoji: '🥏', cat: '球类', env: 'outdoor', met: { low: 3.0, medium: 4.5, high: 6.0 }, aliases: ['飞盘'] },
    { id: 'skating', name: '轮滑', emoji: '⛸️', cat: '有氧', env: 'outdoor', met: { low: 5.0, medium: 6.5, high: 8.0 }, aliases: ['溜冰', '滑板'] },
    { id: 'climbing', name: '室内攀岩', emoji: '🧗', cat: '力量', env: 'indoor', met: { low: 5.0, medium: 6.5, high: 8.0 }, strength: true, aliases: ['攀岩', '抱石'] },
    { id: 'dog_walk', name: '遛狗', emoji: '🐕', cat: '轻活动', env: 'outdoor', met: { low: 2.5, medium: 3.0, high: 3.8 }, aliases: ['遛狗'] },
    { id: 'housework', name: '家务', emoji: '🧹', cat: '轻活动', env: 'indoor', met: { low: 2.0, medium: 2.8, high: 3.5 }, aliases: ['打扫', '家务'] },
    { id: 'stretch', name: '拉伸', emoji: '🤍', cat: '轻活动', env: 'indoor', met: { low: 1.5, medium: 2.0, high: 2.5 }, aliases: ['拉伸', '放松'] }
  ];

  const EXERCISE_MAP = Object.fromEntries(EXERCISES.map((exercise) => [exercise.id, exercise]));

  const RAW_RECIPES = [
    // ---------- 早餐 ----------
    {
      id: 'b_berry_oats', name: '蓝莓酸奶燕麦杯', emoji: '🫐', meal: 'breakfast', minutes: 5,
      badges: ['快手', '免开火'], vegetarian: true,
      ingredients: [['yogurt', 150], ['oats', 30], ['blueberry', 50], ['chia', 5], ['honey', 5]],
      steps: ['燕麦片用少量热水泡软，或提前一晚冷藏浸泡。', '加入无糖酸奶、蓝莓和奇亚籽拌匀。', '最后淋一点蜂蜜；想更饱腹可再加 5g 坚果。'],
      tip: '前一晚装进密封杯，早上拿走就能吃。'
    },
    {
      id: 'b_avocado_egg_toast', name: '牛油果鸡蛋吐司', emoji: '🥑', meal: 'breakfast', minutes: 10,
      badges: ['高蛋白', '快手'], vegetarian: true,
      ingredients: [['whole_wheat_bread', 70], ['egg', 50], ['avocado', 50], ['tomato', 100]],
      steps: ['鸡蛋水煮或煎成溏心蛋。', '全麦面包烤到微脆，铺上切片的牛油果和番茄。', '放上鸡蛋，撒盐和黑胡椒即可。'],
      tip: '牛油果热量不低，半颗刚好，不必整颗都吃完。'
    },
    {
      id: 'b_shrimp_omelette', name: '虾仁蔬菜蛋饼', emoji: '🍤', meal: 'breakfast', minutes: 15,
      badges: ['高蛋白', '一锅出'], vegetarian: false,
      ingredients: [['egg', 100], ['egg_white', 33], ['shrimp', 80], ['bell_pepper', 60], ['olive_oil', 3], ['whole_wheat_bread', 35]],
      steps: ['虾仁解冻，彩椒切丁。', '鸡蛋加蛋白打散，放虾仁和彩椒，加少许盐。', '平底锅刷薄油，倒蛋液小火煎至凝固，对折出锅。', '配一片全麦面包一起吃。'],
      tip: '虾仁换成鸡胸丁也可以，蛋白质一样在线。'
    },
    {
      id: 'b_sweet_potato_plate', name: '红薯鸡蛋早餐盘', emoji: '🍠', meal: 'breakfast', minutes: 20,
      badges: ['饱腹', '高蛋白'], vegetarian: true,
      ingredients: [['sweet_potato', 180], ['egg', 100], ['spinach', 80], ['milk', 150]],
      steps: ['红薯洗净蒸熟，约 15 分钟。', '鸡蛋水煮 8 分钟，捞出过凉水。', '菠菜焯水后拌少许生抽。', '和牛奶一起摆盘即可。'],
      tip: '红薯可以一次蒸好三份，冷藏保存，早餐复热。'
    },
    {
      id: 'b_banana_peanut_oats', name: '香蕉花生酱燕麦粥', emoji: '🍌', meal: 'breakfast', minutes: 8,
      badges: ['快手', '暖胃'], vegetarian: true,
      ingredients: [['oats', 35], ['milk', 200], ['banana', 100], ['peanut_butter', 8], ['chia', 5]],
      steps: ['燕麦和牛奶小火煮 3–5 分钟，搅到浓稠。', '香蕉切片铺在表面。', '舀一小勺花生酱，撒上奇亚籽。'],
      tip: '花生酱很容易超量，用勺子量一下更稳妥。'
    },
    {
      id: 'b_greek_yogurt_bowl', name: '希腊酸奶坚果碗', emoji: '🥣', meal: 'breakfast', minutes: 3,
      badges: ['免开火', '高蛋白'], vegetarian: true,
      ingredients: [['greek_yogurt', 180], ['blueberry', 50], ['almond', 10], ['honey', 5]],
      steps: ['希腊酸奶倒入碗中。', '放上蓝莓和杏仁。', '淋少量蜂蜜即可；怕甜可以不加。'],
      tip: '希腊酸奶蛋白质更高，也更适合做减脂期早餐。'
    },
    {
      id: 'b_tomato_egg_soba', name: '番茄鸡蛋荞麦面', emoji: '🍅', meal: 'breakfast', minutes: 15,
      badges: ['暖胃', '一锅出'], vegetarian: true,
      ingredients: [['soba', 180], ['egg', 50], ['tomato', 150], ['spinach', 50], ['olive_oil', 3]],
      steps: ['荞麦面煮熟捞出；番茄切块。', '锅中少油炒软番茄，加半碗水煮开。', '打入鸡蛋煮成蛋花，放菠菜和面条，调少许盐。'],
      tip: '汤底不用浓汤宝，番茄本身就很鲜。'
    },
    {
      id: 'b_chicken_sandwich', name: '鸡胸全麦三明治', emoji: '🥪', meal: 'breakfast', minutes: 12,
      badges: ['高蛋白', '带得走'], vegetarian: false,
      ingredients: [['whole_wheat_bread', 70], ['chicken_breast', 80], ['lettuce', 30], ['tomato', 50], ['yogurt', 30]],
      steps: ['鸡胸肉煎熟或用水煮熟，切薄片。', '全麦面包两面烤热。', '抹一层无糖酸奶代替沙拉酱，夹入生菜、番茄和鸡胸。', '压紧后对半切开。'],
      tip: '用酸奶替蛋黄酱，能省下不少脂肪和热量。'
    },
    {
      id: 'b_congee_egg', name: '豆浆鸡蛋粥套餐', emoji: '🥣', meal: 'breakfast', minutes: 10,
      badges: ['清淡', '暖胃'], vegetarian: true,
      ingredients: [['congee', 300], ['egg', 50], ['soy_milk', 250], ['spinach', 50]],
      steps: ['白粥加热，菠菜焯水后切段。', '鸡蛋水煮 8 分钟。', '粥里拌入菠菜，配鸡蛋和无糖豆浆。'],
      tip: '白粥升糖较快，搭配鸡蛋和蔬菜会更稳。'
    },
    {
      id: 'b_beef_egg_roll', name: '牛肉鸡蛋全麦卷', emoji: '🌯', meal: 'breakfast', minutes: 15,
      badges: ['高蛋白', '饱腹'], vegetarian: false,
      ingredients: [['whole_wheat_bread', 70], ['beef_lean', 80], ['egg', 50], ['lettuce', 30], ['tomato', 50], ['yogurt', 20]],
      steps: ['牛肉切条，用少许生抽和黑胡椒腌 5 分钟，煎熟。', '鸡蛋煎成蛋皮。', '面包稍微压扁，依次放生菜、番茄、牛肉和蛋皮，卷紧。'],
      tip: '牙签固定一下，带去公司也不会散。'
    },
    {
      id: 'b_big_breakfast', name: '大份红薯鸡胸早餐盘', emoji: '🍳', meal: 'breakfast', minutes: 25,
      badges: ['高蛋白', '大份'], vegetarian: false,
      ingredients: [['sweet_potato', 250], ['chicken_breast', 100], ['egg', 50], ['spinach', 100], ['milk', 200]],
      steps: ['红薯蒸熟；鸡胸用盐和黑胡椒腌好后煎熟。', '鸡蛋水煮，菠菜焯水。', '全部摆盘，配一杯牛奶。'],
      tip: '运动量大的早晨，用这一盘把能量补足。'
    },

    // ---------- 正餐 ----------
    {
      id: 'm_chicken_rice', name: '香煎鸡胸彩蔬饭', emoji: '🍱', meal: 'main', minutes: 25,
      badges: ['高蛋白', '经典'], vegetarian: false,
      ingredients: [['chicken_breast', 130], ['mixed_rice', 100], ['broccoli', 150], ['carrot', 50], ['olive_oil', 4]],
      steps: ['鸡胸横切成薄片，用盐、黑胡椒和少许生抽腌 10 分钟。', '杂粮饭提前煮好；西兰花和胡萝卜焯水。', '平底锅刷薄油，中火把鸡胸两面煎熟。', '全部装盘，按需撒一点黑胡椒。'],
      tip: '鸡胸先拍松再腌，口感会嫩很多。'
    },
    {
      id: 'm_beef_tofu', name: '番茄牛肉豆腐锅', emoji: '🍲', meal: 'main', minutes: 25,
      badges: ['高蛋白', '一锅出'], vegetarian: false,
      ingredients: [['beef_lean', 80], ['tofu_firm', 150], ['tomato', 200], ['cabbage', 100], ['mixed_rice', 100], ['olive_oil', 3]],
      steps: ['牛肉切薄片，番茄切块，豆腐切小方块。', '锅中少油炒软番茄，加入一碗水煮开。', '放豆腐和白菜煮 3 分钟，再下牛肉片滑熟。', '加少许盐和生抽，配杂粮饭吃。'],
      tip: '牛肉最后放，煮到变色就关火，才不会柴。'
    },
    {
      id: 'm_salmon_salad', name: '香煎三文鱼牛油果沙拉', emoji: '🥗', meal: 'main', minutes: 20,
      badges: ['高蛋白', '好脂肪'], vegetarian: false,
      ingredients: [['salmon', 100], ['avocado', 50], ['lettuce', 80], ['tomato', 100], ['whole_wheat_bread', 35], ['olive_oil', 3]],
      steps: ['三文鱼用厨房纸吸干，撒盐和黑胡椒。', '平底锅少油，鱼皮朝下煎 3–4 分钟，翻面再煎 2 分钟。', '生菜、番茄、牛油果装碗，放上三文鱼。', '全麦面包烤脆，掰块加入；用柠檬汁和少许橄榄油调味。'],
      tip: '牛油果提供饱腹感，但半颗就够，不用额外加沙拉酱。'
    },
    {
      id: 'm_shrimp_pasta', name: '虾仁西兰花意面', emoji: '🍝', meal: 'main', minutes: 20,
      badges: ['高蛋白', '快手'], vegetarian: false,
      ingredients: [['shrimp', 120], ['pasta', 150], ['broccoli', 150], ['olive_oil', 4]],
      steps: ['意面按包装时间煮到八分熟，留半碗面汤。', '西兰花焯水，虾仁用盐和黑胡椒抓匀。', '锅中放橄榄油，炒香虾仁，加入西兰花和意面。', '倒少许面汤翻匀，用盐和黑胡椒调味。'],
      tip: '用煮面水乳化酱汁，不用奶油也能挂汁。'
    },
    {
      id: 'm_chicken_thigh_rice', name: '香菇鸡腿杂粮饭', emoji: '🍗', meal: 'main', minutes: 30,
      badges: ['饱腹', '一锅出'], vegetarian: false,
      ingredients: [['chicken_thigh', 120], ['mixed_rice', 120], ['mushroom', 100], ['carrot', 50], ['olive_oil', 4], ['soy_sauce', 5]],
      steps: ['去皮鸡腿肉切块，香菇切片，胡萝卜切丁。', '锅中少油炒香鸡肉，加入香菇和胡萝卜。', '加生抽和小半碗水，盖盖焖 8 分钟。', '收汁后盖在杂粮饭上。'],
      tip: '鸡腿去皮后再做，脂肪会少一截，口感仍然嫩。'
    },
    {
      id: 'm_beef_soba', name: '彩椒牛肉荞麦面', emoji: '🥩', meal: 'main', minutes: 20,
      badges: ['高蛋白', '一锅出'], vegetarian: false,
      ingredients: [['beef_lean', 100], ['soba', 180], ['bell_pepper', 100], ['broccoli', 100], ['olive_oil', 4]],
      steps: ['荞麦面煮熟过凉水；牛肉切细条，用生抽腌 5 分钟。', '锅中少油快速滑炒牛肉，变色后盛出。', '原锅炒彩椒和西兰花，加入面条和牛肉。', '淋一点生抽，拌匀出锅。'],
      tip: '牛肉别久炒，变色就盛出，最后回锅拌一下。'
    },
    {
      id: 'm_steamed_fish', name: '清蒸鲈鱼配双蔬', emoji: '🐟', meal: 'main', minutes: 25,
      badges: ['高蛋白', '清淡'], vegetarian: false,
      ingredients: [['sea_bass', 180], ['mixed_rice', 100], ['broccoli', 150], ['carrot', 50], ['olive_oil', 3]],
      steps: ['鲈鱼处理干净，抹少许盐，鱼身放姜片。', '水开后上锅蒸 8–10 分钟，关火焖 2 分钟。', '西兰花和胡萝卜焯水，杂粮饭盛好。', '鱼出锅后淋少许生抽和热油，配蔬菜和饭。'],
      tip: '蒸鱼的时间按大小调整，筷子能轻松戳透就好。'
    },
    {
      id: 'm_chicken_wrap', name: '鸡肉蔬菜全麦卷', emoji: '🌯', meal: 'main', minutes: 15,
      badges: ['高蛋白', '带得走'], vegetarian: false,
      ingredients: [['whole_wheat_bread', 70], ['chicken_breast', 100], ['lettuce', 40], ['tomato', 100], ['greek_yogurt', 40]],
      steps: ['鸡胸煎熟切条；生菜洗净沥干，番茄切片。', '全麦面包稍微压扁，抹希腊酸奶。', '铺上生菜、番茄和鸡胸，卷紧后用牙签固定。'],
      tip: '蔬菜一定沥干，卷起来才不会湿软。'
    },
    {
      id: 'm_shrimp_tofu', name: '番茄虾仁豆腐煲', emoji: '🍤', meal: 'main', minutes: 22,
      badges: ['高蛋白', '一锅出'], vegetarian: false,
      ingredients: [['shrimp', 100], ['tofu_silken', 200], ['tomato', 200], ['mixed_rice', 100], ['olive_oil', 3]],
      steps: ['番茄切块，嫩豆腐切大块。', '锅中少油炒软番茄，加一碗水煮开。', '轻轻放入豆腐，煮 3 分钟后加虾仁。', '虾仁变红后加盐调味，配米饭。'],
      tip: '嫩豆腐下锅后别频繁翻动，晃锅就好。'
    },
    {
      id: 'm_chickpea_bowl', name: '鹰嘴豆南瓜能量碗', emoji: '🥙', meal: 'main', minutes: 25,
      badges: ['蛋奶素', '高纤维'], vegetarian: true,
      ingredients: [['chickpeas', 150], ['pumpkin', 200], ['mixed_rice', 80], ['broccoli', 100], ['olive_oil', 4], ['greek_yogurt', 30]],
      steps: ['南瓜切块，和鹰嘴豆一起拌少许橄榄油、盐和黑胡椒。', '烤箱 200℃ 烤 15 分钟，或平底锅煎熟。', '西兰花焯水，杂粮饭盛碗。', '把烤好的南瓜鹰嘴豆放上去，淋希腊酸奶。'],
      tip: '素食餐也能有 20g 以上蛋白质，关键是豆类和酸奶搭配。'
    },
    {
      id: 'm_tofu_rice', name: '香煎豆腐时蔬饭', emoji: '🍱', meal: 'main', minutes: 20,
      badges: ['蛋奶素', '快手'], vegetarian: true,
      ingredients: [['tofu_firm', 200], ['mixed_rice', 100], ['bell_pepper', 100], ['broccoli', 100], ['olive_oil', 5], ['soy_sauce', 5]],
      steps: ['北豆腐压去水分，切厚片。', '平底锅刷油，把豆腐两面煎到金黄。', '加入彩椒和西兰花翻炒，淋少许生抽。', '配杂粮饭装盘。'],
      tip: '豆腐先用厨房纸压一压，煎的时候不容易碎。'
    },
    {
      id: 'm_beef_potato', name: '牛肉土豆能量碗', emoji: '🥩', meal: 'main', minutes: 25,
      badges: ['高蛋白', '饱腹'], vegetarian: false,
      ingredients: [['beef_lean', 100], ['potato', 180], ['broccoli', 100], ['greek_yogurt', 50], ['olive_oil', 4]],
      steps: ['土豆切块蒸熟；西兰花焯水。', '牛肉切条，用盐和黑胡椒腌 5 分钟。', '锅中少油快速炒熟牛肉。', '全部装碗，淋上用柠檬汁和盐调过的希腊酸奶。'],
      tip: '土豆放凉一点再吃，饱腹感会更好。'
    },
    {
      id: 'm_big_chicken_bowl', name: '大份鸡胸糙米碗', emoji: '🍚', meal: 'main', minutes: 25,
      badges: ['高蛋白', '大份'], vegetarian: false,
      ingredients: [['chicken_breast', 150], ['mixed_rice', 150], ['broccoli', 150], ['corn', 80], ['olive_oil', 5]],
      steps: ['鸡胸腌制后煎熟，静置 3 分钟再切片。', '杂粮饭盛碗，西兰花焯水，玉米煮熟。', '把鸡胸、蔬菜和玉米码在饭上。', '淋少许生抽或黑胡椒即可。'],
      tip: '训练日或食量较大时，用它补足碳水和蛋白质。'
    },
    {
      id: 'm_shrimp_egg_rice', name: '虾仁滑蛋饭', emoji: '🍳', meal: 'main', minutes: 18,
      badges: ['高蛋白', '快手'], vegetarian: false,
      ingredients: [['shrimp', 100], ['egg', 100], ['mixed_rice', 120], ['tomato', 100], ['olive_oil', 3]],
      steps: ['虾仁用盐和黑胡椒腌一下，番茄切块。', '锅中少油炒虾仁至变色，盛出。', '蛋液加少许水打散，倒入锅中滑至半凝固，加入虾仁。', '番茄切片配饭，把滑蛋盖上去。'],
      tip: '蛋液里加一勺水，炒出来更嫩，也不用多放油。'
    },
    {
      id: 'm_mushroom_tofu_noodles', name: '菌菇豆腐荞麦面', emoji: '🍄', meal: 'main', minutes: 20,
      badges: ['蛋奶素', '暖胃'], vegetarian: true,
      ingredients: [['tofu_firm', 150], ['soba', 180], ['mushroom', 100], ['spinach', 80], ['olive_oil', 4]],
      steps: ['荞麦面煮熟捞出；豆腐切块，蘑菇切片。', '锅中少油炒香蘑菇，加一碗水煮开。', '放豆腐煮 3 分钟，再放菠菜和面条。', '加盐和少许生抽调味。'],
      tip: '菌菇先炒香再加水，汤底会更鲜。'
    },
    {
      id: 'm_tomato_egg_tofu_rice', name: '番茄滑蛋豆腐饭', emoji: '🍅', meal: 'main', minutes: 20,
      badges: ['蛋奶素', '高蛋白'], vegetarian: true,
      ingredients: [['egg', 100], ['tofu_firm', 150], ['tomato', 200], ['mixed_rice', 100], ['olive_oil', 3]],
      steps: ['番茄切块，豆腐切小方块，鸡蛋打散。', '锅中少油炒软番茄，加少量水煮开。', '放豆腐煮 2 分钟，淋入蛋液，凝固后轻轻推散。', '加盐调味，配杂粮饭。'],
      tip: '鸡蛋和豆腐一起，素食也能吃到 30g 蛋白质。'
    },
    {
      id: 'm_double_protein_rice', name: '牛肉鸡胸双拼饭', emoji: '🍱', meal: 'main', minutes: 30,
      badges: ['高蛋白', '大份'], vegetarian: false,
      ingredients: [['beef_lean', 80], ['chicken_breast', 100], ['mixed_rice', 180], ['broccoli', 150], ['olive_oil', 5]],
      steps: ['鸡胸和牛肉分别用盐、黑胡椒腌 10 分钟。', '平底锅少油，先煎鸡胸至熟，再快速煎牛肉。', '杂粮饭和焯水西兰花装盘。', '两种肉切片码好，淋少许生抽。'],
      tip: '蛋白质很足，适合力量训练后的正餐。'
    },

    // ---------- 加餐 ----------
    {
      id: 's_greek_berry', name: '希腊酸奶莓果杯', emoji: '🫐', meal: 'snack', minutes: 3,
      badges: ['高蛋白', '免开火'], vegetarian: true,
      ingredients: [['greek_yogurt', 100], ['blueberry', 50], ['oats', 10]],
      steps: ['希腊酸奶倒进杯子。', '铺上蓝莓和燕麦片即可。'],
      tip: '下午四点左右吃，晚餐不容易饿过头。'
    },
    {
      id: 's_apple_peanut', name: '苹果花生酱', emoji: '🍎', meal: 'snack', minutes: 2,
      badges: ['快手', '免开火'], vegetarian: true,
      ingredients: [['apple', 150], ['peanut_butter', 10]],
      steps: ['苹果洗净切块。', '蘸一小勺花生酱吃。'],
      tip: '花生酱用量控制在 10g 左右，热量不低但很抗饿。'
    },
    {
      id: 's_banana_almond', name: '香蕉杏仁', emoji: '🍌', meal: 'snack', minutes: 1,
      badges: ['免开火', '带得走'], vegetarian: true,
      ingredients: [['banana', 100], ['almond', 8]],
      steps: ['香蕉剥皮，搭配杏仁即可。'],
      tip: '运动前 30 分钟吃，补能量刚刚好。'
    },
    {
      id: 's_milk_toast', name: '牛奶全麦吐司', emoji: '🥛', meal: 'snack', minutes: 3,
      badges: ['快手', '饱腹'], vegetarian: true,
      ingredients: [['milk', 200], ['whole_wheat_bread', 35]],
      steps: ['全麦吐司烤热。', '配一杯温牛奶。'],
      tip: '晚上饿了，用它替代饼干和蛋糕。'
    },
    {
      id: 's_edamame', name: '毛豆小食', emoji: '🫛', meal: 'snack', minutes: 8,
      badges: ['高蛋白', '高纤维'], vegetarian: true,
      ingredients: [['edamame', 150]],
      steps: ['毛豆洗净，水开后煮 5–6 分钟。', '捞出沥干，撒一点盐即可。'],
      tip: '毛豆是很适合减脂期的咸口零食。'
    },
    {
      id: 's_protein_milk', name: '蛋白香蕉奶昔', emoji: '🥤', meal: 'snack', minutes: 3,
      badges: ['高蛋白', '训练后'], vegetarian: true,
      ingredients: [['protein_powder', 15], ['milk', 200], ['banana', 50]],
      steps: ['香蕉切段。', '和牛奶、蛋白粉一起放进料理机打匀。', '没有料理机就摇摇杯摇匀，香蕉直接吃。'],
      tip: '力量训练后补一份，帮助把蛋白质吃够。'
    },
    {
      id: 's_dark_choc', name: '黑巧蓝莓核桃', emoji: '🍫', meal: 'snack', minutes: 1,
      badges: ['免开火', '小份'], vegetarian: true,
      ingredients: [['dark_chocolate', 10], ['blueberry', 60], ['walnut', 5]],
      steps: ['黑巧克力掰成小块。', '和蓝莓、核桃一起装小碟。'],
      tip: '想吃甜的时候，用一份有边界的组合替代整包零食。'
    },
    {
      id: 's_yogurt_banana_nuts', name: '酸奶香蕉坚果碗', emoji: '🥣', meal: 'snack', minutes: 4,
      badges: ['高蛋白', '大份'], vegetarian: true,
      ingredients: [['greek_yogurt', 150], ['banana', 120], ['walnut', 10], ['honey', 5]],
      steps: ['香蕉切片。', '希腊酸奶装碗，铺香蕉和核桃，淋蜂蜜。'],
      tip: '食量大或运动后，用它补足剩余预算。'
    }
  ];

  const RECIPES = RAW_RECIPES.map((recipe) => {
    let kcal = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    let grams = 0;
    const ingredients = recipe.ingredients.map(([foodId, amount]) => {
      const food = FOOD_MAP[foodId];
      if (!food) {
        throw new Error('未知食谱食材: ' + foodId);
      }
      const factor = amount / 100;
      kcal += food.kcal * factor;
      protein += food.p * factor;
      carbs += food.c * factor;
      fat += food.f * factor;
      grams += amount;
      return { foodId, amount, name: food.name, emoji: food.emoji };
    });
    const badges = recipe.badges.slice();
    if (protein >= 25 && !badges.includes('高蛋白')) {
      badges.push('高蛋白');
    }
    return {
      ...recipe,
      ingredients,
      grams,
      kcal: Math.round(kcal),
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fat: Math.round(fat * 10) / 10,
      badges,
      highProtein: protein >= 25 || (protein * 4) / Math.max(kcal, 1) >= 0.28
    };
  });

  const RECIPE_MAP = Object.fromEntries(RECIPES.map((recipe) => [recipe.id, recipe]));

  const MEALS = [
    { id: 'breakfast', name: '早餐', emoji: '🌅' },
    { id: 'lunch', name: '午餐', emoji: '☀️' },
    { id: 'dinner', name: '晚餐', emoji: '🌆' },
    { id: 'snack', name: '加餐', emoji: '🍎' }
  ];

  const MEAL_MAP = Object.fromEntries(MEALS.map((meal) => [meal.id, meal]));

  window.LB_DATA = {
    FOODS,
    FOOD_MAP,
    EXERCISES,
    EXERCISE_MAP,
    RECIPES,
    RECIPE_MAP,
    MEALS,
    MEAL_MAP
  };
})();
