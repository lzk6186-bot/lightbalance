/* =========================================================
   轻衡 · LIGHTBALANCE
   A local-first, mobile-first calorie ledger.
   ========================================================= */
(function () {
  'use strict';

  const {
    FOODS,
    FOOD_MAP,
    EXERCISES,
    EXERCISE_MAP,
    RECIPES,
    RECIPE_MAP,
    MEALS,
    MEAL_MAP
  } = window.LB_DATA;

  const STORAGE_KEY = 'lightbalance.state.v1';
  const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
  const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const ACTIVITY = {
    sedentary: { label: '久坐为主', factor: 1.2, desc: '办公室 / 居家，日常走动较少' },
    light: { label: '时常走动', factor: 1.3, desc: '通勤、家务，每天有一些活动' },
    active: { label: '活动较多', factor: 1.4, desc: '走动频繁或从事体力工作' }
  };
  const PACES = [
    { value: 0.25, label: '轻缓', desc: '每周约 0.25 kg' },
    { value: 0.5, label: '稳步', desc: '每周约 0.5 kg' },
    { value: 0.75, label: '进取', desc: '每周约 0.75 kg' }
  ];
  const INTENSITY = {
    low: { label: '轻松', short: '低', factor: 0.5, metKey: 'low' },
    medium: { label: '适中', short: '中', factor: 1, metKey: 'medium' },
    high: { label: '高强度', short: '高', factor: 2, metKey: 'high' }
  };
  const DIETS = [
    { id: 'balanced', label: '均衡' },
    { id: 'highProtein', label: '高蛋白' },
    { id: 'vegetarian', label: '蛋奶素' }
  ];
  const FOOD_CATEGORIES = [
    { id: '全部', label: '全部' },
    { id: '主食', label: '主食' },
    { id: '蛋白', label: '肉蛋豆' },
    { id: '蔬果', label: '蔬果' },
    { id: '奶坚果', label: '奶坚果' },
    { id: '餐食', label: '餐食饮品' },
    { id: '我的', label: '我的食物' }
  ];
  const EXERCISE_CATEGORIES = [
    { id: '常做', label: '常做' },
    { id: '有氧', label: '有氧' },
    { id: '力量', label: '力量' },
    { id: '球类', label: '球类' },
    { id: '轻活动', label: '轻活动' },
    { id: '全部', label: '全部' }
  ];
  const COMMON_EXERCISES = new Set([
    'walk', 'jog', 'strength', 'yoga', 'cycling', 'rope', 'hiit', 'swim',
    'badminton', 'stairs', 'elliptical', 'housework'
  ]);

  const state = {
    data: blankState(),
    view: 'intake',
    sheetOpen: false,
    sheetCloseTimer: null,
    toastTimer: null,
    lastFocus: null,
    activeSheet: null,
    storageAvailable: true
  };

  let onboardingDraft = null;
  let deferredInstallPrompt = null;

  // ---------------- Utilities ----------------

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $$(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value, digits = 0) {
    const factor = Math.pow(10, digits);
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function finite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeParseInt(value) {
    const n = parseInt(String(value), 10);
    return Number.isFinite(n) ? n : NaN;
  }

  function fmtInt(value) {
    const n = Math.round(finite(value));
    return n.toLocaleString('zh-CN');
  }

  function fmtAmount(value) {
    const n = round(finite(value), 1);
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function signed(value, digits = 0) {
    const n = round(finite(value), digits);
    if (n > 0) return '+' + (digits ? n.toFixed(digits) : String(n));
    if (n < 0) return '−' + Math.abs(digits ? n.toFixed(digits) : n);
    return digits ? (0).toFixed(digits) : '0';
  }

  function signedWithCommas(value) {
    const n = Math.round(finite(value));
    if (n > 0) return '+' + n.toLocaleString('zh-CN');
    if (n < 0) return '−' + Math.abs(n).toLocaleString('zh-CN');
    return '0';
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function icon(name, className = '') {
    return `<svg class="icon${className ? ' ' + className : ''}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  function uid(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return prefix + '-' + window.crypto.randomUUID();
    }
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function dateKey(date = new Date()) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function parseDateKey(key) {
    const parts = String(key).split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function addDays(date, amount) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  function startOfWeek(date = new Date()) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);
    return start;
  }

  function dateLabel(date = new Date()) {
    const weekday = WEEK_LABELS[(date.getDay() + 6) % 7];
    return `${date.getMonth() + 1}月${date.getDate()}日 · ${weekday}`;
  }

  function greeting(date = new Date()) {
    const hour = date.getHours();
    if (hour < 5) return '夜深了';
    if (hour < 9) return '早上好';
    if (hour < 12) return '上午好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  }

  function nowTime() {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function defaultMealForNow(date = new Date()) {
    const hour = date.getHours() + date.getMinutes() / 60;
    if (hour < 4.5) return 'snack';
    if (hour < 10.5) return 'breakfast';
    if (hour < 15) return 'lunch';
    if (hour < 17) return 'snack';
    if (hour < 21) return 'dinner';
    return 'snack';
  }

  function normalizeMeal(meal) {
    return MEAL_ORDER.includes(meal) ? meal : defaultMealForNow();
  }

  function findMealName(meal) {
    return MEAL_MAP[meal] ? MEAL_MAP[meal].name : '加餐';
  }

  function bmiInfo(weight, height) {
    const w = finite(weight);
    const h = finite(height) / 100;
    const bmi = h > 0 ? w / (h * h) : 0;
    let label = '—';
    let tone = 'normal';
    if (bmi > 0 && bmi < 18.5) {
      label = '偏瘦';
      tone = 'low';
    } else if (bmi < 24) {
      label = '正常';
      tone = 'normal';
    } else if (bmi < 28) {
      label = '偏重';
      tone = 'high';
    } else if (bmi > 0) {
      label = '肥胖';
      tone = 'high';
    }
    return { value: round(bmi, 1), label, tone };
  }

  function exerciseKcal(exercise, minutes, intensity, weight) {
    const met = exercise.met[INTENSITY[intensity] ? INTENSITY[intensity].metKey : 'medium'] || exercise.met.medium;
    return Math.max(1, Math.round((met * 3.5 * finite(weight)) / 200 * finite(minutes)));
  }

  // ---------------- Date / state ----------------

  function blankState() {
    return {
      version: 1,
      profile: null,
      weights: [],
      days: {},
      customFoods: []
    };
  }

  function normalizeProfile(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const sex = raw.sex === 'male' ? 'male' : raw.sex === 'female' ? 'female' : null;
    const age = Number(raw.age);
    const height = Number(raw.height);
    const currentWeight = Number(raw.currentWeight);
    const targetWeight = Number(raw.targetWeight);
    if (!sex || !Number.isFinite(age) || age < 18 || age > 90) return null;
    if (!Number.isFinite(height) || height < 120 || height > 230) return null;
    if (!Number.isFinite(currentWeight) || currentWeight < 30 || currentWeight > 300) return null;
    if (!Number.isFinite(targetWeight) || targetWeight < 30 || targetWeight > 300) return null;
    return {
      sex,
      age,
      height,
      currentWeight,
      targetWeight,
      activity: ACTIVITY[raw.activity] ? raw.activity : 'sedentary',
      pace: [0.25, 0.5, 0.75].includes(Number(raw.pace)) ? Number(raw.pace) : 0.5,
      diet: DIETS.some((item) => item.id === raw.diet) ? raw.diet : 'balanced',
      dailyMinutes: clamp(Math.round(finite(raw.dailyMinutes, 30)), 5, 180),
      weeklyMinutes: clamp(Math.round(finite(raw.weeklyMinutes, 150)), 30, 1200),
      strengthGoal: clamp(Math.round(finite(raw.strengthGoal, 2)), 0, 7),
      createdAt: raw.createdAt || new Date().toISOString()
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== 'object') return blankState();
    const normalized = blankState();
    const profile = normalizeProfile(raw.profile);
    if (!profile) return normalized;
    normalized.profile = profile;

    if (Array.isArray(raw.weights)) {
      normalized.weights = raw.weights
        .filter((item) => item && parseDateKey(item.date) && Number.isFinite(Number(item.kg)))
        .map((item) => ({ date: String(item.date), kg: clamp(Number(item.kg), 30, 300) }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
    if (!normalized.weights.length) {
      normalized.weights.push({ date: dateKey(), kg: profile.currentWeight });
    }

    if (raw.days && typeof raw.days === 'object') {
      Object.keys(raw.days).forEach((key) => {
        const source = raw.days[key];
        if (!source || typeof source !== 'object' || !parseDateKey(key)) return;
        const foods = Array.isArray(source.foods)
          ? source.foods.filter((entry) => {
              if (!entry || !entry.name || !entry.base || !MEAL_MAP[entry.meal]) return false;
              return Number.isFinite(Number(entry.base.kcal));
            }).map((entry) => ({
              id: entry.id || uid('food'),
              name: String(entry.name),
              emoji: entry.emoji || '🍽️',
              source: ['food', 'recipe', 'quick'].includes(entry.source) ? entry.source : 'quick',
              meal: entry.meal,
              qty: Math.max(0, finite(entry.qty, 1)),
              unit: entry.unit === '份' ? '份' : 'g',
              base: {
                kcal: Math.max(0, finite(entry.base.kcal)),
                p: Math.max(0, finite(entry.base.p)),
                c: Math.max(0, finite(entry.base.c)),
                f: Math.max(0, finite(entry.base.f))
              },
              foodId: entry.foodId || null,
              recipeId: entry.recipeId || null,
              time: entry.time || ''
            }))
          : [];
        const exercises = Array.isArray(source.exercises)
          ? source.exercises.filter((entry) => entry && EXERCISE_MAP[entry.exerciseId]).map((entry) => ({
              id: entry.id || uid('ex'),
              exerciseId: entry.exerciseId,
              name: entry.name || EXERCISE_MAP[entry.exerciseId].name,
              emoji: entry.emoji || EXERCISE_MAP[entry.exerciseId].emoji,
              env: entry.env === 'outdoor' ? 'outdoor' : 'indoor',
              minutes: clamp(finite(entry.minutes, 1), 1, 1440),
              intensity: INTENSITY[entry.intensity] ? entry.intensity : 'medium',
              kcal: Math.max(0, Math.round(finite(entry.kcal))),
              source: entry.source === 'watch' ? 'watch' : 'estimate',
              strength: Boolean(entry.strength),
              time: entry.time || ''
            }))
          : [];
        normalized.days[key] = {
          foods,
          exercises,
          planVariant: Math.max(0, Math.round(finite(source.planVariant, 0)))
        };
      });
    }

    if (Array.isArray(raw.customFoods)) {
      normalized.customFoods = raw.customFoods
        .filter((food) => food && food.name && Number.isFinite(Number(food.kcal)))
        .map((food) => ({
          id: food.id || uid('custom'),
          name: String(food.name),
          emoji: food.emoji || '🍽️',
          cat: '我的',
          kcal: Math.max(0, finite(food.kcal)),
          p: Math.max(0, finite(food.p)),
          c: Math.max(0, finite(food.c)),
          f: Math.max(0, finite(food.f)),
          serving: clamp(finite(food.serving, 100), 1, 2000),
          servingLabel: food.servingLabel || '一份',
          aliases: []
        }));
    }
    return normalized;
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return blankState();
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      state.storageAvailable = false;
      return blankState();
    }
  }

  function saveState() {
    if (!state.storageAvailable) return false;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
      return true;
    } catch (error) {
      state.storageAvailable = false;
      showToast('浏览器存储不可用，本次记录可能无法保存');
      return false;
    }
  }

  function getDay(key = dateKey(), create = false) {
    if (!state.data.days[key]) {
      if (!create) return { foods: [], exercises: [], planVariant: 0 };
      state.data.days[key] = { foods: [], exercises: [], planVariant: 0 };
    }
    const day = state.data.days[key];
    if (!Array.isArray(day.foods)) day.foods = [];
    if (!Array.isArray(day.exercises)) day.exercises = [];
    if (!Number.isFinite(day.planVariant)) day.planVariant = 0;
    return day;
  }

  function allFoods() {
    return FOODS.concat(state.data.customFoods || []);
  }

  function findFood(foodId) {
    return FOOD_MAP[foodId] || (state.data.customFoods || []).find((food) => food.id === foodId) || null;
  }

  function findFoodEntry(entryId) {
    for (const key of Object.keys(state.data.days)) {
      const day = state.data.days[key];
      if (!day || !Array.isArray(day.foods)) continue;
      const entry = day.foods.find((item) => item.id === entryId);
      if (entry) return { entry, day, key };
    }
    return null;
  }

  function findExerciseEntry(entryId) {
    for (const key of Object.keys(state.data.days)) {
      const day = state.data.days[key];
      if (!day || !Array.isArray(day.exercises)) continue;
      const entry = day.exercises.find((item) => item.id === entryId);
      if (entry) return { entry, day, key };
    }
    return null;
  }

  function entryNutrition(entry) {
    const base = entry.base || {};
    const factor = entry.unit === '份' ? finite(entry.qty, 1) : finite(entry.qty, 0) / 100;
    return {
      kcal: Math.max(0, finite(base.kcal) * factor),
      p: Math.max(0, finite(base.p) * factor),
      c: Math.max(0, finite(base.c) * factor),
      f: Math.max(0, finite(base.f) * factor)
    };
  }

  function sumEntries(entries) {
    return entries.reduce((total, entry) => {
      const nutrition = entryNutrition(entry);
      total.kcal += nutrition.kcal;
      total.p += nutrition.p;
      total.c += nutrition.c;
      total.f += nutrition.f;
      return total;
    }, { kcal: 0, p: 0, c: 0, f: 0 });
  }

  function getMealEntries(day, meal) {
    return (day.foods || []).filter((entry) => entry.meal === meal);
  }

  // ---------------- Energy model ----------------

  function calcEnergy(profile, exerciseKcalValue = 0) {
    if (!profile) {
      return {
        bmr: 0, baseline: 0, rawDeficit: 0, deficit: 0, budget: 0,
        floor: 1200, capped: false, unsafe: true, projectedWeekly: 0
      };
    }
    const sexOffset = profile.sex === 'male' ? 5 : -161;
    const bmr = 10 * profile.currentWeight + 6.25 * profile.height - 5 * profile.age + sexOffset;
    const factor = ACTIVITY[profile.activity] ? ACTIVITY[profile.activity].factor : 1.2;
    const baseline = Math.round(bmr * factor);
    const floor = profile.sex === 'male' ? 1500 : 1200;
    const rawDeficit = Math.round((profile.pace * 7700) / 7 / 5) * 5;
    const floorRoom = Math.max(0, baseline - floor);
    const safeCap = Math.floor(Math.min(750, floorRoom) / 5) * 5;
    const deficit = Math.max(0, Math.min(rawDeficit, safeCap));
    const exercise = Math.max(0, finite(exerciseKcalValue));
    const budget = Math.max(0, Math.round(baseline + exercise - deficit));
    return {
      bmr: Math.round(bmr),
      baseline,
      rawDeficit,
      deficit,
      budget,
      floor,
      safeCap,
      capped: rawDeficit > deficit,
      unsafe: floorRoom < 100 || baseline < 1200,
      projectedWeekly: (deficit * 7) / 7700,
      exercise
    };
  }

  function macroTargets(budget, weight) {
    const protein = clamp(Math.round(finite(weight) * 1.4), 50, 180);
    const fat = clamp(Math.round((finite(budget) * 0.28) / 9), 30, 130);
    const carbs = Math.max(40, Math.round((finite(budget) - protein * 4 - fat * 9) / 4));
    return { protein, fat, carbs };
  }

  function getStats(key = dateKey()) {
    const day = getDay(key, false);
    const foods = day.foods || [];
    const exercises = day.exercises || [];
    const consumed = sumEntries(foods);
    const exerciseKcalTotal = exercises.reduce((sum, entry) => sum + Math.max(0, finite(entry.kcal)), 0);
    const energy = calcEnergy(state.data.profile, exerciseKcalTotal);
    const targets = macroTargets(energy.budget, state.data.profile ? state.data.profile.currentWeight : 60);
    const mainMealsLogged = ['breakfast', 'lunch', 'dinner'].filter((meal) => foods.some((entry) => entry.meal === meal));
    const missingMainMeals = ['breakfast', 'lunch', 'dinner'].filter((meal) => !mainMealsLogged.includes(meal));
    return {
      key,
      day,
      foods,
      exercises,
      consumed,
      consumedKcal: Math.round(consumed.kcal),
      exerciseKcal: Math.round(exerciseKcalTotal),
      burn: energy.baseline + Math.round(exerciseKcalTotal),
      baseline: energy.baseline,
      targetDeficit: energy.deficit,
      budget: energy.budget,
      remainingBudget: energy.budget - Math.round(consumed.kcal),
      actualDeficit: energy.baseline + Math.round(exerciseKcalTotal) - Math.round(consumed.kcal),
      targets,
      hasFood: foods.length > 0,
      hasExercise: exercises.length > 0,
      mainMealsLogged: mainMealsLogged.length,
      missingMainMeals,
      energy
    };
  }

  function getDeficitStatus(stats) {
    if (!stats.hasFood) {
      return { tone: 'muted', label: '等待记录', need: 0, excess: 0 };
    }
    if (stats.consumedKcal > stats.burn) {
      return { tone: 'over', label: '今日盈余', need: 0, excess: 0, surplus: stats.consumedKcal - stats.burn };
    }
    const difference = stats.actualDeficit - stats.targetDeficit;
    if (difference < -75) {
      return { tone: 'low', label: '还差 ' + fmtInt(Math.abs(difference)), need: Math.abs(difference), excess: 0 };
    }
    if (difference > 150) {
      return { tone: 'high', label: '偏大 ' + fmtInt(difference), need: 0, excess: difference };
    }
    return { tone: 'good', label: '接近目标', need: 0, excess: 0 };
  }

  function getWeeklyExerciseStats() {
    const now = new Date();
    const start = startOfWeek(now);
    const end = addDays(start, 7);
    const today = dateKey(now);
    let equivalence = 0;
    let minutes = 0;
    let strength = 0;
    let outdoorMinutes = 0;
    let indoorMinutes = 0;
    let outdoorKcal = 0;
    let indoorKcal = 0;

    Object.keys(state.data.days).forEach((key) => {
      const date = parseDateKey(key);
      if (!date || date < start || date >= end || key > today) return;
      const day = state.data.days[key];
      (day.exercises || []).forEach((entry) => {
        const mins = Math.max(0, finite(entry.minutes));
        const factor = INTENSITY[entry.intensity] ? INTENSITY[entry.intensity].factor : 1;
        minutes += mins;
        equivalence += mins * factor;
        if (entry.strength && mins >= 10) strength += 1;
        if (entry.env === 'outdoor') {
          outdoorMinutes += mins;
          outdoorKcal += Math.max(0, finite(entry.kcal));
        } else {
          indoorMinutes += mins;
          indoorKcal += Math.max(0, finite(entry.kcal));
        }
      });
    });

    return {
      start,
      minutes: Math.round(minutes),
      equivalence: Math.round(equivalence),
      strength,
      outdoorMinutes: Math.round(outdoorMinutes),
      indoorMinutes: Math.round(indoorMinutes),
      outdoorKcal: Math.round(outdoorKcal),
      indoorKcal: Math.round(indoorKcal)
    };
  }

  function getRecentFoodIds(limit = 7) {
    const keys = Object.keys(state.data.days).sort().reverse();
    const ids = [];
    for (const key of keys) {
      const day = state.data.days[key];
      const entries = (day.foods || []).slice().sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
      for (const entry of entries) {
        if (entry.source !== 'food' || !entry.foodId) continue;
        if (ids.includes(entry.foodId)) continue;
        ids.push(entry.foodId);
        if (ids.length >= limit) return ids;
      }
    }
    return ids;
  }

  // ---------------- Visual portion estimation ----------------

  function visualPortionProfile(food) {
    if (food.cat === '蛋白' && /鸡蛋|鸡蛋白/.test(food.name)) {
      return {
        icon: '🥚',
        refs: ['1个', '2个', '3个'],
        factors: [1, 2, 3],
        hint: '鸡蛋按个数估；标准份是 1 个，约 50g。'
      };
    }
    if (food.cat === '蛋白' && /蛋白粉/.test(food.name)) {
      return {
        icon: '🥄',
        refs: ['半勺', '一勺', '一勺半'],
        factors: [0.5, 1, 1.5],
        hint: '蛋白粉按勺估；包装上的每份克数最准。'
      };
    }
    if (food.cat === '蛋白' && /豆浆|奶昔/.test(food.name)) {
      return {
        icon: '🥛',
        refs: ['半杯', '一杯', '一杯半'],
        factors: [0.5, 1, 1.5],
        hint: '普通玻璃杯约 250ml；豆浆尽量选无糖。'
      };
    }
    if (food.cat === '蛋白') {
      return {
        icon: '🖐️',
        refs: ['半掌', '一掌', '一掌半'],
        factors: [0.5, 1, 1.5],
        hint: '一个掌心大小、约一指厚的熟肉或鱼，大约 100g。'
      };
    }
    if (food.cat === '主食') {
      if (/饭|粥|面|意面|米粉/.test(food.name)) {
        return {
          icon: '🥣',
          refs: ['半碗', '一碗', '一碗半'],
          factors: [0.5, 1, 1.5],
          hint: '普通饭碗平装米饭约 150g；半碗约 75g。'
        };
      }
      return {
        icon: '✊',
        refs: ['半份', '一份', '一份半'],
        factors: [0.5, 1, 1.5],
        hint: '主食体积约一个拳头；片、个类按份估。'
      };
    }
    if (food.cat === '蔬菜') {
      return {
        icon: '🥬',
        refs: ['半捧', '一捧', '一捧半'],
        factors: [0.5, 1, 1.5],
        hint: '两捧蔬菜约 200g；炒熟后体积会变小。'
      };
    }
    if (food.cat === '水果') {
      return {
        icon: '✊',
        refs: ['半拳', '一拳', '一拳半'],
        factors: [0.5, 1, 1.5],
        hint: '一个拳头大小的水果约 150–200g。'
      };
    }
    if (food.cat === '乳品' || food.cat === '饮品') {
      return {
        icon: '🥛',
        refs: ['半杯', '一杯', '一杯半'],
        factors: [0.5, 1, 1.5],
        hint: '普通玻璃杯约 250ml；按杯子装到的位置估。'
      };
    }
    if (food.cat === '坚果') {
      return {
        icon: '🥜',
        refs: ['半把', '一把', '一把半'],
        factors: [0.5, 1, 1.5],
        hint: '单手一捧窝约 15g 坚果，热量密度很高。'
      };
    }
    if (food.cat === '调味') {
      return {
        icon: '🥄',
        refs: ['半勺', '一勺', '一勺半'],
        factors: [0.5, 1, 1.5],
        hint: '一汤匙油约 10g；用拇指尖比一下更直观。'
      };
    }
    if (food.cat === '餐食') {
      return {
        icon: '🍽️',
        refs: ['半盘', '一盘', '一盘半'],
        factors: [0.5, 1, 1.5],
        hint: '普通餐盘直径约 20cm；按盘子被食物覆盖的面积估。'
      };
    }
    if (food.cat === '零食') {
      return {
        icon: '🍫',
        refs: ['小份', '一份', '一份半'],
        factors: [0.5, 1, 1.5],
        hint: '先看包装上的每份克数；散装零食按一小把估。'
      };
    }
    return {
      icon: '🍽️',
      refs: ['小份', '标准', '大份'],
      factors: [0.5, 1, 1.5],
      hint: '按你平时盛饭的碗或盘子大小估，再微调克数。'
    };
  }

  function visualPortionOptions(food) {
    const profile = visualPortionProfile(food);
    const serving = Math.max(1, finite(food.serving, 100));
    const factors = profile.factors || [0.5, 1, 1.5];
    return {
      ...profile,
      options: factors.map((factor, index) => {
        const qty = Math.max(1, Math.round(serving * factor));
        return {
          qty,
          label: profile.refs[index] || `第${index + 1}份`,
          kcal: Math.round((food.kcal * qty) / 100)
        };
      })
    };
  }

  function openPortionGuideSheet() {
    const cards = [
      { icon: '✊', title: '主食看拳头', copy: '一个拳头约一小碗熟米饭，150g 左右；面包、馒头可用手掌大小估。', kcal: '约 170 kcal' },
      { icon: '🖐️', title: '蛋白看掌心', copy: '一个掌心大小、约一指厚的熟肉或鱼，约 100g；厚度翻倍就按两份算。', kcal: '约 150–200 kcal' },
      { icon: '🥬', title: '蔬菜看两捧', copy: '双手捧起来约 100g，两捧约 200g；叶子菜炒熟后会缩很多。', kcal: '约 50–70 kcal' },
      { icon: '✊', title: '水果看拳头', copy: '一个拳头大小的苹果、橙子约 150–200g；切块水果装满一小碗。', kcal: '约 80–100 kcal' },
      { icon: '👍', title: '油脂看拇指', copy: '一个拇指尖大小的油约 10g，接近一汤匙；坚果一捧窝约 15g。', kcal: '约 90 kcal' },
      { icon: '🥛', title: '饮品看杯子', copy: '普通玻璃杯约 250ml；拿铁、奶茶还要加上奶和糖的热量。', kcal: '按饮品不同' }
    ];
    openSheet({
      kind: 'portion-guide',
      title: '没有秤，怎么估份',
      subtitle: '用你自己的手和常见餐具作为参照',
      content: `<div class="portion-hero">
        <div class="portion-hero-title">眼睛先量，热量才有数。</div>
        <p class="portion-hero-copy">手的大小因人而异，所以用自己的手做参照，比死记克数更实用。餐盘估份后，仍然可以回到记录页微调。</p>
        <div class="portion-hero-tags"><span>拳头 · 主食</span><span>掌心 · 蛋白</span><span>两捧 · 蔬菜</span><span>拇指 · 油脂</span></div>
      </div>
      <div class="portion-grid">
        ${cards.map((card) => `<div class="portion-card">
          <div class="portion-card-emoji" aria-hidden="true">${card.icon}</div>
          <div class="portion-card-title">${card.title}</div>
          <p class="portion-card-copy">${card.copy}</p>
          <span class="portion-card-kcal">${card.kcal}</span>
        </div>`).join('')}
      </div>
      <div class="plate-rule">
        <div class="plate-visual" aria-hidden="true"></div>
        <div class="plate-rule-copy">
          <div class="plate-rule-title">一餐盘怎么配</div>
          <p>用普通 20cm 餐盘：一半蔬菜、四分之一蛋白质、四分之一主食；水果和奶制品另算。</p>
          <div class="plate-legend">
            <span><i class="veg"></i>蔬菜 1/2</span>
            <span><i class="protein"></i>蛋白 1/4</span>
            <span><i class="staple"></i>主食 1/4</span>
          </div>
        </div>
      </div>
      <div class="portion-note">${icon('info')}<span>视觉估份是区间估算，不是精密称重。同一种食物，油炸、红烧或少油清炒的热量会差很多；有包装时优先看营养标签。</span></div>`,
      footer: `<div class="portion-sheet-actions">
        <button class="btn btn-soft" type="button" data-sheet-close>知道了</button>
        <button class="btn btn-primary" type="button" id="portionGuideToFood">去记一餐</button>
      </div>`,
      onMount: (sheet) => {
        $('#portionGuideToFood', sheet)?.addEventListener('click', () => {
          closeSheet(true);
          openFoodPicker(defaultMealForNow());
        });
      }
    });
  }

  // ---------------- Workout screenshot OCR ----------------

  const OCR_WORKOUT_KEYWORDS = [
    ['treadmill', ['跑步机', '室内跑']],
    ['spinning', ['动感单车', '飞轮']],
    ['elliptical', ['椭圆机', '椭圆']],
    ['rowing', ['划船机', '划船']],
    ['stairs', ['爬楼梯', '爬楼', '楼梯']],
    ['jog', ['户外跑步', '路跑', '慢跑', '跑步']],
    ['walk', ['户外快走', '快走', '健走', '散步', '步行', '走路']],
    ['cycling', ['户外骑行', '骑行', '自行车', '单车']],
    ['rope', ['跳绳']],
    ['swim', ['游泳']],
    ['strength', ['力量训练', '力量', '撸铁', '器械']],
    ['bodyweight', ['自重', '俯卧撑', '核心训练']],
    ['hiit', ['HIIT', '高强度间歇', '燃脂']],
    ['yoga', ['瑜伽']],
    ['pilates', ['普拉提']],
    ['dance', ['跳舞', '舞蹈', '尊巴']],
    ['aerobics', ['跳操', '健身操', '有氧操']],
    ['badminton', ['羽毛球']],
    ['basketball', ['篮球']],
    ['football', ['足球']],
    ['table_tennis', ['乒乓球']],
    ['hike', ['徒步', '健行']],
    ['mountain', ['爬山', '登山']],
    ['frisbee', ['飞盘']],
    ['skating', ['轮滑', '滑板', '溜冰']],
    ['climbing', ['攀岩', '抱石']],
    ['dog_walk', ['遛狗']],
    ['housework', ['家务', '打扫']],
    ['stretch', ['拉伸', '放松']]
  ];

  const OCR_STATUS_LABELS = {
    'loading tesseract core': '加载识别引擎',
    'initializing tesseract': '初始化识别引擎',
    'loading language traineddata': '加载中文模型',
    'initializing api': '准备识别',
    'recognizing text': '识别截图文字'
  };

  let tesseractScriptPromise = null;

  function toHalfWidthText(text) {
    return String(text || '')
      .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
      .replace(/：/g, ':')
      .replace(/[，]/g, ',');
  }

  function nearOcrLabel(text, index, regex, radius = 42) {
    regex.lastIndex = 0;
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + radius);
    return regex.test(text.slice(start, end));
  }

  function parseWorkoutText(raw) {
    const text = toHalfWidthText(raw);
    const lower = text.toLowerCase();

    let matched = null;
    for (const [id, words] of OCR_WORKOUT_KEYWORDS) {
      for (const word of words) {
        const idx = lower.indexOf(word.toLowerCase());
        if (idx >= 0 && (!matched || word.length > matched.word.length)) {
          matched = { id, word, idx };
        }
      }
    }
    const indoorHint = /室内|健身房|跑步机|动感单车|泳池|游泳馆/.test(text);
    const outdoorHint = /户外|室外|路跑|公园|操场|山路|登山/.test(text);
    let exerciseId = matched ? matched.id : 'walk';
    if (indoorHint && exerciseId === 'jog') exerciseId = 'treadmill';
    if (indoorHint && exerciseId === 'walk') exerciseId = 'treadmill';
    if (indoorHint && exerciseId === 'cycling') exerciseId = 'spinning';
    const indoorExercises = ['treadmill', 'spinning', 'elliptical', 'rowing', 'stairs', 'strength', 'bodyweight', 'hiit', 'swim', 'yoga', 'pilates', 'aerobics', 'dance', 'table_tennis', 'climbing', 'housework', 'stretch'];
    const env = indoorHint ? 'indoor' : outdoorHint ? 'outdoor' : indoorExercises.includes(exerciseId) ? 'indoor' : 'outdoor';

    const durationLabel = /时长|运动时长|用时|总时长|duration|运动时间/i;
    const durationCandidates = [];
    let match;
    const timeRegex = /(\d{1,3})\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?/g;
    while ((match = timeRegex.exec(text))) {
      const a = Number(match[1]);
      const b = Number(match[2]);
      const c = match[3] != null ? Number(match[3]) : null;
      const seconds = c != null ? a * 3600 + b * 60 + c : a * 60 + b;
      const minutes = Math.round(seconds / 60);
      if (seconds > 0 && minutes >= 1 && minutes <= 600) {
        let score = 10;
        if (nearOcrLabel(text, match.index, durationLabel, 45)) score += 40;
        if (c != null) score += 15;
        if (a >= 5) score += 5;
        if (b >= 60 || (c != null && c >= 60)) score -= 30;
        durationCandidates.push({ minutes, raw: match[0], seconds, score });
      }
    }
    const minuteRegex = /(\d{1,3})\s*(?:分钟|分(?!钟|次))|(\d{1,3})\s*分\s*(\d{1,2})\s*秒/gi;
    while ((match = minuteRegex.exec(text))) {
      const minutes = match[2] != null ? Math.round(Number(match[2]) + Number(match[3]) / 60) : Number(match[1]);
      if (minutes >= 1 && minutes <= 600) {
        let score = 8;
        if (nearOcrLabel(text, match.index, durationLabel, 45)) score += 35;
        durationCandidates.push({ minutes, raw: match[0], seconds: minutes * 60, score });
      }
    }
    const hourRegex = /(\d{1,2})\s*(?:小时|时)\s*(\d{1,2})?\s*(?:分钟|分)?/g;
    while ((match = hourRegex.exec(text))) {
      const minutes = Number(match[1]) * 60 + Number(match[2] || 0);
      if (minutes >= 1 && minutes <= 600) {
        let score = 20;
        if (nearOcrLabel(text, match.index, durationLabel, 45)) score += 35;
        durationCandidates.push({ minutes, raw: match[0], seconds: minutes * 60, score });
      }
    }
    durationCandidates.sort((a, b) => b.score - a.score);
    const duration = durationCandidates[0] || null;

    const calorieLabel = /活动消[耗奈]?|运动消[耗奈]?|消[耗奈]|热量|卡路里|卡洛里|千卡|干卡|大卡|kcal|calories?|cal/gi;
    const calorieUnit = /千卡|干卡|大卡|卡路里|kcal|cal/gi;
    const negativeContext = /心率|次\s*\/?\s*分|bpm|步数|公里|千米|km|米|时长|分钟|秒/gi;
    const labels = [];
    while ((match = calorieLabel.exec(text))) labels.push({ index: match.index, end: match.index + match[0].length });
    const units = [];
    while ((match = calorieUnit.exec(text))) units.push({ index: match.index, end: match.index + match[0].length });
    const calories = [];
    const numRegex = /\d{1,4}(?:[.,]\d{1,3})?/g;
    while ((match = numRegex.exec(text))) {
      const rawNum = match[0];
      const index = match.index;
      const value = Number(rawNum.replace(',', ''));
      if (!Number.isFinite(value) || value < 15 || value > 3000) continue;
      const before = text.slice(Math.max(0, index - 3), index);
      const after = text.slice(index + rawNum.length, index + rawNum.length + 3);
      if (/:/.test(before) || /:/.test(after)) continue;
      if (rawNum.includes('.') && value < 30) continue;
      let score = 0;
      const nearUnit = units.some((unit) => (
        (unit.index >= index + rawNum.length - 1 && unit.index - (index + rawNum.length) <= 7) ||
        (index - unit.end <= 5 && index >= unit.index)
      ));
      if (nearUnit) score += 80;
      const nearCalorieLabel = labels.some((label) => {
        const gap = index >= label.end ? index - label.end : label.index - (index + rawNum.length);
        return gap >= -2 && gap <= 50;
      });
      if (nearCalorieLabel) score += 35;
      if (nearOcrLabel(text, index, negativeContext, 12)) score -= 70;
      if (value >= 50 && value <= 1500) score += 4;
      if (/^\d{1,2}$/.test(rawNum) && value < 40) score -= 10;
      calories.push({ value: Math.round(value), raw: rawNum, score, index });
    }
    calories.sort((a, b) => b.score - a.score || b.value - a.value);
    const uniqueCalories = [];
    for (const item of calories) {
      if (!uniqueCalories.some((existing) => existing.value === item.value)) uniqueCalories.push(item);
    }
    const bestCalorie = uniqueCalories[0] && uniqueCalories[0].score >= 35 ? uniqueCalories[0] : null;

    return {
      rawText: text,
      exerciseId,
      exerciseName: EXERCISE_MAP[exerciseId] ? EXERCISE_MAP[exerciseId].name : '运动',
      typeMatched: Boolean(matched),
      typeWord: matched ? matched.word : '',
      env,
      minutes: duration ? duration.minutes : 0,
      durationText: duration ? duration.raw : '',
      kcal: bestCalorie ? bestCalorie.value : 0,
      calorieCandidates: uniqueCalories.slice(0, 4),
      durationCandidates: durationCandidates.slice(0, 3)
    };
  }

  function ensureTesseractScript() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseractScriptPromise) return tesseractScriptPromise;
    const base = new URL('./vendor/tesseract/', document.baseURI);
    tesseractScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('tesseract.min.js', base).href;
      script.async = true;
      script.onload = () => {
        if (window.Tesseract) resolve(window.Tesseract);
        else reject(new Error('OCR engine did not initialize'));
      };
      script.onerror = () => reject(new Error('OCR engine failed to load'));
      document.head.appendChild(script);
    }).catch((error) => {
      tesseractScriptPromise = null;
      throw error;
    });
    return tesseractScriptPromise;
  }

  function mapOcrStatus(status) {
    return OCR_STATUS_LABELS[status] || '准备图片';
  }

  function ocrOverallProgress(status, progress) {
    const value = Math.max(0, Math.min(1, Number(progress) || 0));
    if (status === 'loading tesseract core') return 3 + value * 22;
    if (status === 'initializing tesseract') return 25 + value * 8;
    if (status === 'loading language traineddata') return 33 + value * 22;
    if (status === 'initializing api') return 55 + value * 8;
    if (status === 'recognizing text') return 63 + value * 37;
    return 1;
  }

  async function runWorkoutOcr(imageDataUrl, onProgress) {
    const Tesseract = await ensureTesseractScript();
    const base = new URL('./vendor/tesseract/', document.baseURI);
    let worker = null;
    try {
      worker = await Tesseract.createWorker('chi_sim', 1, {
        workerPath: new URL('worker.min.js', base).href,
        corePath: new URL('core', base).href,
        langPath: new URL('lang', base).href,
        workerBlobURL: false,
        gzip: false,
        logger: (message) => {
          if (message && message.status) onProgress(message);
        }
      });
      const result = await worker.recognize(imageDataUrl);
      return result.data.text || '';
    } finally {
      if (worker) {
        try { await worker.terminate(); } catch (error) { /* worker may already be gone */ }
      }
    }
  }

  function loadImageForOcr(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve({ image, url });
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('图片无法读取，请换一张 JPG 或 PNG 截图'));
      };
      image.src = url;
    });
  }

  function canvasToDataUrl(canvas, type, quality) {
    return canvas.toDataURL(type, quality);
  }

  async function prepareScreenshotImage(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      throw new Error('请选择图片文件');
    }
    if (file.size > 16 * 1024 * 1024) {
      throw new Error('截图超过 16MB，请先裁小一点');
    }
    const { image, url } = await loadImageForOcr(file);
    try {
      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      if (!sourceWidth || !sourceHeight) throw new Error('图片尺寸无法读取');
      const ocrScale = Math.min(2, 1600 / Math.max(sourceWidth, sourceHeight));
      const ocrWidth = Math.max(1, Math.round(sourceWidth * ocrScale));
      const ocrHeight = Math.max(1, Math.round(sourceHeight * ocrScale));
      const ocrCanvas = document.createElement('canvas');
      ocrCanvas.width = ocrWidth;
      ocrCanvas.height = ocrHeight;
      const ocrContext = ocrCanvas.getContext('2d', { willReadFrequently: true });
      ocrContext.drawImage(image, 0, 0, ocrWidth, ocrHeight);

      // Dark-mode screenshots are easier for Tesseract when inverted.
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 32;
      sampleCanvas.height = 32;
      const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
      sampleContext.drawImage(image, 0, 0, 32, 32);
      const sample = sampleContext.getImageData(0, 0, 32, 32).data;
      let luminance = 0;
      for (let i = 0; i < sample.length; i += 4) {
        luminance += sample[i] * 0.299 + sample[i + 1] * 0.587 + sample[i + 2] * 0.114;
      }
      luminance /= sample.length / 4;
      if (luminance < 105) {
        ocrContext.globalCompositeOperation = 'difference';
        ocrContext.fillStyle = '#ffffff';
        ocrContext.fillRect(0, 0, ocrWidth, ocrHeight);
        ocrContext.globalCompositeOperation = 'source-over';
      }

      const previewScale = Math.min(1, 680 / Math.max(sourceWidth, sourceHeight));
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = Math.max(1, Math.round(sourceWidth * previewScale));
      previewCanvas.height = Math.max(1, Math.round(sourceHeight * previewScale));
      previewCanvas.getContext('2d').drawImage(image, 0, 0, previewCanvas.width, previewCanvas.height);

      return {
        ocrDataUrl: canvasToDataUrl(ocrCanvas, 'image/png'),
        previewDataUrl: canvasToDataUrl(previewCanvas, 'image/jpeg', 0.82),
        width: sourceWidth,
        height: sourceHeight
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function openScreenshotImportSheet() {
    let prepared = null;
    let parsed = null;
    let rawText = '';
    let running = false;
    let disposed = false;

    const progressMarkup = `<div class="ocr-status" id="ocrStatusPanel" hidden>
      <div class="ocr-status-line"><span id="ocrStatusText">准备图片</span><span id="ocrPercent">0%</span></div>
      <div class="ocr-progress"><i id="ocrProgressBar"></i></div>
    </div>`;

    openSheet({
      kind: 'ocr-import',
      title: '截图导入',
      subtitle: '从 OPPO 健康 / 欢太健康的运动记录截图提取数据',
      content: `<div class="ocr-privacy">
        ${icon('info')}
        <span>识别完全在本机浏览器完成，截图不会上传。第一次使用需要加载约 9MB 的本地中文识别模型，之后会缓存。</span>
      </div>
      <div class="ocr-dropzone" id="ocrDropzone">
        <div class="ocr-drop-icon">${icon('camera')}</div>
        <div class="ocr-drop-title">选一张运动记录截图</div>
        <p class="ocr-drop-copy">截图里最好同时包含运动名称、时长和“活动消耗”。可以只截运动详情这一屏，越清晰越好。</p>
        <div class="ocr-file-actions">
          <button class="btn btn-primary btn-sm" type="button" id="ocrPickButton">选择截图</button>
          <button class="btn btn-soft btn-sm" type="button" id="ocrCameraButton">${icon('camera')}拍照</button>
        </div>
      </div>
      <input type="file" id="ocrFileInput" accept="image/*" hidden>
      <input type="file" id="ocrCameraInput" accept="image/*" capture="environment" hidden>
      <img class="ocr-preview" id="ocrPreview" alt="导入截图预览" hidden>
      ${progressMarkup}
      <div class="ocr-result" id="ocrResult" hidden></div>
      <div class="ocr-error" id="ocrError" hidden>${icon('alert')}<span></span></div>
      <div class="quick-entry-note">${icon('sparkle')}识别结果会填入运动表单，保存前请核对。网页不登录 OPPO 账号；没有识别准也没关系，可以直接改数字或手动录入。</div>`,
      onClose: () => {
        disposed = true;
      },
      onMount: (sheet) => {
        const dropzone = $('#ocrDropzone', sheet);
        const fileInput = $('#ocrFileInput', sheet);
        const cameraInput = $('#ocrCameraInput', sheet);
        const preview = $('#ocrPreview', sheet);
        const resultEl = $('#ocrResult', sheet);
        const errorEl = $('#ocrError', sheet);
        const statusPanel = $('#ocrStatusPanel', sheet);
        const statusText = $('#ocrStatusText', sheet);
        const percent = $('#ocrPercent', sheet);
        const progressBar = $('#ocrProgressBar', sheet);

        const setError = (message) => {
          errorEl.hidden = false;
          errorEl.querySelector('span').textContent = message;
        };
        const clearError = () => {
          $$('button', errorEl).forEach((button) => button.remove());
          errorEl.hidden = true;
          errorEl.querySelector('span').textContent = '';
        };
        const resetToUpload = () => {
          prepared = null;
          parsed = null;
          rawText = '';
          preview.hidden = true;
          preview.removeAttribute('src');
          resultEl.hidden = true;
          resultEl.innerHTML = '';
          statusPanel.hidden = true;
          dropzone.hidden = false;
          clearError();
          fileInput.value = '';
          cameraInput.value = '';
        };
        const updateProgress = (message) => {
          if (disposed) return;
          const overall = ocrOverallProgress(message.status, message.progress);
          statusPanel.hidden = false;
          statusText.textContent = mapOcrStatus(message.status);
          percent.textContent = `${Math.round(overall)}%`;
          progressBar.style.width = `${overall.toFixed(1)}%`;
        };
        const showResult = () => {
          if (disposed) return;
          const typeText = parsed.typeMatched ? parsed.exerciseName : '未识别（默认快走）';
          const missing = [];
          if (!parsed.minutes) missing.push('时长');
          if (!parsed.kcal) missing.push('活动消耗');
          if (!parsed.typeMatched) missing.push('运动项目');
          resultEl.hidden = false;
          resultEl.innerHTML = `<div class="ocr-result-head">
            <span class="ocr-result-title">识别结果</span>
            <span>请核对后填入</span>
          </div>
          <div class="ocr-metrics">
            <div class="ocr-metric"><span>运动项目</span><strong>${esc(typeText)}</strong></div>
            <div class="ocr-metric"><span>时长</span><strong>${parsed.minutes ? parsed.minutes + '<small> 分钟</small>' : '—'}</strong></div>
            <div class="ocr-metric"><span>活动消耗</span><strong>${parsed.kcal ? fmtInt(parsed.kcal) + '<small> kcal</small>' : '—'}</strong></div>
          </div>
          ${missing.length ? `<p class="ocr-warning">${icon('alert')} 有${missing.join('、')}没有完全识别准，下一步可以手动修正。</p>` : ''}
          <details class="ocr-raw">
            <summary>查看识别原文</summary>
            <pre>${esc(rawText)}</pre>
          </details>
          <div class="ocr-result-actions">
            <button class="btn btn-soft btn-sm" type="button" id="ocrRetry">重新选择</button>
            <button class="btn btn-primary btn-sm" type="button" id="ocrConfirm">去确认并保存</button>
          </div>
          <button class="text-action" type="button" id="ocrManual">不识别了，直接手动填写</button>`;
          resultEl.querySelector('#ocrRetry').addEventListener('click', resetToUpload);
          resultEl.querySelector('#ocrConfirm').addEventListener('click', () => {
            if (!prepared || !parsed) return;
            openExerciseSheet({
              exerciseId: parsed.exerciseId,
              minutes: parsed.minutes || 30,
              env: parsed.env,
              watchKcal: parsed.kcal || null,
              ocr: {
                previewDataUrl: prepared.previewDataUrl,
                rawText,
                parsed
              }
            });
          });
          resultEl.querySelector('#ocrManual').addEventListener('click', () => {
            openExerciseSheet({ focusWatch: true });
          });
        };

        const handleFile = async (file) => {
          if (!file || running || disposed) return;
          running = true;
          clearError();
          resultEl.hidden = true;
          resultEl.innerHTML = '';
          dropzone.hidden = true;
          statusPanel.hidden = false;
          statusText.textContent = '准备图片';
          percent.textContent = '0%';
          progressBar.style.width = '0%';
          $('#ocrPickButton', sheet)?.setAttribute('disabled', 'disabled');
          $('#ocrCameraButton', sheet)?.setAttribute('disabled', 'disabled');
          try {
            prepared = await prepareScreenshotImage(file);
            if (disposed) return;
            preview.src = prepared.previewDataUrl;
            preview.hidden = false;
            updateProgress({ status: 'loading tesseract core', progress: 0 });
            rawText = await runWorkoutOcr(prepared.ocrDataUrl, updateProgress);
            if (disposed) return;
            parsed = parseWorkoutText(rawText);
            if (!rawText.trim()) {
              throw new Error('没有从截图里读到文字，请换一张更清晰的截图');
            }
            statusPanel.hidden = true;
            showResult();
          } catch (error) {
            if (disposed) return;
            statusPanel.hidden = true;
            setError(`${error.message || '识别失败'}。可以直接手动录入，或换一张截图重试。`);
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'btn btn-soft btn-sm';
            retry.textContent = '重新选择';
            retry.addEventListener('click', resetToUpload);
            errorEl.appendChild(retry);
            const manual = document.createElement('button');
            manual.type = 'button';
            manual.className = 'text-action';
            manual.textContent = '手动填写';
            manual.addEventListener('click', () => openExerciseSheet({ focusWatch: true }));
            errorEl.appendChild(manual);
          } finally {
            running = false;
            if (!disposed) {
              $('#ocrPickButton', sheet)?.removeAttribute('disabled');
              $('#ocrCameraButton', sheet)?.removeAttribute('disabled');
            }
          }
        };

        $('#ocrPickButton', sheet)?.addEventListener('click', () => fileInput.click());
        $('#ocrCameraButton', sheet)?.addEventListener('click', () => cameraInput.click());
        fileInput.addEventListener('change', () => handleFile(fileInput.files && fileInput.files[0]));
        cameraInput.addEventListener('change', () => handleFile(cameraInput.files && cameraInput.files[0]));
        ['dragenter', 'dragover'].forEach((type) => {
          dropzone.addEventListener(type, (event) => {
            event.preventDefault();
            dropzone.classList.add('is-dragover');
          });
        });
        ['dragleave', 'drop'].forEach((type) => {
          dropzone.addEventListener(type, (event) => {
            event.preventDefault();
            dropzone.classList.remove('is-dragover');
          });
        });
        dropzone.addEventListener('drop', (event) => {
          const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
          if (file) handleFile(file);
        });
      }
    });
  }

  // ---------------- Plan generation ----------------

  function buildMealPlan(stats) {
    if (!state.data.profile) return { error: 'no-profile' };
    const remaining = stats.budget - stats.consumedKcal;
    const loggedMeals = new Set((stats.foods || []).map((entry) => entry.meal));
    const hour = new Date().getHours();
    const slots = MEAL_ORDER.filter((meal) => {
      if (loggedMeals.has(meal)) return false;
      // Don't suggest a breakfast or lunch that has already clearly passed.
      if (meal === 'breakfast' && hour >= 11) return false;
      if (meal === 'lunch' && hour >= 16) return false;
      return true;
    });
    if (!slots.length) {
      const allMealsLogged = MEAL_ORDER.every((meal) => loggedMeals.has(meal));
      return { error: allMealsLogged ? 'all-logged' : 'no-upcoming' };
    }
    if (remaining <= 70) return { error: 'no-budget', remaining };
    if (stats.consumedKcal === 0 && remaining <= 0) return { error: 'no-budget', remaining };

    const diet = state.data.profile.diet;
    const poolFor = (slot) => RECIPES.filter((recipe) => {
      if (slot === 'breakfast' && recipe.meal !== 'breakfast') return false;
      if (slot === 'snack' && recipe.meal !== 'snack') return false;
      if (slot !== 'breakfast' && slot !== 'snack' && recipe.meal !== 'main') return false;
      if (diet === 'vegetarian' && !recipe.vegetarian) return false;
      return true;
    });
    const candidateSlots = slots
      .map((meal) => ({ meal, pool: poolFor(meal) }))
      .filter((item) => item.pool.length > 0);
    if (!candidateSlots.length) return { error: 'no-match', remaining };
    const usableSlots = candidateSlots.map((item) => item.meal);
    const pools = candidateSlots.map((item) => item.pool);

    const proteinRemaining = Math.max(0, stats.targets.protein - stats.consumed.p);
    const combos = [];
    const chosen = [];
    const used = new Set();

    // Each unlogged meal may be skipped. This lets a small remaining budget
    // produce a light one- or two-item plan instead of a huge over-budget menu.
    function walk(index, kcal, protein) {
      if (index === usableSlots.length) {
        if (!chosen.length) return;
        const missing = usableSlots.length - chosen.length;
        const over = Math.max(0, kcal - remaining);
        let score = Math.abs(kcal - remaining);
        score += over * 0.9;
        score += missing * 55;
        score += Math.max(0, proteinRemaining - protein) * 2.6;
        if (diet === 'highProtein') {
          const ratio = protein / Math.max(1, kcal);
          score += Math.max(0, 0.28 - ratio) * 420;
        }
        const entries = chosen.map((entry) => ({ slot: entry.slot, recipe: entry.recipe }));
        combos.push({
          entries,
          kcal,
          protein: round(protein, 1),
          score,
          missing,
          slotKey: entries.map((entry) => entry.slot).join(',')
        });
        return;
      }
      // Skip this meal.
      walk(index + 1, kcal, protein);
      // Or choose a recipe for it.
      for (const recipe of pools[index]) {
        if (used.has(recipe.id)) continue;
        chosen.push({ slot: usableSlots[index], recipe });
        used.add(recipe.id);
        walk(index + 1, kcal + recipe.kcal, protein + recipe.protein);
        used.delete(recipe.id);
        chosen.pop();
      }
    }
    walk(0, 0, 0);

    if (!combos.length) return { error: 'no-match', remaining };
    const maxOvershoot = Math.max(80, Math.round(remaining * 0.08));
    const feasible = combos.filter((combo) => combo.kcal <= remaining + maxOvershoot);
    const pool = (feasible.length ? feasible : combos).sort((a, b) => a.score - b.score || a.kcal - b.kcal);
    const best = pool[0];
    if (!feasible.length && best.kcal > remaining + 120) {
      return { error: 'tight-budget', remaining };
    }

    // Build a small set of meaningfully different plans that keep the same meal
    // structure. Without this, "换一套" often just swaps lunch and dinner.
    const peerCombos = [];
    const seenSignatures = new Set();
    for (const combo of pool) {
      if (combo.slotKey !== best.slotKey) continue;
      const signature = combo.entries.map((entry) => entry.recipe.id).sort().join('|');
      if (seenSignatures.has(signature)) continue;
      seenSignatures.add(signature);
      peerCombos.push(combo);
    }
    const requiredDifferences = Math.min(2, best.entries.length);
    const diverse = [];
    for (const combo of peerCombos) {
      if (!diverse.length) {
        diverse.push(combo);
        continue;
      }
      const isDifferent = diverse.every((existing) => {
        const overlap = combo.entries.filter((entry) => existing.entries.some((item) => item.recipe.id === entry.recipe.id)).length;
        return best.entries.length - overlap >= requiredDifferences;
      });
      if (isDifferent) diverse.push(combo);
      if (diverse.length >= 12) break;
    }
    const variantPool = diverse.length >= 2 ? diverse : peerCombos.slice(0, 12);
    const variantCount = Math.min(variantPool.length, 12);
    const day = getDay(dateKey(), false);
    const variant = variantCount > 0 ? (Math.max(0, Math.round(finite(day.planVariant, 0))) % variantCount) : 0;
    const selected = variantPool[variant] || peerCombos[0] || best;
    return {
      ...selected,
      remaining,
      loggedMeals,
      slots: usableSlots,
      variant,
      variantCount,
      proteinRemaining,
      diff: selected.kcal - remaining
    };
  }

  function findSupplementCombos(targetKcal) {
    const diet = state.data.profile ? state.data.profile.diet : 'balanced';
    const snacks = RECIPES.filter((recipe) => recipe.meal === 'snack' && (diet !== 'vegetarian' || recipe.vegetarian));
    const options = [];
    snacks.forEach((recipe) => {
      options.push({
        ids: [recipe.id],
        recipes: [recipe],
        kcal: recipe.kcal,
        protein: recipe.protein
      });
    });
    for (let i = 0; i < snacks.length; i += 1) {
      for (let j = i + 1; j < snacks.length; j += 1) {
        const a = snacks[i];
        const b = snacks[j];
        options.push({
          ids: [a.id, b.id],
          recipes: [a, b],
          kcal: a.kcal + b.kcal,
          protein: round(a.protein + b.protein, 1)
        });
      }
    }
    return options
      .map((option) => {
        const over = Math.max(0, option.kcal - targetKcal);
        return { ...option, score: Math.abs(option.kcal - targetKcal) + over * 0.35 };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 2);
  }

  function suggestExercisesForGap(gap) {
    const weight = state.data.profile.currentWeight;
    const ids = ['walk', 'rope', 'jog'];
    return ids.map((id) => {
      const exercise = EXERCISE_MAP[id];
      const met = exercise.met.medium;
      const perMinute = (met * 3.5 * weight) / 200;
      const rawMinutes = Math.ceil(gap / Math.max(perMinute, 0.1) / 5) * 5;
      const minutes = clamp(rawMinutes, 5, 120);
      return { exercise, minutes, env: exercise.env };
    });
  }

  // ---------------- Markup helpers ----------------

  function pageHead(eyebrow, title, sub, id) {
    return `<div class="view-head">
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h1 class="page-title" id="${id}">${title}</h1>
      <p class="page-sub">${sub}</p>
    </div>`;
  }

  function sectionHead(title, note, action = '') {
    return `<div class="section-head">
      <div>
        <h2 class="section-title">${title}</h2>
        ${note ? `<p class="section-kicker">${note}</p>` : ''}
      </div>
      ${action ? `<div class="section-head-side">${action}</div>` : ''}
    </div>`;
  }

  function renderMacroCard(stats) {
    const targets = stats.targets;
    const data = [
      { key: 'p', label: '蛋白质', value: stats.consumed.p, target: targets.protein, unit: 'g', color: '#b8cf6a' },
      { key: 'c', label: '碳水', value: stats.consumed.c, target: targets.carbs, unit: 'g', color: '#d9aa6e' },
      { key: 'f', label: '脂肪', value: stats.consumed.f, target: targets.fat, unit: 'g', color: '#89afa4' }
    ];
    return `<article class="card macro-card" aria-label="今日三大营养素">
      ${data.map((item) => {
        const pct = item.target > 0 ? clamp((item.value / item.target) * 100, 0, 100) : 0;
        const isOver = item.value > item.target * 1.05;
        return `<div class="macro${isOver ? ' is-over' : ''}" style="--macro-color:${item.color}">
          <div class="macro-label"><i></i>${item.label}</div>
          <div class="macro-value">${fmtInt(item.value)}<small> / ${fmtInt(item.target)}${item.unit}</small></div>
          <div class="macro-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        </div>`;
      }).join('')}
    </article>`;
  }

  function entryMeta(entry) {
    const time = entry.time ? ` · ${esc(entry.time)}` : '';
    if (entry.source === 'food') {
      return `${fmtAmount(entry.qty)} g${time}`;
    }
    if (entry.source === 'recipe') {
      return `${fmtAmount(entry.qty)} 份 · 食谱${time}`;
    }
    return `快速记录${time}`;
  }

  function renderMealBlock(meal, entries) {
    const info = MEAL_MAP[meal];
    const total = sumEntries(entries).kcal;
    const entryMarkup = entries.length
      ? entries.map((entry) => {
          const nutrition = entryNutrition(entry);
          return `<button class="entry" type="button" data-action="edit-food-entry" data-id="${esc(entry.id)}" aria-label="编辑 ${esc(entry.name)} ${esc(fmtAmount(entry.qty))} ${esc(entry.unit)}">
            <span class="entry-emoji" aria-hidden="true">${esc(entry.emoji || '🍽️')}</span>
            <span class="entry-main">
              <span class="entry-name">${esc(entry.name)}</span>
              <span class="entry-meta">${entryMeta(entry)}</span>
            </span>
            <span class="entry-kcal">${fmtInt(nutrition.kcal)}<small> kcal</small></span>
          </button>`;
        }).join('')
      : `<button class="entry-empty" type="button" data-action="add-food" data-meal="${meal}">
          ${icon('plus')}添加${info.name}记录
        </button>`;

    return `<div class="meal-block">
      <div class="meal-head">
        <span class="meal-emoji" aria-hidden="true">${info.emoji}</span>
        <div class="meal-heading">
          <div class="meal-title">${info.name}<small>${entries.length ? entries.length + ' 项' : '还没记录'}</small></div>
        </div>
        <span class="meal-kcal">${fmtInt(total)}<span> kcal</span></span>
        <button class="icon-btn" type="button" data-action="add-food" data-meal="${meal}" aria-label="添加${info.name}">
          ${icon('plus')}
        </button>
      </div>
      <div class="meal-entries">${entryMarkup}</div>
    </div>`;
  }

  function renderIntake() {
    const stats = getStats();
    const remaining = stats.remainingBudget;
    const isOver = remaining < 0;
    const pct = stats.budget > 0 ? clamp(stats.consumedKcal / stats.budget, 0, 1) : 0;
    const radius = 61;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - pct);
    const ringLabel = isOver ? '已超出' : '还可摄入';
    const entryCount = stats.foods.length;
    const defaultMeal = defaultMealForNow();
    const targetPct = stats.budget > 0 ? Math.round((stats.consumedKcal / stats.budget) * 100) : 0;
    const exerciseNote = stats.exerciseKcal > 0 ? ` · 运动 +${fmtInt(stats.exerciseKcal)}` : '';

    return `${pageHead(
      `${greeting()} · ${dateLabel()}`,
      '今天，吃得刚刚好。',
      '不用精确到每一口。先把摄入记下来，剩下的交给缺口来判断。',
      'intakeTitle'
    )}
    <article class="hero hero-intake">
      <div class="calorie-ring${isOver ? ' is-over' : ''}" role="img" aria-label="今日已摄入 ${fmtInt(stats.consumedKcal)} 千卡，占预算 ${targetPct}%">
        <svg viewBox="0 0 142 142" aria-hidden="true">
          <circle class="ring-track" cx="71" cy="71" r="${radius}"></circle>
          <circle class="ring-progress" cx="71" cy="71" r="${radius}" style="stroke-dasharray:${circumference.toFixed(2)};stroke-dashoffset:${dashOffset.toFixed(2)}"></circle>
        </svg>
        <div class="ring-center">
          <span>${ringLabel}</span>
          <strong>${fmtInt(Math.abs(remaining))}</strong>
          <small>kcal</small>
        </div>
      </div>
      <div class="hero-copy">
        <p class="hero-kicker">今日饮食预算</p>
        <div class="hero-budget"><strong>${fmtInt(stats.budget)}</strong><span>kcal</span></div>
        <p>已摄入 ${fmtInt(stats.consumedKcal)} kcal${exerciseNote}</p>
        <button class="btn btn-lime btn-sm" type="button" data-action="add-food" data-meal="${defaultMeal}">
          ${icon('plus')}记一餐
        </button>
      </div>
      <div class="hero-bottom">
        <span>目标缺口 <strong>${fmtInt(stats.targetDeficit)} kcal</strong></span>
        <span aria-hidden="true">·</span>
        <span>${stats.energy.capped ? '已按安全范围收紧' : '随运动实时增加'}</span>
        <span class="hero-bottom-spacer"></span>
        <button class="link-light" type="button" data-action="show-calc">${icon('info')}怎么算的</button>
      </div>
    </article>
    ${renderMacroCard(stats)}
    <button class="visual-entry" type="button" data-action="open-portion-guide">
      <span class="visual-entry-art" aria-hidden="true"><span>✊</span><span>🖐️</span></span>
      <span class="visual-entry-copy">
        <strong>没有秤，也能估份</strong>
        <span>用拳头、掌心、碗和杯子，把“看着差不多”变成克数与热量</span>
      </span>
      <span class="visual-entry-arrow">${icon('chevron')}</span>
    </button>
    <section class="section">
      ${sectionHead(
        '今天的饮食',
        `${entryCount ? '共 ' + entryCount + ' 笔 · 点按记录可调整分量' : '先从第一餐开始，不必一次记完全部'}`,
        `<button class="text-action" type="button" data-action="quick-calorie">${icon('bolt')}快速记热量</button>`
      )}
      <div class="card meal-card">
        ${MEAL_ORDER.map((meal) => renderMealBlock(meal, getMealEntries(stats.day, meal))).join('')}
      </div>
    </section>
    <div class="intake-note">
      ${icon('info')}
      <span>食物热量来自常见食物参考值，实际会因品牌、烹饪用油和份量而波动。记录的意义是看趋势，不是追求绝对值。</span>
    </div>`;
  }

  function renderExerciseRow(entry) {
    const envLabel = entry.env === 'outdoor' ? '室外' : '室内';
    const intensity = INTENSITY[entry.intensity] || INTENSITY.medium;
    return `<button class="exercise-row" type="button" data-action="edit-exercise" data-id="${esc(entry.id)}" aria-label="编辑 ${esc(entry.name)} ${fmtInt(entry.minutes)} 分钟">
      <span class="exercise-icon" aria-hidden="true">${esc(entry.emoji || '🏃')}</span>
      <span class="exercise-main">
        <span class="exercise-name-line">
          <span class="exercise-name">${esc(entry.name)}</span>
          <span class="badge ${entry.source === 'watch' ? 'badge-watch' : 'badge-met'}">${entry.source === 'watch' ? icon('watch') + '手表' : 'MET 估算'}</span>
        </span>
        <span class="exercise-meta">
          <span>${fmtInt(entry.minutes)} 分钟</span><i></i>
          <span>${intensity.label}</span><i></i>
          <span>${envLabel}</span>
          ${entry.time ? `<i></i><span>${esc(entry.time)}</span>` : ''}
        </span>
      </span>
      <span class="exercise-kcal"><strong>${fmtInt(entry.kcal)}</strong><span> kcal</span></span>
    </button>`;
  }

  function renderEnvCards(stats) {
    const exercises = stats.exercises || [];
    const out = exercises.filter((entry) => entry.env === 'outdoor');
    const inside = exercises.filter((entry) => entry.env === 'indoor');
    const totalMinutes = exercises.reduce((sum, entry) => sum + finite(entry.minutes), 0);
    const outMinutes = out.reduce((sum, entry) => sum + finite(entry.minutes), 0);
    const inMinutes = inside.reduce((sum, entry) => sum + finite(entry.minutes), 0);
    const outKcal = out.reduce((sum, entry) => sum + finite(entry.kcal), 0);
    const inKcal = inside.reduce((sum, entry) => sum + finite(entry.kcal), 0);
    const outPct = totalMinutes > 0 ? (outMinutes / totalMinutes) * 100 : 0;
    const inPct = totalMinutes > 0 ? (inMinutes / totalMinutes) * 100 : 0;

    return `<div class="env-grid">
      <article class="env-card is-outdoor">
        <div class="env-card-top">
          <span class="env-label">${icon('sun')}室外</span>
          <span class="env-count">${out.length} 次</span>
        </div>
        <div class="env-minutes">${fmtInt(outMinutes)}<small>分钟</small></div>
        <div class="env-kcal">${fmtInt(outKcal)} kcal</div>
        <div class="env-bar"><i style="width:${outPct.toFixed(1)}%"></i></div>
      </article>
      <article class="env-card is-indoor">
        <div class="env-card-top">
          <span class="env-label">${icon('home')}室内</span>
          <span class="env-count">${inside.length} 次</span>
        </div>
        <div class="env-minutes">${fmtInt(inMinutes)}<small>分钟</small></div>
        <div class="env-kcal">${fmtInt(inKcal)} kcal</div>
        <div class="env-bar"><i style="width:${inPct.toFixed(1)}%"></i></div>
      </article>
    </div>`;
  }

  function renderBurn() {
    const stats = getStats();
    const exercises = stats.exercises;
    const basePct = stats.burn > 0 ? (stats.baseline / stats.burn) * 100 : 0;
    const workPct = stats.burn > 0 ? (stats.exerciseKcal / stats.burn) * 100 : 0;

    return `${pageHead(
      `${greeting()} · ${dateLabel()}`,
      '动一点，也有分量。',
      '日常消耗按全天预估；运动消耗优先采用 OPPO Watch S2 的数据，室内室外分开记。',
      'burnTitle'
    )}
    <article class="hero hero-burn">
      <div class="hero-burn-top">
        <span class="hero-burn-label">今日预计总消耗</span>
        <span class="pill pill-lime">${stats.exerciseKcal > 0 ? '含运动数据' : '待记录运动'}</span>
      </div>
      <div class="hero-burn-number"><strong>${fmtInt(stats.burn)}</strong><span>kcal</span></div>
      <p class="hero-burn-sub">日常消耗 ${fmtInt(stats.baseline)} + 运动消耗 ${fmtInt(stats.exerciseKcal)}</p>
      <div class="burn-stack" aria-hidden="true">
        <i class="stack-base" style="width:${basePct.toFixed(1)}%"></i>
        <i class="stack-work" style="width:${Math.max(workPct, stats.exerciseKcal > 0 ? 2 : 0).toFixed(1)}%"></i>
      </div>
      <div class="burn-legend">
        <span class="burn-legend-item"><i style="background:rgba(246,241,228,.38)"></i>日常<strong>${fmtInt(stats.baseline)}</strong></span>
        <span class="burn-legend-item"><i style="background:var(--lime)"></i>运动<strong>${fmtInt(stats.exerciseKcal)}</strong></span>
      </div>
      <div class="hero-burn-actions">
        <p class="hero-note">运动热量计入当天预算；日常消耗不是此刻的已消耗量。</p>
        <button class="btn btn-lime btn-sm" type="button" data-action="record-exercise">${icon('plus')}记录运动</button>
      </div>
    </article>
    <button class="import-entry" type="button" data-action="screenshot-import">
      <span class="import-entry-icon">${icon('camera')}</span>
      <span class="import-entry-copy">
        <strong>从 OPPO 健康截图导入 <small>本地识别</small></strong>
        <span>自动读时长、活动消耗和运动项目；图片不上传</span>
      </span>
      ${icon('chevron')}
    </button>
    ${renderEnvCards(stats)}
    <section class="section">
      ${sectionHead(
        '今天的运动',
        exercises.length ? `已记录 ${exercises.length} 次 · 室内外分开统计` : '还没有记录，手动或截图导入都可以',
        `<button class="text-action" type="button" data-action="record-exercise">${icon('plus')}新增</button>`
      )}
      ${exercises.length
        ? `<div class="card list-card">${exercises.map(renderExerciseRow).join('')}</div>`
        : `<div class="empty-card">
            <div class="empty-art" aria-hidden="true">${icon('activity')}</div>
            <div class="empty-title">今天还没有运动记录</div>
            <p class="empty-text">在手表或欢太健康里找到本次运动的“活动消耗”和时长。可以手动填写，也可以上传运动记录截图，让轻衡在本机识别。</p>
            <div class="empty-actions">
              <button class="btn btn-primary btn-sm" type="button" data-action="record-exercise">${icon('plus')}记录第一项</button>
              <button class="btn btn-soft btn-sm" type="button" data-action="screenshot-import">${icon('camera')}截图导入</button>
            </div>
          </div>`}
    </section>
    <div class="hint-card">
      <div class="hint-head"><span class="hint-badge">${icon('watch')}</span>OPPO Watch S2 数据这样录</div>
      <div class="hint-steps">
        <p class="hint-step">打开手表或<strong>欢太健康</strong>的运动记录，找到本次训练的时长与<strong>活动消耗</strong>。</p>
        <p class="hint-step">可以上传截图让轻衡识别，也可以手动选择项目、标记<strong>室内 / 室外</strong>并填入千卡。</p>
        <p class="hint-step">不填手表热量时，轻衡会按 MET 与体重估算；手表数据永远优先。</p>
      </div>
      <div class="hint-footer">
        <span>网页不读取手表账号，截图只在本机识别</span>
        <button class="text-action" type="button" data-action="record-watch">${icon('watch')}手动录入</button>
      </div>
    </div>
    <div class="intake-note">
      ${icon('info')}
      <span>手表的光学心率与热量是算法估算值，适合观察同一台设备上的长期趋势。日常消耗已去掉专门运动，避免和手表重复计算。</span>
    </div>`;
  }

  function renderDeficitHero(stats, status) {
    const actual = stats.actualDeficit;
    const target = stats.targetDeficit;
    const noFood = !stats.hasFood;
    const pct = !noFood && target > 0 ? clamp((actual / target) * 100, 0, 100) : 0;
    const incompleteHigh = status.tone === 'high' && stats.missingMainMeals.length > 0;
    const statusTone = incompleteHigh ? 'muted' : status.tone;
    const statusLabel = incompleteHigh ? '记录未全' : status.label;
    const statusClass = {
      muted: 'is-muted', low: 'is-low', high: 'is-high', good: 'is-good', over: 'is-over'
    }[statusTone] || 'is-muted';
    const isNegative = actual < 0;
    const formula = noFood
      ? `预计总消耗 ${fmtInt(stats.burn)} − 已摄入 待记录`
      : `预计总消耗 ${fmtInt(stats.burn)} − 已摄入 ${fmtInt(stats.consumedKcal)} = 预计缺口 ${signedWithCommas(actual)} kcal`;
    const missingMealText = stats.missingMainMeals.length
      ? `还有${stats.missingMainMeals.map(findMealName).join('、')}未记录，缺口可能偏高`
      : '';
    const footText = noFood
      ? '先记录一餐，再判断缺口'
      : status.tone === 'high' && missingMealText
        ? missingMealText
        : '按全天消耗预估，随记录变化实时更新';

    return `<article class="hero hero-deficit">
      <div class="deficit-head">
        <div>
          <p class="deficit-label">今日预计热量缺口</p>
          <div class="deficit-number">
            <strong${noFood ? ' class="is-placeholder"' : ''}>${noFood ? '待记录' : signedWithCommas(actual)}</strong>${noFood ? '' : '<span>kcal</span>'}<em>目标 ${fmtInt(target)}</em>
          </div>
        </div>
        <span class="status-chip ${statusClass}">${statusLabel}</span>
      </div>
      <p class="deficit-formula">${formula}</p>
      <div class="deficit-track-wrap">
        <div class="deficit-track"><i class="${isNegative || noFood ? 'is-empty' : (actual > target ? 'is-over' : '')}" style="width:${pct.toFixed(1)}%"></i></div>
        <div class="deficit-scale"><span>0</span><span>目标 ${fmtInt(target)} kcal</span></div>
      </div>
      <div class="deficit-foot">
        <span>${footText}</span>
        <button type="button" data-action="show-calc">${icon('info')}计算说明</button>
      </div>
    </article>`;
  }

  function renderExerciseCheck(stats) {
    const weekly = getWeeklyExerciseStats();
    const profile = state.data.profile;
    const dailyTarget = profile.dailyMinutes;
    const weeklyTarget = profile.weeklyMinutes;
    const strengthTarget = profile.strengthGoal;
    const todayMinutes = Math.round(stats.exercises.reduce((sum, entry) => sum + finite(entry.minutes), 0));
    const outMinutes = Math.round(stats.exercises.filter((entry) => entry.env === 'outdoor').reduce((sum, entry) => sum + finite(entry.minutes), 0));
    const inMinutes = todayMinutes - outMinutes;
    const dailyDone = todayMinutes >= dailyTarget;
    const weeklyDone = weekly.equivalence >= weeklyTarget;
    const strengthDone = weekly.strength >= strengthTarget;
    const checks = [
      {
        icon: 'activity',
        name: '今日活动',
        value: `${todayMinutes} / ${dailyTarget}`,
        unit: '分钟',
        pct: dailyTarget > 0 ? clamp(todayMinutes / dailyTarget * 100, 0, 100) : 100,
        done: dailyDone,
        state: dailyDone ? '已达标' : `还差 ${Math.max(0, dailyTarget - todayMinutes)} 分`
      },
      {
        icon: 'chart',
        name: '本周中高强度',
        value: `${weekly.equivalence} / ${weeklyTarget}`,
        unit: '等效分钟',
        pct: weeklyTarget > 0 ? clamp(weekly.equivalence / weeklyTarget * 100, 0, 100) : 100,
        done: weeklyDone,
        state: weeklyDone ? '已达标' : `还差 ${Math.max(0, weeklyTarget - weekly.equivalence)} 分`
      },
      ...(strengthTarget > 0 ? [{
        icon: 'bolt',
        name: '本周力量训练',
        value: `${weekly.strength} / ${strengthTarget}`,
        unit: '次',
        pct: clamp(weekly.strength / strengthTarget * 100, 0, 100),
        done: strengthDone,
        state: strengthDone ? '已达标' : `还差 ${Math.max(0, strengthTarget - weekly.strength)} 次`
      }] : [])
    ];
    const completed = checks.filter((item) => item.done).length;
    const totalItems = checks.length;
    const allDone = completed === totalItems;
    const splitPct = todayMinutes > 0 ? (outMinutes / todayMinutes) * 100 : 0;
    const title = todayMinutes > 0 ? `今天动了 ${todayMinutes} 分钟` : '今天还没有动起来';

    return `<section class="section">
      ${sectionHead(
        '运动量是否达标',
        '参考 WHO 成人活动建议：每周 150–300 分钟中等强度 + 2 次力量训练',
        `<button class="text-action" type="button" data-action="open-profile">调整目标${icon('chevron')}</button>`
      )}
      <div class="card check-card">
        <div class="check-head">
          <div>
            <h3 class="check-title">${title}</h3>
            <p class="check-sub">${inMinutes || outMinutes ? `室外 ${outMinutes} 分钟 · 室内 ${inMinutes} 分钟` : '可以是一段快走，也可以是一组力量训练'}</p>
          </div>
          <span class="pill ${allDone ? 'pill-lime' : 'pill-ghost'} check-badge">${completed}/${totalItems} 达标</span>
        </div>
        <div class="env-split">
          <div class="env-split-top">
            <strong>${fmtInt(todayMinutes)}<span> 分钟</span></strong>
            <span>今日活动 · 室内外分列</span>
          </div>
          <div class="env-split-bar" aria-hidden="true">
            <i class="split-out" style="width:${splitPct.toFixed(1)}%"></i>
            <i class="split-in" style="width:${todayMinutes > 0 ? (100 - splitPct).toFixed(1) : 0}%"></i>
          </div>
          <div class="env-split-legend">
            <span><i class="dot-out"></i>室外 ${outMinutes} 分钟</span>
            <span><i class="dot-in"></i>室内 ${inMinutes} 分钟</span>
          </div>
        </div>
        <div class="requirements">
          ${checks.map((item) => `<div class="req-row${item.done ? ' is-done' : ''}">
            <span class="req-icon">${item.done ? icon('check') : icon(item.icon)}</span>
            <span class="req-copy">
              <span class="req-name"><strong>${item.name}</strong><span>${item.value} ${item.unit}</span></span>
              <span class="req-bar"><i style="width:${item.pct.toFixed(1)}%"></i></span>
            </span>
            <span class="req-state">${item.state}</span>
          </div>`).join('')}
        </div>
        <div class="check-note">
          <span>等效分钟：轻松 ×0.5，中强度 ×1，高强度 ×2</span>
          <button type="button" data-action="record-exercise">${icon('plus')}记录</button>
        </div>
      </div>
    </section>`;
  }

  function renderSupplement(stats, status) {
    const profile = state.data.profile;
    const now = new Date();
    const isToday = stats.key === dateKey();
    const dinnerLogged = (stats.foods || []).some((entry) => entry.meal === 'dinner');
    const earlyWithDinnerAhead = isToday && now.getHours() < 18 && !dinnerLogged;

    let tone = 'is-muted';
    let iconName = 'compass';
    let title = '';
    let text = '';
    let amount = 0;
    let amountUnit = '';
    let options = '';
    let secondary = '';

    if (!stats.hasFood) {
      title = '先记一笔饮食，才知道缺口';
      text = '没有摄入记录时，任何“缺口”都只是猜测。记下今天吃过的东西，轻衡会自动和消耗对上。';
      tone = 'is-muted';
      iconName = 'bowl';
      options = `<button class="supplement-link" type="button" data-action="add-food" data-meal="${defaultMealForNow()}">${icon('plus')}去记录饮食${icon('chevron')}</button>`;
    } else if (status.tone === 'over') {
      tone = 'is-low';
      iconName = 'alert';
      title = '今天没有缺口，不用补偿性运动';
      text = `已摄入比总消耗多 ${fmtInt(status.surplus)} kcal。一顿吃多不会毁掉进度，下一餐照常吃、照常记就好。`;
      amount = status.surplus;
      amountUnit = 'kcal 盈余';
    } else if (status.tone === 'low') {
      const gap = status.need;
      const lateNight = isToday && (now.getHours() >= 22 || now.getHours() < 5);
      if (lateNight) {
        tone = 'is-muted';
        iconName = 'clock';
        title = '今天差一点，不必熬夜补';
        text = `当前缺口比目标少 ${fmtInt(gap)} kcal。单日波动不会改变长期趋势，今晚不建议再追加高强度运动。`;
        amount = gap;
        amountUnit = 'kcal 差值';
        secondary = '把睡眠留够，明天照常记录、照常安排运动。不要为了补数字跳过下一餐。';
      } else {
        tone = 'is-low';
        iconName = 'bolt';
        const suggestions = suggestExercisesForGap(gap);
        title = '还差一点，动一动就能补上';
        text = earlyWithDinnerAhead
          ? '今天还没结束。可以先按下面的建议动一动，也可以把晚餐的主食略减一点，不需要跳过整餐。'
          : '不用一次做很猛，选一个你愿意开始的强度。记录后，消耗和缺口会立即更新。';
        amount = gap;
        amountUnit = 'kcal 待补';
        options = `<div class="supplement-options">
          ${suggestions.map((item) => `<button class="supplement-option" type="button" data-action="prefill-exercise" data-exercise="${item.exercise.id}" data-minutes="${item.minutes}" data-env="${item.env}" aria-label="记录${item.exercise.name}约 ${item.minutes} 分钟">
            <span class="supplement-option-icon" aria-hidden="true">${item.exercise.emoji}</span>
            <span class="supplement-option-main">
              <span class="supplement-option-name">${esc(item.exercise.name)}<span class="badge badge-env">${item.env === 'outdoor' ? '室外' : '室内'}</span></span>
              <span class="supplement-option-meta">约 ${item.minutes} 分钟 · 按中等强度估算</span>
            </span>
            <span class="supplement-option-add">${icon('plus')}</span>
          </button>`).join('')}
        </div>`;
        secondary = '不想运动也可以把下一餐主食减到半碗，大约少 90–120 kcal；不建议用跳过整餐来追缺口。';
      }
    } else if (status.tone === 'high') {
      const missingMain = stats.missingMainMeals.length > 0;
      if (missingMain) {
        tone = 'is-muted';
        iconName = 'clock';
        title = earlyWithDinnerAhead ? '缺口暂时偏大，晚餐还有位置' : '缺口偏大，但还有餐没记录';
        const missingText = stats.missingMainMeals.map(findMealName).join('、');
        text = `当前数字只基于已经记下的饮食，${missingText}还没记录，缺口可能被高估。先补齐记录或按建议食谱安排下一餐，再决定要不要补。`;
        const firstMissing = stats.missingMainMeals[0];
        options = `<div class="supplement-options">
          <button class="supplement-option" type="button" data-action="add-food" data-meal="${firstMissing}">
            <span class="supplement-option-icon" aria-hidden="true">${MEAL_MAP[firstMissing].emoji}</span>
            <span class="supplement-option-main">
              <span class="supplement-option-name">补记${findMealName(firstMissing)}</span>
              <span class="supplement-option-meta">把没记的饮食补齐，缺口才可信</span>
            </span>
            <span class="supplement-option-add">${icon('plus')}</span>
          </button>
          <button class="supplement-option" type="button" data-action="scroll-recipes">
            <span class="supplement-option-icon" aria-hidden="true">🥗</span>
            <span class="supplement-option-main">
              <span class="supplement-option-name">看看接下来的建议餐盘</span>
              <span class="supplement-option-meta">按剩余预算搭配，优先蛋白质</span>
            </span>
            <span class="supplement-option-add">${icon('chevron')}</span>
          </button>
        </div>`;
        secondary = '如果今天确实只吃了这些，不用一次把缺口补回来；先观察是否饥饿，避免连续多日出现很大的缺口。';
      } else {
        tone = 'is-high';
        iconName = 'sparkle';
        const recommended = clamp(status.excess, 150, 350);
        title = '缺口偏大，补一点更稳';
        text = `比目标多出 ${fmtInt(status.excess)} kcal。不用一次补齐；先补一份约 ${fmtInt(recommended)} kcal 的蛋白质和主食，别让身体长期挨饿。`;
        amount = recommended;
        amountUnit = 'kcal 一份';
        const combos = findSupplementCombos(recommended);
        options = `<div class="supplement-options">
          ${combos.map((combo) => {
            const names = combo.recipes.map((recipe) => recipe.name).join(' + ');
            const emojis = combo.recipes.map((recipe) => recipe.emoji).join('');
            return `<button class="supplement-option" type="button" data-action="log-snack-combo" data-ids="${combo.ids.join(',')}" aria-label="记录补给 ${esc(names)}">
              <span class="supplement-option-icon" aria-hidden="true">${emojis}</span>
              <span class="supplement-option-main">
                <span class="supplement-option-name">${esc(names)}</span>
                <span class="supplement-option-meta">约 ${fmtInt(combo.kcal)} kcal · 蛋白 ${fmtNum(combo.protein)} g</span>
              </span>
              <span class="supplement-option-add">${icon('plus')}</span>
            </button>`;
          }).join('')}
        </div>`;
        secondary = '如果不饿，不必硬吃；把这份补给拆到下一餐也可以。避免连续多日出现很大的缺口。';
      }
    } else if (status.tone === 'good') {
      tone = 'is-good';
      iconName = 'check';
      title = '缺口落在目标附近，刚刚好';
      text = `当前缺口 ${fmtInt(stats.actualDeficit)} kcal，接近目标 ${fmtInt(stats.targetDeficit)} kcal。保持节奏，不需要额外补偿。`;
      amount = stats.targetDeficit;
      amountUnit = 'kcal 目标';
    }

    return `<section class="section">
      ${sectionHead('热量缺口补充', '根据当前记录，给出“吃”或“动”的下一步', '')}
      <div class="supplement-card ${tone}">
        <div class="supplement-head">
          <span class="supplement-icon">${icon(iconName)}</span>
          <div class="supplement-copy">
            <h3 class="supplement-title">${title}</h3>
            <p class="supplement-text">${text}</p>
          </div>
          ${amount ? `<div class="supplement-amount"><strong>${fmtInt(amount)}</strong><span>${amountUnit}</span></div>` : ''}
        </div>
        ${options}
        ${secondary ? `<p class="supplement-secondary">${icon('info')}<span>${secondary}</span></p>` : ''}
      </div>
    </section>`;
  }

  function fmtNum(value) {
    const n = round(finite(value), 1);
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function renderRecipeSection(stats) {
    const plan = buildMealPlan(stats);
    const diet = state.data.profile.diet;
    const prefButtons = DIETS.map((item) => `<button class="pref-chip${diet === item.id ? ' is-active' : ''}" type="button" data-action="set-diet" data-diet="${item.id}" aria-pressed="${diet === item.id}">${item.label}</button>`).join('');
    let content = '';

    if (plan.error === 'all-logged') {
      content = `<div class="plan-empty">
        <strong>今天的餐次都记录完整了</strong>
        <p>不再额外推荐食谱。去 7 日趋势里看看最近的缺口节奏吧。</p>
      </div>`;
    } else if (plan.error === 'no-upcoming') {
      content = `<div class="plan-empty">
        <strong>接下来的餐次都记录过了</strong>
        <p>如果有漏记的早餐或午餐，可以到“摄入”里补记；剩下的餐次按需安排就好。</p>
      </div>`;
    } else if (plan.error === 'no-budget') {
      content = `<div class="plan-empty">
        <strong>今天预算已经用完</strong>
        <p>不再硬凑一份食谱。下一餐优先选择蛋白质和蔬菜，照实记录就好；不要把补偿留到明天过度节食。</p>
      </div>`;
    } else if (plan.error === 'tight-budget') {
      content = `<div class="plan-empty">
        <strong>剩余预算不多，不再硬凑一整餐</strong>
        <p>优先选蛋白质和蔬菜，按实际需要少量补充；不必为了套食谱超出预算。饿了就吃点，记下来即可。</p>
      </div>`;
    } else if (plan.error === 'no-match') {
      content = `<div class="plan-empty">
        <strong>暂时没搭出合适的食谱</strong>
        <p>换一个饮食偏好，或先把餐次记完整，再来看看。</p>
      </div>`;
    } else if (plan.error) {
      content = `<div class="plan-empty"><strong>还没有足够的参考信息</strong><p>先记录一餐，再来生成建议。</p></div>`;
    } else {
      const coverage = plan.remaining > 0 ? clamp((plan.kcal / plan.remaining) * 100, 0, 100) : 0;
      const isOverPlan = plan.diff > 25;
      const circumference = 2 * Math.PI * 18;
      const offset = circumference * (1 - coverage / 100);
      const summaryTitle = `已为你搭配 ${plan.entries.length} 餐`;
      const summaryMeta = `热量 ${fmtInt(plan.kcal)} kcal · 蛋白质 ${fmtNum(plan.protein)} g`;
      const omittedMeals = Math.max(0, plan.slots.length - plan.entries.length);
      let deltaText = '';
      if (plan.diff > 25) {
        deltaText = `这套搭配比剩余预算多 ${fmtInt(plan.diff)} kcal。可以少盛一点主食，或把其中一餐分成两次吃。`;
      } else if (plan.diff < -80) {
        deltaText = `这套搭配比剩余预算少 ${fmtInt(Math.abs(plan.diff))} kcal，留了一点弹性；按饥饿感吃就好，不必把预算刚好用满。`;
      } else {
        deltaText = '这套搭配和剩余预算刚好合拍，不需要额外补或减。';
      }
      if (omittedMeals > 0) {
        deltaText = `剩余预算较紧，这套先安排了 ${plan.entries.length} 餐，未安排的餐次可以不硬凑。${deltaText}`;
      }
      const cards = plan.entries.map(({ slot, recipe }) => {
        const meal = MEAL_MAP[slot];
        return `<button class="recipe-card" type="button" data-action="open-recipe" data-recipe="${recipe.id}" data-slot="${slot}" aria-label="查看 ${esc(recipe.name)} 的做法">
          <span class="recipe-thumb" aria-hidden="true">${recipe.emoji}</span>
          <span class="recipe-main">
            <span class="recipe-slot">${meal.emoji} ${meal.name}建议</span>
            <span class="recipe-name">${esc(recipe.name)}</span>
            <span class="recipe-meta">
              <strong>${fmtInt(recipe.kcal)}</strong> kcal <i></i>
              <span>蛋白 ${fmtNum(recipe.protein)} g</span> <i></i>
              <span>${recipe.minutes} 分钟</span>
            </span>
          </span>
          <span class="recipe-arrow">${icon('chevron')}</span>
        </button>`;
      }).join('');
      content = `<div class="plan-toolbar">
        <div class="pref-scroller" aria-label="食谱偏好">${prefButtons}</div>
      </div>
      <div class="plan-summary">
        <div class="plan-summary-ring${isOverPlan ? ' is-over' : ''}" aria-hidden="true">
          <svg viewBox="0 0 44 44">
            <circle class="ps-track" cx="22" cy="22" r="18"></circle>
            <circle class="ps-progress" cx="22" cy="22" r="18" style="stroke-dasharray:${circumference.toFixed(2)};stroke-dashoffset:${offset.toFixed(2)}"></circle>
          </svg>
          <span>${isOverPlan ? '超' : Math.round(coverage) + '%'}</span>
        </div>
        <div class="plan-summary-copy">
          <p class="plan-summary-title">${summaryTitle}</p>
          <p class="plan-summary-meta">${summaryMeta} · 剩余预算 ${fmtInt(Math.max(0, plan.remaining))} kcal</p>
        </div>
        <div class="plan-summary-side">${fmtInt(plan.kcal)}<br><small>kcal</small></div>
      </div>
      <div class="recipe-list">${cards}</div>
      <div class="recipe-delta">${icon('info')}<span>${deltaText}</span></div>`;
    }

    return `<section class="section" id="recipeSection">
      ${sectionHead(
        '建议食谱',
        plan.error ? '按你的剩余热量与饮食偏好搭配' : '按接下来还可能吃的餐次搭配，优先蛋白质',
        `<button class="text-action" type="button" data-action="swap-plan" ${!plan || plan.error || plan.variantCount <= 1 ? 'disabled' : ''}>${icon('shuffle')}换一套</button>`
      )}
      ${content}
    </section>`;
  }

  function formatWeightChange(value) {
    const n = round(value, 2);
    if (Math.abs(n) < 0.005) return '0.00';
    return (n > 0 ? '+' : '−') + Math.abs(n).toFixed(2);
  }

  function buildChartData() {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const date = addDays(today, -i);
      const key = dateKey(date);
      const stats = getStats(key);
      days.push({
        key,
        date,
        label: WEEK_LABELS[(date.getDay() + 6) % 7].replace('周', ''),
        stats,
        hasData: stats.hasFood,
        deficit: stats.actualDeficit
      });
    }
    const logged = days.filter((day) => day.hasData);
    const average = logged.length ? logged.reduce((sum, day) => sum + day.deficit, 0) / logged.length : 0;
    const target = state.data.profile ? calcEnergy(state.data.profile).deficit : 0;
    return { days, logged, average, target };
  }

  function renderTrendChart() {
    const data = buildChartData();
    const { days, logged, average, target } = data;
    const width = 340;
    const height = 155;
    const zeroY = 99;
    const top = 22;
    const chartHeight = 77;
    const maxPositive = Math.max(
      100,
      target * 1.35,
      ...days.filter((day) => day.hasData && day.deficit > 0).map((day) => day.deficit)
    );
    const maxValue = Math.max(maxPositive, 100);
    const targetY = zeroY - clamp(target / maxValue, 0, 1) * chartHeight;
    const columnWidth = width / 7;
    const todayKey = dateKey();
    const bars = days.map((day, index) => {
      const xCenter = columnWidth * (index + 0.5);
      const barWidth = 20;
      const x = xCenter - barWidth / 2;
      let barMarkup = '';
      let valueMarkup = '';
      if (!day.hasData) {
        barMarkup = `<rect class="chart-bar is-empty" x="${x}" y="${zeroY - 3}" width="${barWidth}" height="3" rx="1.5"></rect>`;
        valueMarkup = `<text x="${xCenter}" y="${zeroY - 10}" text-anchor="middle">—</text>`;
      } else if (day.deficit < 0) {
        const h = Math.max(7, Math.min(16, Math.abs(day.deficit) / maxValue * chartHeight));
        barMarkup = `<rect class="chart-bar is-over" x="${x}" y="${zeroY}" width="${barWidth}" height="${h}" rx="3"></rect>`;
        valueMarkup = `<text x="${xCenter}" y="${zeroY + h + 11}" text-anchor="middle" fill="#c55f45">${signedWithCommas(day.deficit)}</text>`;
      } else {
        const h = Math.max(4, clamp(day.deficit / maxValue, 0, 1) * chartHeight);
        const tone = day.deficit >= target * 0.85 ? 'is-good' : 'is-low';
        barMarkup = `<rect class="chart-bar ${tone}" x="${x}" y="${zeroY - h}" width="${barWidth}" height="${h}" rx="7"></rect>`;
        valueMarkup = `<text x="${xCenter}" y="${Math.max(10, zeroY - h - 5)}" text-anchor="middle">${fmtInt(day.deficit)}</text>`;
      }
      return `<g>${barMarkup}${valueMarkup}
        <text x="${xCenter}" y="139" text-anchor="middle" class="${day.key === todayKey ? 'is-today' : ''}">${day.key === todayKey ? '今天' : day.label}</text>
      </g>`;
    }).join('');

    const averageText = logged.length >= 2 ? fmtInt(average) : '—';
    const weeklyChange = logged.length >= 2 ? -average * 7 / 7700 : 0;
    const averageLabel = logged.length >= 2 ? '记录日均缺口' : `已记录 ${logged.length} 天`;
    const chartSub = `虚线为目标缺口 · 已记录 ${logged.length}/7 天${logged.length < 2 ? ' · 再记几天更有参考' : ''}`;
    const chartLabel = `近 7 天热量缺口：${days.map((day) => `${day.label}${day.hasData ? fmtInt(day.deficit) + '千卡' : '未记录'}`).join('，')}。目标 ${target} 千卡。`;

    return `<section class="section">
      ${sectionHead('近 7 天缺口节奏', '单日有波动很正常，观察平均值更有意义', '')}
      <div class="card chart-card">
        <div class="chart-head">
          <div>
            <div class="chart-title">每日缺口</div>
            <p class="chart-sub">${chartSub}</p>
          </div>
          <div class="chart-average">
            <strong>${averageText}</strong>
            <span>${averageLabel}</span>
          </div>
        </div>
        <div class="chart-wrap">
          <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(chartLabel)}">
            <line x1="0" y1="${zeroY}" x2="${width}" y2="${zeroY}" stroke="rgba(23,58,50,.08)" stroke-width="1"></line>
            <line class="chart-goal" x1="0" y1="${targetY.toFixed(1)}" x2="${width}" y2="${targetY.toFixed(1)}"></line>
            <text class="chart-goal-label" x="4" y="${Math.max(8, targetY - 4).toFixed(1)}">目标 ${fmtInt(target)}</text>
            ${bars}
          </svg>
        </div>
        <div class="chart-legend">
          <span><i class="legend-good"></i>达到目标</span>
          <span><i class="legend-low"></i>低于目标</span>
          <span><i class="legend-over"></i>摄入超过消耗</span>
          <span><i class="legend-empty"></i>未记录饮食</span>
        </div>
        <div class="trend-stats">
          <div class="trend-stat">
            <span>${logged.length >= 2 ? '记录日均缺口' : '还需要更多记录'}</span>
            <strong>${averageText} <small>${logged.length >= 2 ? 'kcal' : ''}</small></strong>
          </div>
          <div class="trend-stat">
            <span>按缺口估算每周变化</span>
            <strong>${logged.length >= 3 ? formatWeightChange(weeklyChange) + ' <small>kg</small>' : '再记 ' + Math.max(0, 3 - logged.length) + ' 天'}</strong>
          </div>
        </div>
      </div>
    </section>`;
  }

  function renderPlan() {
    const stats = getStats();
    const status = getDeficitStatus(stats);
    return `${pageHead(
      `${greeting()} · ${dateLabel()}`,
      '把缺口，看得清楚一点。',
      '摄入和消耗都是估算，缺口是它们的差值。看趋势，不用为单日数字责备自己。',
      'planTitle'
    )}
    ${renderDeficitHero(stats, status)}
    ${renderExerciseCheck(stats)}
    ${renderSupplement(stats, status)}
    ${renderRecipeSection(stats)}
    ${renderTrendChart()}
    <div class="intake-note">
      ${icon('info')}
      <span>轻衡提供的是估算与行为参考，不构成医疗或营养处方。孕期、哺乳期、慢性病或进食障碍史人群，请先咨询医生或注册营养师。</span>
    </div>`;
  }

  // ---------------- Rendering shell ----------------

  function renderView(view) {
    if (!state.data.profile) return;
    if (view === 'intake') {
      $('#view-intake').innerHTML = renderIntake();
    } else if (view === 'burn') {
      $('#view-burn').innerHTML = renderBurn();
    } else if (view === 'plan') {
      $('#view-plan').innerHTML = renderPlan();
    }
  }

  function renderViews() {
    // Only rebuild what the person is looking at. The hidden tabs are rendered
    // lazily on navigation, so logging a meal doesn't run the recipe planner.
    renderView(state.view);
  }

  function setView(view, options = {}) {
    const allowed = ['intake', 'burn', 'plan'];
    const next = allowed.includes(view) ? view : 'intake';
    state.view = next;
    const sections = $$('.view');
    sections.forEach((section) => {
      section.hidden = section.dataset.view !== next;
    });
    renderView(next);
    $$('.tab').forEach((tab) => {
      const active = tab.dataset.tab === next;
      tab.classList.toggle('is-active', active);
      if (active) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    if (options.scroll !== false) {
      window.scrollTo({ top: 0, behavior: options.smooth ? 'smooth' : 'auto' });
    }
  }

  function syncViewFromHash(options = {}) {
    const hash = window.location.hash.replace('#', '');
    const view = ['intake', 'burn', 'plan'].includes(hash) ? hash : 'intake';
    if (hash !== view) {
      history.replaceState(null, '', '#' + view);
    }
    setView(view, options);
  }

  // ---------------- Toast and sheets ----------------

  function showToast(message, options = {}) {
    const root = $('#toastRoot');
    if (!root) return;
    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
      state.toastTimer = null;
    }
    root.innerHTML = `<div class="toast" role="status">
      <span class="toast-icon">${icon('check')}</span>
      <span class="toast-text">${esc(message)}</span>
      ${options.actionLabel ? `<button class="toast-action" type="button">${esc(options.actionLabel)}</button>` : ''}
    </div>`;
    const toast = root.firstElementChild;
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    if (options.actionLabel && typeof options.onAction === 'function') {
      const action = $('.toast-action', toast);
      if (action) {
        action.addEventListener('click', () => {
          toast.remove();
          if (state.toastTimer) clearTimeout(state.toastTimer);
          options.onAction();
        }, { once: true });
      }
    }
    state.toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 260);
    }, options.duration || 3000);
  }

  function openSheet(config) {
    const root = $('#sheetRoot');
    if (!root) return;
    if (state.sheetCloseTimer) {
      clearTimeout(state.sheetCloseTimer);
      state.sheetCloseTimer = null;
    }
    const wasOpen = Boolean($('.sheet', root));
    const previousFocus = wasOpen ? state.lastFocus : document.activeElement;
    state.lastFocus = previousFocus;
    state.activeSheet = config;
    state.sheetOpen = true;
    document.body.classList.add('sheet-open');
    const appShell = $('#app');
    if (appShell) {
      appShell.inert = true;
      appShell.setAttribute('aria-hidden', 'true');
    }

    const footer = config.footer ? `<footer class="sheet-foot">${config.footer}</footer>` : '';
    root.innerHTML = `<div class="sheet-backdrop" data-sheet-close></div>
      <section class="sheet${wasOpen ? ' is-open' : ''}" role="dialog" aria-modal="true" aria-labelledby="sheetTitle" tabindex="-1">
        <div class="sheet-grabber" aria-hidden="true"></div>
        <header class="sheet-head">
          ${config.back ? `<button class="sheet-back" type="button" data-sheet-back aria-label="返回">${icon('arrow-left')}</button>` : '<span class="sheet-head-spacer"></span>'}
          <div class="sheet-head-main">
            <h2 class="sheet-title" id="sheetTitle">${esc(config.title || '')}</h2>
            ${config.subtitle ? `<p class="sheet-subtitle">${esc(config.subtitle)}</p>` : ''}
          </div>
          <button class="sheet-close" type="button" data-sheet-close aria-label="关闭">${icon('close')}</button>
        </header>
        <div class="sheet-body${config.flush ? ' is-flush' : ''}" id="sheetBody">${config.content || ''}</div>
        ${footer}
      </section>`;
    root.classList.add('is-open');
    root.classList.remove('is-closing');
    if (!wasOpen) {
      const sheet = $('.sheet', root);
      requestAnimationFrame(() => sheet.classList.add('is-open'));
    }
    const sheet = $('.sheet', root);
    if (config.back) {
      const backButton = $('[data-sheet-back]', sheet);
      if (backButton) {
        backButton.addEventListener('click', () => {
          if (typeof config.back === 'function') config.back();
        });
      }
    }
    if (typeof config.onMount === 'function') {
      config.onMount(sheet);
    }
    requestAnimationFrame(() => {
      if (document.activeElement && document.activeElement.closest('.sheet')) return;
      sheet.focus({ preventScroll: true });
    });
  }

  function closeSheet(immediate = false) {
    const root = $('#sheetRoot');
    if (!root || !state.sheetOpen) return;
    if (state.sheetCloseTimer) {
      clearTimeout(state.sheetCloseTimer);
      state.sheetCloseTimer = null;
    }
    state.sheetOpen = false;
    const active = state.activeSheet;
    state.activeSheet = null;
    const finish = () => {
      root.innerHTML = '';
      root.classList.remove('is-open', 'is-closing');
      document.body.classList.remove('sheet-open');
      const appShell = $('#app');
      if (appShell) {
        appShell.inert = false;
        appShell.removeAttribute('aria-hidden');
      }
      if (typeof active?.onClose === 'function') active.onClose();
      if (state.lastFocus && typeof state.lastFocus.focus === 'function') {
        state.lastFocus.focus({ preventScroll: true });
      }
      state.lastFocus = null;
    };
    if (immediate) {
      finish();
      return;
    }
    root.classList.add('is-closing');
    root.classList.remove('is-open');
    state.sheetCloseTimer = setTimeout(() => {
      state.sheetCloseTimer = null;
      finish();
    }, 280);
  }

  function trapSheetFocus(event) {
    if (!state.sheetOpen) return;
    const sheet = $('.sheet');
    if (!sheet) return;
    const focusable = $$('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])', sheet)
      .filter((element) => element.offsetParent !== null || element === document.activeElement);
    if (!focusable.length) {
      event.preventDefault();
      sheet.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  // ---------------- Plan actions ----------------

  function incrementPlanVariant() {
    const day = getDay(dateKey(), true);
    const plan = buildMealPlan(getStats());
    day.planVariant = (Math.max(0, Math.round(finite(day.planVariant, 0))) + 1) % Math.max(1, plan.variantCount || 1);
    saveState();
    renderViews();
  }

  function setDiet(diet) {
    if (!DIETS.some((item) => item.id === diet)) return;
    state.data.profile.diet = diet;
    saveState();
    renderViews();
  }

  function addRecipeEntryToMeal(recipe, meal, qty = 1) {
    const day = getDay(dateKey(), true);
    day.foods.push({
      id: uid('food'),
      name: recipe.name,
      emoji: recipe.emoji,
      source: 'recipe',
      meal,
      qty,
      unit: '份',
      base: {
        kcal: recipe.kcal,
        p: recipe.protein,
        c: recipe.carbs,
        f: recipe.fat
      },
      recipeId: recipe.id,
      foodId: null,
      time: nowTime()
    });
    return day;
  }

  function logSnackCombo(ids) {
    const recipes = ids.map((id) => RECIPE_MAP[id]).filter(Boolean);
    if (!recipes.length) return;
    recipes.forEach((recipe) => addRecipeEntryToMeal(recipe, 'snack', 1));
    saveState();
    renderViews();
    closeSheet(true);
    showToast(`已补充 ${recipes.map((recipe) => recipe.name).join(' + ')}`);
  }

  // ---------------- Onboarding ----------------

  function openOnboarding() {
    const root = $('#onboardingRoot');
    if (!root) return;
    onboardingDraft = {
      sex: '',
      age: '',
      height: '',
      currentWeight: '',
      targetWeight: '',
      activity: 'sedentary',
      pace: 0.5
    };
    const activityCards = Object.entries(ACTIVITY).map(([key, item]) => `<button class="choice-card${key === onboardingDraft.activity ? ' is-active' : ''}" type="button" data-ob-activity="${key}" aria-pressed="${key === onboardingDraft.activity}">
      <span class="choice-radio" aria-hidden="true"></span>
      <span class="choice-copy">
        <span class="choice-title">${item.label}<small>×${item.factor}</small></span>
        <span class="choice-desc">${item.desc}</span>
      </span>
    </button>`).join('');
    const paceCards = PACES.map((item) => `<button class="choice-card${item.value === onboardingDraft.pace ? ' is-active' : ''}" type="button" data-ob-pace="${item.value}" aria-pressed="${item.value === onboardingDraft.pace}">
      <span class="choice-radio" aria-hidden="true"></span>
      <span class="choice-copy">
        <span class="choice-title">${item.label}<small>${item.desc}</small></span>
      </span>
    </button>`).join('');

    root.innerHTML = `<div class="onboarding" role="dialog" aria-modal="true" aria-labelledby="obTitle">
      <div class="onboarding-inner">
        <div class="ob-top">
          <a class="brand" href="#intake" aria-label="轻衡">
            <span class="brand-mark">${icon('leaf')}</span>
            <span class="brand-word">轻衡<small>LIGHTBALANCE</small></span>
          </a>
          <span class="local-pill">${icon('home')}只存本机</span>
        </div>
        <section class="ob-hero">
          <p class="ob-kicker">${icon('sparkle')}你的减脂能量账本</p>
          <h1 class="ob-title" id="obTitle">把减脂，变成一本<em>看得懂</em>的账。</h1>
          <p class="ob-lead">不追求算得分毫不差，只让你每天知道：吃了多少、动了多少、缺口还差多少，以及下一步可以怎么做。</p>
          <div class="ob-values">
            <span class="ob-value">${icon('bowl')}摄入有数</span>
            <span class="ob-value">${icon('sun')}室内外分开</span>
            <span class="ob-value">${icon('compass')}缺口有对策</span>
          </div>
        </section>
        <form id="onboardingForm" novalidate>
          <div class="ob-form-card">
            <section class="ob-section">
              <div class="ob-section-head">
                <span class="ob-num">01</span>
                <div><h2 class="ob-section-title">先认识你</h2><p class="ob-section-sub">只用于估算基础代谢，不会上传到任何服务器。</p></div>
              </div>
              <div class="field-grid">
                <div class="field is-full">
                  <span class="field-label" id="sexLabel">生理性别</span>
                  <div class="segmented" role="group" aria-labelledby="sexLabel">
                    <button type="button" data-ob-sex="female" aria-pressed="false">女性</button>
                    <button type="button" data-ob-sex="male" aria-pressed="false">男性</button>
                  </div>
                </div>
                <div class="field">
                  <label for="obAge">年龄</label>
                  <div class="input-wrap"><input class="input has-unit" id="obAge" name="age" type="number" inputmode="numeric" min="18" max="75" placeholder="例如 28" autocomplete="off"><span class="input-unit">岁</span></div>
                </div>
                <div class="field">
                  <label for="obHeight">身高</label>
                  <div class="input-wrap"><input class="input has-unit" id="obHeight" name="height" type="number" inputmode="decimal" min="130" max="220" step="0.5" placeholder="例如 165" autocomplete="off"><span class="input-unit">cm</span></div>
                </div>
                <div class="field">
                  <label for="obWeight">当前体重</label>
                  <div class="input-wrap"><input class="input has-unit" id="obWeight" name="currentWeight" type="number" inputmode="decimal" min="35" max="250" step="0.1" placeholder="例如 62.0" autocomplete="off"><span class="input-unit">kg</span></div>
                </div>
                <div class="field">
                  <label for="obTarget">目标体重</label>
                  <div class="input-wrap"><input class="input has-unit" id="obTarget" name="targetWeight" type="number" inputmode="decimal" min="35" max="250" step="0.1" placeholder="例如 55.0" autocomplete="off"><span class="input-unit">kg</span></div>
                </div>
              </div>
            </section>
            <section class="ob-section">
              <div class="ob-section-head">
                <span class="ob-num">02</span>
                <div><h2 class="ob-section-title">日常是什么节奏</h2><p class="ob-section-sub">这里只算日常生活，不含专门运动，避免和手表重复。</p></div>
              </div>
              <div class="choice-list">${activityCards}</div>
            </section>
            <section class="ob-section">
              <div class="ob-section-head">
                <span class="ob-num">03</span>
                <div><h2 class="ob-section-title">想用多快的速度</h2><p class="ob-section-sub">不追求最快。缺口会被限制在安全范围内。</p></div>
              </div>
              <div class="choice-list ob-pace">${paceCards}</div>
            </section>
            <div id="obSummary" class="summary-panel"><div class="summary-placeholder">填完上面的基础数据，这里会实时算出你的饮食预算。</div></div>
            <div class="form-error" id="obError" role="alert">${icon('alert')}<span></span></div>
            <button class="btn btn-primary ob-submit" type="submit">${icon('sparkle')}生成我的减脂计划</button>
            <p class="safety-note">${icon('info')}<span>建议每周减重不超过体重的 1%。本工具面向 18–75 岁健康成年人；孕期、哺乳期、慢性病或进食障碍史人群请先咨询医生或营养师。</span></p>
            <p class="ob-footnote">所有记录保存在当前浏览器的 localStorage 中。清除浏览器数据会一并清除记录，可在“我的”里导出备份。</p>
          </div>
        </form>
      </div>
    </div>`;
    document.body.classList.add('onboarding-open');
    const appShell = $('#app');
    if (appShell) {
      appShell.inert = true;
      appShell.setAttribute('aria-hidden', 'true');
    }
    const onboardingPanel = $('.onboarding', root);
    if (onboardingPanel) onboardingPanel.scrollTop = 0;
    bindOnboarding();
    updateObSummary();
    requestAnimationFrame(() => {
      const heading = $('.ob-title', root);
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    });
  }

  function bindOnboarding() {
    const form = $('#onboardingForm');
    if (!form) return;
    form.addEventListener('input', (event) => {
      const input = event.target;
      if (input.name && Object.prototype.hasOwnProperty.call(onboardingDraft, input.name)) {
        onboardingDraft[input.name] = input.value;
        updateObSummary();
      }
    });
    form.addEventListener('click', (event) => {
      const sex = event.target.closest('[data-ob-sex]');
      if (sex) {
        onboardingDraft.sex = sex.dataset.obSex;
        $$('[data-ob-sex]', form).forEach((button) => {
          const active = button.dataset.obSex === onboardingDraft.sex;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        updateObSummary();
        return;
      }
      const activity = event.target.closest('[data-ob-activity]');
      if (activity) {
        onboardingDraft.activity = activity.dataset.obActivity;
        $$('[data-ob-activity]', form).forEach((button) => {
          const active = button.dataset.obActivity === onboardingDraft.activity;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        updateObSummary();
        return;
      }
      const pace = event.target.closest('[data-ob-pace]');
      if (pace) {
        onboardingDraft.pace = Number(pace.dataset.obPace);
        $$('[data-ob-pace]', form).forEach((button) => {
          const active = Number(button.dataset.obPace) === onboardingDraft.pace;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        updateObSummary();
      }
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitOnboarding();
    });
  }

  function readOnboardingDraft() {
    const form = $('#onboardingForm');
    if (!form) return { ...onboardingDraft };
    return {
      sex: onboardingDraft.sex,
      age: form.elements.age ? form.elements.age.value : '',
      height: form.elements.height ? form.elements.height.value : '',
      currentWeight: form.elements.currentWeight ? form.elements.currentWeight.value : '',
      targetWeight: form.elements.targetWeight ? form.elements.targetWeight.value : '',
      activity: onboardingDraft.activity,
      pace: onboardingDraft.pace
    };
  }

  function validateBodyDraft(draft) {
    const errors = [];
    const age = Number(draft.age);
    const height = Number(draft.height);
    const currentWeight = Number(draft.currentWeight);
    const targetWeight = Number(draft.targetWeight);
    if (!draft.sex) errors.push('请选择生理性别，基础代谢公式需要它。');
    if (!Number.isFinite(age) || age < 18 || age > 75) errors.push('年龄请填写 18–75 岁。');
    if (!Number.isFinite(height) || height < 130 || height > 220) errors.push('身高请填写 130–220 cm。');
    if (!Number.isFinite(currentWeight) || currentWeight < 35 || currentWeight > 250) errors.push('当前体重请填写 35–250 kg。');
    if (!Number.isFinite(targetWeight) || targetWeight < 35 || targetWeight > 250) errors.push('目标体重请填写 35–250 kg。');
    if (Number.isFinite(currentWeight) && Number.isFinite(targetWeight) && targetWeight >= currentWeight) {
      errors.push('目标体重需要低于当前体重；如果你想维持体重，这个工具并不适合。');
    }
    if (Number.isFinite(targetWeight) && Number.isFinite(height) && height > 0) {
      const targetBmi = targetWeight / Math.pow(height / 100, 2);
      if (targetBmi < 18.5) errors.push('目标 BMI 低于 18.5，过于激进，请把目标体重调高一些。');
    }
    if (Number.isFinite(currentWeight) && Number.isFinite(height) && Number.isFinite(age) && draft.sex) {
      const preview = calcEnergy({
        sex: draft.sex,
        age,
        height,
        currentWeight,
        targetWeight,
        activity: draft.activity,
        pace: draft.pace
      });
      if (preview.baseline < 1200 || preview.unsafe) {
        errors.push('按当前身体数据计算的基础消耗过低，不适合使用通用减脂公式，请咨询医生或营养师。');
      }
    }
    return { valid: errors.length === 0, errors, age, height, currentWeight, targetWeight };
  }

  function updateObSummary() {
    const draft = readOnboardingDraft();
    const summary = $('#obSummary');
    if (!summary) return;
    const hasCore = draft.sex && draft.age !== '' && draft.height !== '' && draft.currentWeight !== '' && draft.targetWeight !== '';
    if (!hasCore) {
      summary.innerHTML = '<div class="summary-placeholder">填完上面的基础数据，这里会实时算出你的饮食预算。</div>';
      return;
    }
    const temp = {
      sex: draft.sex,
      age: Number(draft.age),
      height: Number(draft.height),
      currentWeight: Number(draft.currentWeight),
      targetWeight: Number(draft.targetWeight),
      activity: draft.activity,
      pace: draft.pace
    };
    if (!Number.isFinite(temp.age) || !Number.isFinite(temp.height) || !Number.isFinite(temp.currentWeight)) {
      summary.innerHTML = '<div class="summary-placeholder">再检查一下年龄、身高和体重。</div>';
      return;
    }
    const energy = calcEnergy(temp);
    const tempTargetBmi = temp.height > 0 ? temp.targetWeight / Math.pow(temp.height / 100, 2) : 0;
    const invalidTarget = temp.targetWeight >= temp.currentWeight || tempTargetBmi < 18.5 || temp.age < 18 || temp.age > 75;
    const startBudget = Math.round(energy.baseline - energy.deficit);
    summary.innerHTML = `<div class="summary-panel-head"><span>你的初始计划</span><strong>${invalidTarget ? '先调整目标' : '运动另加预算'}</strong></div>
      <div class="summary-rows">
        <div class="summary-item"><span>日常消耗（不含运动）</span><strong>${fmtInt(energy.baseline)}<small> kcal</small></strong></div>
        <div class="summary-item"><span>每日目标缺口</span><strong>${fmtInt(energy.deficit)}<small> kcal</small></strong></div>
        <div class="summary-item"><span>起始饮食预算</span><strong>${fmtInt(startBudget)}<small> kcal</small></strong></div>
        <div class="summary-item"><span>预计每周变化</span><strong>−${energy.projectedWeekly.toFixed(2)}<small> kg</small></strong></div>
      </div>
      <div class="summary-callout">${icon('sparkle')}<span>${invalidTarget ? '目标体重或 BMI 需要调整后才能开始。' : energy.capped ? '为了不低于安全摄入下限，缺口已自动收紧；运动会额外增加可吃预算。' : '运动消耗会额外增加当天可吃预算；先不追求完美，保持记录更重要。'}</span></div>`;
  }

  function submitOnboarding() {
    const draft = readOnboardingDraft();
    const validation = validateBodyDraft(draft);
    const error = $('#obError');
    if (!validation.valid) {
      if (error) {
        error.classList.add('is-visible');
        error.querySelector('span').textContent = validation.errors[0];
        requestAnimationFrame(() => error.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      }
      showToast(validation.errors[0]);
      const firstField = $('#obAge');
      if (!draft.sex) {
        const sexGroup = $('[data-ob-sex]');
        if (sexGroup) sexGroup.focus();
      } else if (!Number.isFinite(Number(draft.age))) {
        firstField?.focus();
      }
      return;
    }
    const profile = {
      sex: draft.sex,
      age: validation.age,
      height: validation.height,
      currentWeight: validation.currentWeight,
      targetWeight: validation.targetWeight,
      activity: draft.activity,
      pace: draft.pace,
      diet: 'balanced',
      dailyMinutes: 30,
      weeklyMinutes: 150,
      strengthGoal: 2,
      createdAt: new Date().toISOString()
    };
    state.data = blankState();
    state.data.profile = profile;
    state.data.weights = [{ date: dateKey(), kg: profile.currentWeight }];
    saveState();
    const root = $('#onboardingRoot');
    if (root) root.innerHTML = '';
    document.body.classList.remove('onboarding-open');
    const appShell = $('#app');
    if (appShell) {
      appShell.inert = false;
      appShell.removeAttribute('aria-hidden');
    }
    onboardingDraft = null;
    history.replaceState(null, '', '#intake');
    setView('intake', { scroll: false });
    window.scrollTo({ top: 0, behavior: 'auto' });
    showToast('计划已生成。今天先记录一餐，就算开始。');
  }

  // ---------------- Profile / settings ----------------

  function isStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIosDevice() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  async function copyTextToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // Fall through to the legacy copy path.
    }
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      return copied;
    } catch (error) {
      return false;
    }
  }

  function appRootUrl() {
    return window.location.origin + window.location.pathname;
  }

  function renderInstallSettingsCard() {
    const installed = isStandaloneMode();
    const secure = window.isSecureContext;
    const title = installed ? '已安装到桌面' : secure ? '添加到手机桌面' : '安装需要 HTTPS 地址';
    const copy = installed
      ? '从桌面打开可全屏使用，数据仍然只在本机'
      : secure
        ? '全屏打开，和普通 App 一样；支持离线缓存'
        : '当前局域网 HTTP 可正常使用，但浏览器不会开放安装能力';
    return `<div class="settings-block">
      <div class="settings-heading">手机桌面 <span>${installed ? '已就绪' : 'PWA'}</span></div>
      <button class="install-card" type="button" data-action="open-install">
        <span class="install-icon">${icon(installed ? 'check' : 'install')}</span>
        <span class="install-card-copy"><strong>${title}</strong><span>${copy}</span></span>
        ${icon('chevron')}
      </button>
    </div>`;
  }

  function openInstallSheet() {
    const installed = isStandaloneMode();
    const secure = window.isSecureContext;
    const ios = isIosDevice();
    const hasPrompt = Boolean(deferredInstallPrompt);
    const statusClass = installed ? 'is-good' : '';
    let statusTitle = '';
    let statusCopy = '';
    let steps = [];
    let primary = '';

    if (installed) {
      statusTitle = '已经在桌面模式下运行';
      statusCopy = '现在打开的应该就是桌面图标版。数据仍然保存在当前浏览器里。';
    } else if (!secure) {
      statusTitle = '当前地址不支持安装';
      statusCopy = `局域网 HTTP 地址可以正常记录，但浏览器只会把它当普通网页。请使用部署后的 HTTPS 地址，或先手动添加到主屏幕作为快捷方式（不会有离线缓存）。`;
    } else if (hasPrompt) {
      statusTitle = '当前浏览器支持直接安装';
      statusCopy = '点下面的按钮，确认后就会出现在手机桌面。';
      primary = `<button class="btn btn-primary btn-block" type="button" id="installNowButton">${icon('install')}一键安装到桌面</button>`;
    } else if (ios) {
      statusTitle = '在 iPhone / iPad 上安装';
      statusCopy = '请用 Safari 打开本页，再通过分享菜单添加到主屏幕。';
      steps = [
        '确认当前是在 <strong>Safari</strong> 中打开，而不是微信等 App 的内置浏览器。',
        '点击底部或顶部的<strong>分享按钮</strong>（方框 + 向上箭头）。',
        '向下滑，选择<strong>“添加到主屏幕”</strong>。',
        '确认名称为“轻衡”，点右上角“添加”。'
      ];
    } else {
      statusTitle = '用浏览器菜单安装';
      statusCopy = '当前浏览器没有弹出自动安装入口，可以从浏览器菜单手动添加。';
      steps = [
        '点击浏览器右上角的<strong>菜单</strong>（Chrome 是三个点）。',
        '选择<strong>“安装应用”</strong>或<strong>“添加到主屏幕”</strong>。',
        '确认添加，之后从桌面打开“轻衡”。'
      ];
    }

    openSheet({
      kind: 'install',
      title: '安装到手机桌面',
      subtitle: '全屏打开 · 保留本地数据 · 可离线使用',
      back: () => openProfileSheet(),
      content: `<div class="install-hero">
        <span class="install-hero-icon">${icon(installed ? 'check' : 'install')}</span>
        <h3>${installed ? '轻衡已经在桌面上了' : '把轻衡放到手机桌面'}</h3>
        <p>安装的是这个网页本身，不经过应用商店。打开更快，记录仍然只保存在本机。</p>
      </div>
      <div class="install-status ${statusClass}">${icon(installed ? 'check' : secure ? 'info' : 'alert')}<span><strong>${statusTitle}</strong><br>${statusCopy}</span></div>
      ${steps.length ? `<div class="install-steps">${steps.map((step) => `<div class="install-step">${step}</div>`).join('')}</div>` : ''}
      <div class="install-button-row">
        ${primary}
        ${!installed ? `<button class="btn btn-soft btn-block" type="button" id="copyInstallLink">${icon('share')}复制链接</button>` : ''}
      </div>
      <p class="install-small">安装后首次打开需要联网；完成缓存后，核心记录和查看可以离线使用。截图识别引擎第一次使用时会按需加载。</p>`,
      onMount: (sheet) => {
        $('#installNowButton', sheet)?.addEventListener('click', async (event) => {
          const promptEvent = deferredInstallPrompt;
          if (!promptEvent) {
            showToast('当前没有可用的安装提示，请使用浏览器菜单添加');
            return;
          }
          event.currentTarget.disabled = true;
          try {
            promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            deferredInstallPrompt = null;
            if (choice.outcome === 'accepted') {
              showToast('已开始安装，请查看手机桌面');
              closeSheet(true);
            } else {
              showToast('已取消安装');
              event.currentTarget.disabled = false;
            }
          } catch (error) {
            showToast('安装提示不可用，请改用浏览器菜单添加');
            event.currentTarget.disabled = false;
          }
        });
        $('#copyInstallLink', sheet)?.addEventListener('click', async () => {
          const copied = await copyTextToClipboard(appRootUrl());
          showToast(copied ? '链接已复制' : '复制失败，请手动复制浏览器地址');
        });
      }
    });
  }

  function getWeightProgress() {
    const profile = state.data.profile;
    if (!profile) return { start: 0, current: 0, target: 0, percent: 0, remaining: 0, change: 0 };
    const start = state.data.weights.length ? state.data.weights[0].kg : profile.currentWeight;
    const current = profile.currentWeight;
    const target = profile.targetWeight;
    const total = Math.max(0.1, start - target);
    const lost = clamp(start - current, 0, total);
    return {
      start,
      current,
      target,
      percent: clamp((lost / total) * 100, 0, 100),
      remaining: Math.max(0, current - target),
      change: current - start
    };
  }

  function profileBodyHTML() {
    const profile = state.data.profile;
    const energy = calcEnergy(profile);
    const bmi = bmiInfo(profile.currentWeight, profile.height);
    const progress = getWeightProgress();
    const activePace = PACES.find((item) => item.value === profile.pace) || PACES[1];
    const dailyOptions = [15, 20, 30, 45, 60].map((value) => `<option value="${value}"${profile.dailyMinutes === value ? ' selected' : ''}>${value} 分钟</option>`).join('');
    const weeklyOptions = [90, 120, 150, 210, 300].map((value) => `<option value="${value}"${profile.weeklyMinutes === value ? ' selected' : ''}>${value} 分钟</option>`).join('');
    const strengthOptions = [0, 1, 2, 3, 4].map((value) => `<option value="${value}"${profile.strengthGoal === value ? ' selected' : ''}>${value} 次${value === 0 ? '（不设目标）' : ''}</option>`).join('');
    const dietOptions = DIETS.map((item) => `<option value="${item.id}"${profile.diet === item.id ? ' selected' : ''}>${item.label}</option>`).join('');
    const deficitNote = energy.capped
      ? `为了不低于安全摄入下限，目标缺口已收紧为 <strong>${fmtInt(energy.deficit)} kcal/天</strong>，约每周 −${energy.projectedWeekly.toFixed(2)} kg。${activePace.label}档的原始目标更激进，但不建议硬追。`
      : `当前目标缺口 <strong>${fmtInt(energy.deficit)} kcal/天</strong>，约每周 −${energy.projectedWeekly.toFixed(2)} kg。想更快时先看趋势，不要连续多日压得过低。`;

    return `<div class="profile-hero">
      <div class="profile-identity">
        <span class="avatar-lg">${icon('leaf')}</span>
        <div>
          <p class="profile-name">${profile.sex === 'female' ? '女性' : '男性'} · ${profile.age} 岁</p>
          <p class="profile-meta">${profile.height} cm · ${ACTIVITY[profile.activity].label} · 目标 ${profile.targetWeight.toFixed(1)} kg</p>
        </div>
        <span class="bmi-pill">BMI ${bmi.value} · ${bmi.label}</span>
      </div>
      <div class="weight-block">
        <div class="weight-now"><strong>${profile.currentWeight.toFixed(1)}</strong><span>kg</span></div>
        <div class="weight-goal">较初始 <strong>${formatWeightChange(progress.change)}</strong> kg<br>距目标 <strong>${progress.remaining.toFixed(1)}</strong> kg</div>
      </div>
      <div class="goal-progress" aria-label="减重目标进度 ${Math.round(progress.percent)}%"><i style="width:${progress.percent.toFixed(1)}%"></i></div>
      <div class="goal-caption"><span>初始 ${progress.start.toFixed(1)} kg</span><span>目标 ${profile.targetWeight.toFixed(1)} kg</span></div>
      <form class="weight-log-form" id="weightLogForm">
        <div class="input-wrap" style="flex:1">
          <input class="input has-unit" id="weightLogInput" type="number" inputmode="decimal" min="35" max="250" step="0.1" placeholder="记录今日体重" aria-label="记录今日体重" autocomplete="off">
          <span class="input-unit">kg</span>
        </div>
        <button class="btn btn-lime" type="submit">记录</button>
      </form>
    </div>
    <div class="profile-stats">
      <div class="profile-stat"><span>每日日常消耗</span><strong>${fmtInt(energy.baseline)}<small> kcal</small></strong></div>
      <div class="profile-stat"><span>目标缺口</span><strong>${fmtInt(energy.deficit)}<small> kcal</small></strong></div>
      <div class="profile-stat"><span>起始饮食预算</span><strong>${fmtInt(energy.baseline - energy.deficit)}<small> kcal</small></strong></div>
    </div>
    ${renderInstallSettingsCard()}
    <div class="settings-block">
      <div class="settings-heading">减重节奏 <span>目标缺口按安全范围计算</span></div>
      <div class="pace-mini">
        ${PACES.map((item) => `<button type="button" data-profile-pace="${item.value}" class="${profile.pace === item.value ? 'is-active' : ''}" aria-pressed="${profile.pace === item.value}">
          ${item.label}<small>${item.desc.replace('每周约 ', '')}/周</small>
        </button>`).join('')}
      </div>
      <div class="profile-callout">${deficitNote}</div>
    </div>
    <div class="settings-block">
      <div class="settings-heading">目标与偏好 <span>随时可改</span></div>
      <div class="settings-card">
        <div class="setting-row">
          <div class="setting-copy"><div class="setting-label">每日活动目标</div><div class="setting-help">至少动多少分钟算今天达标</div></div>
          <select class="setting-select" id="settingDailyMinutes" aria-label="每日活动目标">${dailyOptions}</select>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><div class="setting-label">每周中高强度目标</div><div class="setting-help">按等效中等强度分钟累计</div></div>
          <select class="setting-select" id="settingWeeklyMinutes" aria-label="每周中高强度目标">${weeklyOptions}</select>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><div class="setting-label">每周力量训练</div><div class="setting-help">参考 WHO 建议，至少 2 次</div></div>
          <select class="setting-select" id="settingStrengthGoal" aria-label="每周力量训练目标">${strengthOptions}</select>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><div class="setting-label">食谱偏好</div><div class="setting-help">会影响建议餐盘的筛选与排序</div></div>
          <select class="setting-select" id="settingDiet" aria-label="食谱偏好">${dietOptions}</select>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><div class="setting-label">身体数据</div><div class="setting-help">性别、年龄、身高、目标体重、活动量</div></div>
          <button class="setting-action" type="button" id="editBodyButton">${icon('edit')}编辑</button>
        </div>
      </div>
    </div>
    <div class="settings-block">
      <div class="settings-heading">数据与隐私 <span>不上传服务器</span></div>
      <div class="settings-card">
        <div class="setting-row">
          <div class="setting-copy"><div class="setting-label">本机存储</div><div class="setting-help">${state.storageAvailable ? '记录会自动保存在当前浏览器' : '当前浏览器无法持久保存，请先检查设置'}</div></div>
          <span class="pill pill-ghost">localStorage</span>
        </div>
      </div>
      <div class="data-actions">
        <button class="data-action" type="button" id="exportDataButton">${icon('download')}导出备份</button>
        <button class="data-action" type="button" id="importDataButton">${icon('upload')}导入备份</button>
        <button class="data-action is-danger" type="button" id="resetDataButton">${icon('trash')}清空所有数据</button>
        <button class="data-action" type="button" data-action="show-calc">${icon('info')}计算说明</button>
      </div>
    </div>
    <div class="about-note">
      <strong>关于安全</strong><br>
      减重速度建议控制在每周体重的 1% 以内。轻衡按性别设置了 1200 / 1500 kcal 的饮食预算下限，并会自动收紧过大的缺口。本工具是记录与估算工具，不构成医疗或营养处方；如有慢性病、孕期/哺乳期或进食障碍史，请先咨询医生或注册营养师。
      <details class="about-accordion">
        <summary>数据是怎么估的？</summary>
        <div class="about-accordion-body">
          <p>基础代谢使用 Mifflin–St Jeor 公式；日常消耗 = 基础代谢 × 活动系数（${ACTIVITY[profile.activity].factor}），不含专门运动。</p>
          <p>运动热量优先使用你填写的手表数据；未填时按 MET × 3.5 × 体重 ÷ 200 × 分钟估算。总消耗 = 日常消耗 + 运动消耗；缺口 = 总消耗 − 已摄入。</p>
          <p>食物营养值为常见参考值，实际受品牌、烹饪和份量影响。建议把轻衡当作趋势工具，而不是精密仪器。</p>
        </div>
      </details>
    </div>`;
  }

  function refreshProfileSheet() {
    if (!state.sheetOpen || state.activeSheet?.kind !== 'profile') return;
    const body = $('#sheetBody');
    if (!body) return;
    const scroll = body.scrollTop;
    body.innerHTML = profileBodyHTML();
    mountProfileSheet();
    body.scrollTop = scroll;
  }

  function openProfileSheet() {
    if (!state.data.profile) return;
    openSheet({
      kind: 'profile',
      title: '我的档案',
      subtitle: '身体数据、目标与本地记录',
      content: profileBodyHTML(),
      onMount: mountProfileSheet
    });
  }

  function mountProfileSheet() {
    const form = $('#weightLogForm');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = $('#weightLogInput');
        const value = Number(input?.value);
        if (!Number.isFinite(value) || value < 35 || value > 250) {
          showToast('体重请填写 35–250 kg');
          input?.focus();
          return;
        }
        state.data.profile.currentWeight = value;
        const today = dateKey();
        const existing = state.data.weights.find((item) => item.date === today);
        if (existing) existing.kg = value;
        else state.data.weights.push({ date: today, kg: value });
        state.data.weights.sort((a, b) => a.date.localeCompare(b.date));
        saveState();
        renderViews();
        refreshProfileSheet();
        showToast(`已记录 ${value.toFixed(1)} kg`);
      });
    }
    $$('[data-profile-pace]').forEach((button) => {
      button.addEventListener('click', () => {
        const pace = Number(button.dataset.profilePace);
        state.data.profile.pace = pace;
        saveState();
        renderViews();
        refreshProfileSheet();
        $$('[data-profile-pace]').find((item) => Number(item.dataset.profilePace) === pace)?.focus({ preventScroll: true });
      });
    });
    const daily = $('#settingDailyMinutes');
    if (daily) daily.addEventListener('change', () => {
      state.data.profile.dailyMinutes = Number(daily.value);
      saveState();
      renderViews();
    });
    const weekly = $('#settingWeeklyMinutes');
    if (weekly) weekly.addEventListener('change', () => {
      state.data.profile.weeklyMinutes = Number(weekly.value);
      saveState();
      renderViews();
    });
    const strength = $('#settingStrengthGoal');
    if (strength) strength.addEventListener('change', () => {
      state.data.profile.strengthGoal = Number(strength.value);
      saveState();
      renderViews();
    });
    const diet = $('#settingDiet');
    if (diet) diet.addEventListener('change', () => {
      state.data.profile.diet = diet.value;
      saveState();
      renderViews();
    });
    const editButton = $('#editBodyButton');
    if (editButton) editButton.addEventListener('click', openBodyEditSheet);
    const exportButton = $('#exportDataButton');
    if (exportButton) exportButton.addEventListener('click', exportData);
    const importButton = $('#importDataButton');
    if (importButton) importButton.addEventListener('click', importData);
    const resetButton = $('#resetDataButton');
    if (resetButton) resetButton.addEventListener('click', () => {
      if (window.confirm('确定要清空所有饮食、运动、体重和自定义食物记录吗？此操作无法撤销。')) {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
          // Ignore storage cleanup failure and reload into a blank state.
        }
        window.location.reload();
      }
    });
  }

  function openBodyEditSheet() {
    const profile = state.data.profile;
    if (!profile) return;
    const activityCards = Object.entries(ACTIVITY).map(([key, item]) => `<button class="choice-card${key === profile.activity ? ' is-active' : ''}" type="button" data-edit-activity="${key}" aria-pressed="${key === profile.activity}">
      <span class="choice-radio" aria-hidden="true"></span>
      <span class="choice-copy"><span class="choice-title">${item.label}<small>×${item.factor}</small></span><span class="choice-desc">${item.desc}</span></span>
    </button>`).join('');
    let sex = profile.sex;
    let activity = profile.activity;
    openSheet({
      kind: 'body-edit',
      title: '编辑身体档案',
      subtitle: '改动会重新计算基础代谢与饮食预算',
      content: `<div class="form-block">
        <div class="field is-full">
          <span class="field-label">生理性别</span>
          <div class="segmented" role="group" aria-label="生理性别">
            <button type="button" data-edit-sex="female" class="${sex === 'female' ? 'is-active' : ''}" aria-pressed="${sex === 'female'}">女性</button>
            <button type="button" data-edit-sex="male" class="${sex === 'male' ? 'is-active' : ''}" aria-pressed="${sex === 'male'}">男性</button>
          </div>
        </div>
        <div class="field-grid" style="margin-top:10px">
          <div class="field"><label for="editAge">年龄</label><div class="input-wrap"><input class="input has-unit" id="editAge" type="number" inputmode="numeric" value="${profile.age}" min="18" max="75"><span class="input-unit">岁</span></div></div>
          <div class="field"><label for="editHeight">身高</label><div class="input-wrap"><input class="input has-unit" id="editHeight" type="number" inputmode="decimal" value="${profile.height}" min="130" max="220" step="0.5"><span class="input-unit">cm</span></div></div>
          <div class="field"><label for="editWeight">当前体重</label><div class="input-wrap"><input class="input has-unit" id="editWeight" type="number" inputmode="decimal" value="${profile.currentWeight.toFixed(1)}" min="35" max="250" step="0.1"><span class="input-unit">kg</span></div></div>
          <div class="field"><label for="editTarget">目标体重</label><div class="input-wrap"><input class="input has-unit" id="editTarget" type="number" inputmode="decimal" value="${profile.targetWeight.toFixed(1)}" min="35" max="250" step="0.1"><span class="input-unit">kg</span></div></div>
        </div>
      </div>
      <div class="form-block">
        <div class="form-block-title">日常节奏 <span>不含专门运动</span></div>
        <div class="choice-list">${activityCards}</div>
      </div>
      <div class="form-error" id="bodyEditError" role="alert">${icon('alert')}<span></span></div>
      <div class="quick-entry-note">${icon('info')}身体数据修改后，今日预算和缺口会立即按新数据重算；历史运动记录不会改变。目标 BMI 不能低于 18.5。</div>`,
      footer: `<div class="sheet-foot-actions">
        <button class="btn btn-primary btn-block" type="button" id="saveBodyEdit">保存身体档案</button>
      </div>`,
      onMount: (sheet) => {
        $$('[data-edit-sex]', sheet).forEach((button) => {
          button.addEventListener('click', () => {
            sex = button.dataset.editSex;
            $$('[data-edit-sex]', sheet).forEach((item) => {
              const active = item.dataset.editSex === sex;
              item.classList.toggle('is-active', active);
              item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
          });
        });
        $$('[data-edit-activity]', sheet).forEach((button) => {
          button.addEventListener('click', () => {
            activity = button.dataset.editActivity;
            $$('[data-edit-activity]', sheet).forEach((item) => {
              const active = item.dataset.editActivity === activity;
              item.classList.toggle('is-active', active);
              item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
          });
        });
        const save = $('#saveBodyEdit', sheet);
        if (save) save.addEventListener('click', () => {
          const age = Number($('#editAge', sheet).value);
          const height = Number($('#editHeight', sheet).value);
          const weight = Number($('#editWeight', sheet).value);
          const target = Number($('#editTarget', sheet).value);
          const errors = [];
          if (!sex) errors.push('请选择生理性别。');
          if (!Number.isFinite(age) || age < 18 || age > 75) errors.push('年龄请填写 18–75 岁。');
          if (!Number.isFinite(height) || height < 130 || height > 220) errors.push('身高请填写 130–220 cm。');
          if (!Number.isFinite(weight) || weight < 35 || weight > 250) errors.push('体重请填写 35–250 kg。');
          if (!Number.isFinite(target) || target < 35 || target > 250) errors.push('目标体重请填写 35–250 kg。');
          if (Number.isFinite(target) && Number.isFinite(weight) && target >= weight) errors.push('目标体重需要低于当前体重。');
          if (Number.isFinite(target) && Number.isFinite(height) && target / Math.pow(height / 100, 2) < 18.5) errors.push('目标 BMI 低于 18.5，请把目标体重调高。');
          if (Number.isFinite(weight) && Number.isFinite(height) && Number.isFinite(age) && sex) {
            const preview = calcEnergy({ sex, age, height, currentWeight: weight, targetWeight: target, activity, pace: state.data.profile.pace });
            if (preview.baseline < 1200 || preview.unsafe) errors.push('按当前数据计算的基础消耗过低，请咨询医生或营养师。');
          }
          const errorBox = $('#bodyEditError', sheet);
          if (errors.length) {
            errorBox.classList.add('is-visible');
            errorBox.querySelector('span').textContent = errors[0];
            showToast(errors[0]);
            requestAnimationFrame(() => errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' }));
            return;
          }
          const profile = state.data.profile;
          profile.sex = sex;
          profile.age = age;
          profile.height = height;
          profile.currentWeight = weight;
          profile.targetWeight = target;
          profile.activity = activity;
          const today = dateKey();
          const existing = state.data.weights.find((item) => item.date === today);
          if (existing) existing.kg = weight;
          else state.data.weights.push({ date: today, kg: weight });
          state.data.weights.sort((a, b) => a.date.localeCompare(b.date));
          saveState();
          closeSheet(true);
          renderViews();
          openProfileSheet();
          showToast('身体档案已更新');
        });
      }
    });
  }

  function exportData() {
    try {
      const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `轻衡备份-${dateKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast('备份已导出');
    } catch (error) {
      showToast('导出失败，请检查浏览器下载权限');
    }
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) {
        input.remove();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const normalized = normalizeState(parsed);
          if (!normalized.profile) throw new Error('no profile');
          state.data = normalized;
          saveState();
          closeSheet(true);
          syncViewFromHash({ scroll: false });
          showToast('备份已导入');
        } catch (error) {
          showToast('文件格式不正确，未能导入');
        } finally {
          input.remove();
        }
      };
      reader.onerror = () => {
        input.remove();
        showToast('读取文件失败');
      };
      reader.readAsText(file);
    }, { once: true });
    input.click();
  }

  // ---------------- Calculation sheet ----------------

  function openCalculationSheet() {
    if (!state.data.profile) return;
    const profile = state.data.profile;
    const energy = calcEnergy(profile);
    openSheet({
      kind: 'calc',
      title: '轻衡怎么算',
      subtitle: '把每一个数字的来源说清楚',
      content: `<div class="about-note" style="margin-top:0">
        <strong>基础代谢（BMR）</strong><br>
        使用 Mifflin–St Jeor 公式：10 × 体重(kg) + 6.25 × 身高(cm) − 5 × 年龄 + 性别项（女性 −161，男性 +5）。你当前约为 <strong>${fmtInt(energy.bmr)} kcal/天</strong>。
      </div>
      <div class="about-note">
        <strong>日常消耗（不含运动）</strong><br>
        基础代谢 × 活动系数。你当前选择的是「${ACTIVITY[profile.activity].label}」，系数 ${ACTIVITY[profile.activity].factor}，约 <strong>${fmtInt(energy.baseline)} kcal/天</strong>。这里刻意不含专门运动，避免和手表重复。
      </div>
      <div class="about-note">
        <strong>运动消耗</strong><br>
        优先使用你填入的手表“活动消耗”。不填时，按 MET × 3.5 × 体重 ÷ 200 × 分钟估算。网页不直接读取 OPPO Watch S2 / 欢太健康账号，需要手动抄录。
      </div>
      <div class="about-note">
        <strong>饮食预算与缺口</strong><br>
        饮食预算 = 日常消耗 + 运动消耗 − 目标缺口；热量缺口 = 日常消耗 + 运动消耗 − 已摄入。你当前的目标缺口是 <strong>${fmtInt(energy.deficit)} kcal/天</strong>${energy.capped ? '（已按安全下限收紧）' : ''}，没有运动时的起始预算约 <strong>${fmtInt(energy.baseline - energy.deficit)} kcal</strong>，运动会再增加预算。
      </div>
      <div class="about-note">
        <strong>运动达标</strong><br>
        参考 WHO 成人身体活动建议：每周 150–300 分钟中等强度活动，以及至少 2 次力量训练。轻衡把轻松×0.5、适中×1、高强度×2 折算成“等效中等强度分钟”。目标可以在“我的”里调整，不是硬性医疗标准。
      </div>
      <div class="about-note">
        <strong>估算的边界</strong><br>
        食物热量、基础代谢和手表热量都是估算。不要为了追单日数字跳过整餐或惩罚性运动。看 7 日平均趋势，比追求一顿饭精确更重要。
      </div>`,
      footer: `<div class="sheet-foot-actions"><button class="btn btn-primary btn-block" type="button" data-sheet-close>知道了</button></div>`
    });
  }

  // ---------------- Food picker and entries ----------------

  function foodsInCategory(food, category) {
    if (category === '全部') return true;
    if (category === '我的') return (state.data.customFoods || []).some((item) => item.id === food.id);
    if (category === '蔬果') return ['蔬菜', '水果'].includes(food.cat);
    if (category === '奶坚果') return ['乳品', '坚果'].includes(food.cat);
    if (category === '餐食') return ['餐食', '饮品', '零食', '调味'].includes(food.cat);
    return food.cat === category;
  }

  function searchFoods(query, category) {
    const q = String(query || '').trim().toLowerCase();
    return allFoods().filter((food) => {
      if (!foodsInCategory(food, category)) return false;
      if (!q) return true;
      const haystack = [food.name, food.cat, ...(food.aliases || [])].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  function foodServingKcal(food) {
    return Math.round((food.kcal * (food.serving || 100)) / 100);
  }

  function openFoodPicker(meal = 'auto') {
    if (!state.data.profile) return;
    const selectedMeal = normalizeMeal(meal);
    let query = '';
    let category = '全部';
    const recentIds = getRecentFoodIds(7);
    const recentFoods = recentIds.map(findFood).filter(Boolean);
    const categoryTabs = FOOD_CATEGORIES.map((item) => `<button class="cat-chip${item.id === category ? ' is-active' : ''}" type="button" data-food-cat="${item.id}" aria-pressed="${item.id === category}">${item.label}</button>`).join('');

    openSheet({
      kind: 'food-picker',
      title: '记录饮食',
      subtitle: `添加到${findMealName(selectedMeal)} · 先选食物，再调分量`,
      content: `<div class="picker-search">
        ${icon('search')}
        <input class="input" id="foodSearchInput" type="search" placeholder="搜索米饭、鸡胸、酸奶…" aria-label="搜索食物" autocomplete="off">
        <button class="picker-search-clear" type="button" id="clearFoodSearch" aria-label="清空搜索" hidden>${icon('close')}</button>
      </div>
      <div class="category-tabs" id="foodCategoryTabs">${categoryTabs}</div>
      <div class="picker-tip">${icon('info')}<span>不确定克数时：主食约一个拳头，肉约一个掌心，蔬菜约两捧。点食物后可微调。</span></div>
      <div class="recent-block" id="recentFoodsBlock">
        <p class="recent-label">最近吃过</p>
        <div class="recent-chips">
          ${recentFoods.map((food) => `<button class="recent-chip" type="button" data-pick-food="${food.id}">${food.emoji} ${esc(food.name)}</button>`).join('') || '<span class="tiny">还没有记录，今天从第一样开始。</span>'}
        </div>
      </div>
      <div class="food-options" id="foodOptions"></div>`,
      footer: `<div class="picker-actions">
        <button type="button" id="customFoodButton">${icon('plus')}自定义食物</button>
        <span class="muted" aria-hidden="true">·</span>
        <button type="button" id="quickCalorieButton">${icon('bolt')}快速记热量</button>
      </div>`,
      onMount: (sheet) => {
        const search = $('#foodSearchInput', sheet);
        const clear = $('#clearFoodSearch', sheet);
        const list = $('#foodOptions', sheet);
        const renderList = () => {
          let results = searchFoods(query, category);
          if (!results.length) {
            list.innerHTML = `<div class="plan-empty" style="margin-top:13px"><strong>没有找到这个食物</strong><p>换个关键词，或点底部“自定义食物”保存一个。</p></div>`;
            return;
          }
          if (category === '全部' && !query) {
            const groups = [];
            ['主食', '蛋白', '蔬菜', '水果', '乳品', '坚果', '餐食', '饮品', '零食', '调味', '我的'].forEach((cat) => {
              const items = results.filter((food) => food.cat === cat);
              if (!items.length) return;
              groups.push(`<div class="food-group-label">${cat === '我的' ? '我的食物' : cat}</div>` + items.map(foodOptionHtml).join(''));
            });
            list.innerHTML = groups.join('');
          } else {
            list.innerHTML = results.map(foodOptionHtml).join('');
          }
        };
        const updateRecentVisibility = () => {
          const block = $('#recentFoodsBlock', sheet);
          if (block) block.hidden = Boolean(query);
        };
        search.addEventListener('input', () => {
          query = search.value;
          if (clear) clear.hidden = !query;
          updateRecentVisibility();
          renderList();
        });
        clear?.addEventListener('click', () => {
          query = '';
          search.value = '';
          clear.hidden = true;
          updateRecentVisibility();
          renderList();
          search.focus();
        });
        $$('[data-food-cat]', sheet).forEach((button) => {
          button.addEventListener('click', () => {
            category = button.dataset.foodCat;
            $$('[data-food-cat]', sheet).forEach((item) => {
            const active = item === button;
            item.classList.toggle('is-active', active);
            item.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
            updateRecentVisibility();
            renderList();
          });
        });
        list.addEventListener('click', (event) => {
          const trigger = event.target.closest('[data-pick-food]');
          if (!trigger) return;
          const food = findFood(trigger.dataset.pickFood);
          if (food) openFoodQuantity(food, selectedMeal);
        });
        $('#recentFoodsBlock', sheet)?.addEventListener('click', (event) => {
          const trigger = event.target.closest('[data-pick-food]');
          if (!trigger) return;
          const food = findFood(trigger.dataset.pickFood);
          if (food) openFoodQuantity(food, selectedMeal);
        });
        $('#customFoodButton', sheet)?.addEventListener('click', () => openCustomFoodSheet(selectedMeal));
        $('#quickCalorieButton', sheet)?.addEventListener('click', () => openQuickEntrySheet(selectedMeal));
        renderList();
      }
    });
  }

  function foodOptionHtml(food) {
    return `<button class="food-option" type="button" data-pick-food="${esc(food.id)}">
      <span class="food-option-emoji" aria-hidden="true">${esc(food.emoji || '🍽️')}</span>
      <span class="food-option-main">
        <span class="food-option-name">${esc(food.name)}</span>
        <span class="food-option-meta">每 100g ${fmtInt(food.kcal)} kcal · ${food.servingLabel || '一份'}约 ${fmtInt(foodServingKcal(food))} kcal</span>
      </span>
      <span class="food-option-kcal">${fmtInt(food.kcal)}<small> /100g</small></span>
      <span class="food-option-plus">${icon('plus')}</span>
    </button>`;
  }

  function quantityNutrition(base, unit, qty) {
    const factor = unit === '份' ? qty : qty / 100;
    return {
      kcal: base.kcal * factor,
      p: base.p * factor,
      c: base.c * factor,
      f: base.f * factor
    };
  }

  function nutritionLine(nutrition) {
    return `<div class="nutrition-line">
      <div class="nutrition-cell"><span>热量</span><strong>${fmtInt(nutrition.kcal)}<small> kcal</small></strong></div>
      <div class="nutrition-cell"><span>蛋白</span><strong>${fmtNum(nutrition.p)}<small> g</small></strong></div>
      <div class="nutrition-cell"><span>碳水</span><strong>${fmtNum(nutrition.c)}<small> g</small></strong></div>
      <div class="nutrition-cell"><span>脂肪</span><strong>${fmtNum(nutrition.f)}<small> g</small></strong></div>
    </div>`;
  }

  function openFoodQuantity(food, meal = 'auto', editEntry = null) {
    let selectedMeal = normalizeMeal(editEntry ? editEntry.meal : meal);
    const unit = 'g';
    const base = {
      kcal: food.kcal,
      p: food.p,
      c: food.c,
      f: food.f
    };
    let qty = editEntry ? editEntry.qty : (food.serving || 100);
    const visual = visualPortionOptions(food);

    openSheet({
      kind: 'food-quantity',
      title: editEntry ? '调整分量' : '添加食物',
      subtitle: food.name,
      back: () => openFoodPicker(selectedMeal),
      content: `<div class="food-detail">
        <div class="food-detail-hero">
          <span class="food-detail-emoji" aria-hidden="true">${esc(food.emoji || '🍽️')}</span>
          <div>
            <div class="food-detail-title">${esc(food.name)}</div>
            <div class="food-detail-meta">每 100g 约 ${fmtInt(food.kcal)} kcal<br>${food.servingLabel || '一份'}约 ${food.serving || 100}g</div>
          </div>
          <div class="food-detail-kcal" id="quantityKcal">${fmtInt(quantityNutrition(base, unit, qty).kcal)}<span> kcal</span></div>
        </div>
        <div class="form-block">
          <div class="form-block-title">吃多少 <span>没有秤就先用眼睛估</span></div>
          <div class="visual-portion-head">
            <span>点一个最接近的份量</span>
            <small>选完还能微调</small>
          </div>
          <div class="visual-portion-grid" id="quantityVisualOptions">
            ${visual.options.map((option) => `<button class="visual-option${Math.abs(qty - option.qty) < 0.2 ? ' is-active' : ''}" type="button" data-qty="${option.qty}" aria-pressed="${Math.abs(qty - option.qty) < 0.2}">
              <span class="visual-option-icon" aria-hidden="true">${visual.icon}</span>
              <strong>${option.label}</strong>
              <span>约 ${option.qty}g</span>
              <em>${option.kcal} kcal</em>
            </button>`).join('')}
          </div>
          <p class="visual-portion-hint">${esc(visual.hint)}</p>
          <div class="quantity-fine-head">或者输入克数微调</div>
          <div class="quantity-control">
            <button class="step-button" type="button" id="qtyMinus" aria-label="减少 10 克">−</button>
            <div class="input-wrap">
              <input class="input" id="quantityInput" type="number" inputmode="decimal" min="1" max="3000" step="1" value="${fmtAmount(qty)}" aria-label="食物克数">
              <span class="input-unit">g</span>
            </div>
            <button class="step-button" type="button" id="qtyPlus" aria-label="增加 10 克">${icon('plus')}</button>
          </div>
          <div id="quantityNutrition">${nutritionLine(quantityNutrition(base, unit, qty))}</div>
        </div>
        <div class="form-block">
          <div class="form-block-title">记到哪一餐 <span>可随时调整</span></div>
          <div class="meal-tabs" id="quantityMealTabs">
            ${MEALS.map((item) => `<button class="meal-tab${item.id === selectedMeal ? ' is-active' : ''}" type="button" data-qty-meal="${item.id}" aria-pressed="${item.id === selectedMeal}">${item.name}</button>`).join('')}
          </div>
        </div>
        <div class="quick-entry-note">${icon('info')}点按已有记录可以修改克数或删除。油、酱料等也别忘记记，少量也有热量。</div>
      </div>`,
      footer: `<div class="sheet-foot-actions">
        ${editEntry ? '<button class="btn btn-danger btn-sm" type="button" id="deleteFoodEntry" aria-label="删除这条记录">' + icon('trash') + '</button>' : ''}
        <button class="btn btn-primary" type="button" id="saveFoodEntry">${editEntry ? '保存修改' : '加入' + findMealName(selectedMeal)}</button>
      </div>`,
      onMount: (sheet) => {
        const input = $('#quantityInput', sheet);
        const kcalEl = $('#quantityKcal', sheet);
        const nutritionEl = $('#quantityNutrition', sheet);
        const update = () => {
          const value = Number(input.value);
          const safeQty = Number.isFinite(value) && value > 0 ? value : 0;
          qty = safeQty;
          kcalEl.innerHTML = `${fmtInt(quantityNutrition(base, unit, safeQty).kcal)}<span> kcal</span>`;
          nutritionEl.innerHTML = nutritionLine(quantityNutrition(base, unit, safeQty));
          $$('[data-qty]', sheet).forEach((button) => {
            const active = Math.abs(Number(button.dataset.qty) - safeQty) < 0.2;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
          const save = $('#saveFoodEntry', sheet);
          if (save) save.disabled = safeQty <= 0;
        };
        input.addEventListener('input', update);
        input.addEventListener('blur', () => {
          let value = Number(input.value);
          if (!Number.isFinite(value) || value <= 0) value = food.serving || 100;
          value = clamp(value, 1, 3000);
          input.value = fmtAmount(value);
          update();
        });
        $('#qtyMinus', sheet).addEventListener('click', () => {
          const next = clamp(Math.max(1, Number(input.value) - 10), 1, 3000);
          input.value = String(next);
          update();
        });
        $('#qtyPlus', sheet).addEventListener('click', () => {
          const next = clamp((Number(input.value) || 0) + 10, 1, 3000);
          input.value = String(next);
          update();
        });
        $$('[data-qty]', sheet).forEach((button) => {
          button.addEventListener('click', () => {
            input.value = button.dataset.qty;
            update();
          });
        });
        $$('[data-qty-meal]', sheet).forEach((button) => {
          button.addEventListener('click', () => {
            selectedMeal = button.dataset.qtyMeal;
            $$('[data-qty-meal]', sheet).forEach((item) => {
              const active = item === button;
              item.classList.toggle('is-active', active);
              item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            const save = $('#saveFoodEntry', sheet);
            if (save && !editEntry) save.textContent = '加入' + findMealName(selectedMeal);
          });
        });
        $('#saveFoodEntry', sheet)?.addEventListener('click', () => {
          const value = Number(input.value);
          if (!Number.isFinite(value) || value <= 0) {
            showToast('请填写大于 0 的克数');
            input.focus();
            input.scrollIntoView({ block: 'center', behavior: 'smooth' });
            return;
          }
          const day = getDay(dateKey(), true);
          if (editEntry) {
            const found = findFoodEntry(editEntry.id);
            if (!found) return;
            found.entry.qty = value;
            found.entry.meal = selectedMeal;
            found.entry.unit = 'g';
            found.entry.base = base;
            saveState();
            closeSheet(true);
            renderViews();
            showToast('分量已更新');
          } else {
            day.foods.push({
              id: uid('food'),
              name: food.name,
              emoji: food.emoji || '🍽️',
              source: 'food',
              meal: selectedMeal,
              qty: value,
              unit: 'g',
              base,
              foodId: food.id,
              recipeId: null,
              time: nowTime()
            });
            saveState();
            closeSheet(true);
            renderViews();
            showToast(`已记入${findMealName(selectedMeal)} · ${fmtInt(quantityNutrition(base, unit, value).kcal)} kcal`);
          }
        });
        $('#deleteFoodEntry', sheet)?.addEventListener('click', () => {
          if (!editEntry) return;
          const found = findFoodEntry(editEntry.id);
          if (!found) return;
          const index = found.day.foods.findIndex((item) => item.id === editEntry.id);
          if (index < 0) return;
          const removed = found.day.foods.splice(index, 1)[0];
          saveState();
          closeSheet(true);
          renderViews();
          showToast('已删除这条记录', {
            actionLabel: '撤销',
            onAction: () => {
              const day = getDay(found.key, true);
              day.foods.push(removed);
              saveState();
              renderViews();
              showToast('已恢复记录');
            }
          });
        });
      }
    });
  }

  function openEntryEditor(entry) {
    if (!entry) return;
    if (entry.source === 'quick') {
      openQuickEntrySheet(entry.meal, entry);
      return;
    }
    if (entry.source === 'recipe' && entry.recipeId && RECIPE_MAP[entry.recipeId]) {
      openRecipeQuantityEditor(entry, RECIPE_MAP[entry.recipeId]);
      return;
    }
    const food = (entry.foodId && findFood(entry.foodId)) || {
      id: entry.foodId || 'unknown',
      name: entry.name,
      emoji: entry.emoji,
      kcal: entry.base.kcal,
      p: entry.base.p,
      c: entry.base.c,
      f: entry.base.f,
      serving: entry.qty,
      servingLabel: '一份'
    };
    openFoodQuantity(food, entry.meal, entry);
  }

  function openRecipeQuantityEditor(entry, recipe) {
    let qty = entry.qty;
    let selectedMeal = entry.meal;
    openSheet({
      kind: 'recipe-quantity',
      title: '调整分量',
      subtitle: recipe.name,
      content: `<div class="food-detail">
        <div class="food-detail-hero">
          <span class="food-detail-emoji" aria-hidden="true">${recipe.emoji}</span>
          <div><div class="food-detail-title">${esc(recipe.name)}</div><div class="food-detail-meta">每份约 ${fmtInt(recipe.kcal)} kcal · 蛋白 ${fmtNum(recipe.protein)} g</div></div>
          <div class="food-detail-kcal" id="recipeQtyKcal">${fmtInt(recipe.kcal * qty)}<span> kcal</span></div>
        </div>
        <div class="form-block">
          <div class="form-block-title">吃几份 <span>按整份估算</span></div>
          <div class="quantity-control">
            <button class="step-button" type="button" id="recipeQtyMinus" aria-label="减少半份">−</button>
            <div class="input-wrap"><input class="input" id="recipeQtyInput" type="number" inputmode="decimal" min="0.5" max="4" step="0.5" value="${qty}" aria-label="食谱份数"><span class="input-unit">份</span></div>
            <button class="step-button" type="button" id="recipeQtyPlus" aria-label="增加半份">${icon('plus')}</button>
          </div>
          <div class="preset-grid">
            ${[0.5, 1, 1.5, 2].map((value) => `<button class="preset-btn${Math.abs(qty - value) < 0.01 ? ' is-active' : ''}" type="button" data-recipe-qty="${value}">${value} 份</button>`).join('')}
          </div>
        </div>
        <div class="form-block">
          <div class="form-block-title">记到哪一餐</div>
          <div class="meal-tabs" id="recipeQtyMealTabs">
            ${MEALS.map((item) => `<button class="meal-tab${item.id === selectedMeal ? ' is-active' : ''}" type="button" data-recipe-meal="${item.id}" aria-pressed="${item.id === selectedMeal}">${item.name}</button>`).join('')}
          </div>
        </div>
      </div>`,
      footer: `<div class="sheet-foot-actions">
        <button class="btn btn-danger btn-sm" type="button" id="deleteRecipeEntry" aria-label="删除这条记录">${icon('trash')}</button>
        <button class="btn btn-primary" type="button" id="saveRecipeEntry">保存修改</button>
      </div>`,
      onMount: (sheet) => {
        const input = $('#recipeQtyInput', sheet);
        const update = () => {
          const value = Number(input.value);
          qty = Number.isFinite(value) ? clamp(value, 0.5, 4) : 1;
          $('#recipeQtyKcal', sheet).innerHTML = `${fmtInt(recipe.kcal * qty)}<span> kcal</span>`;
          $$('[data-recipe-qty]', sheet).forEach((button) => button.classList.toggle('is-active', Math.abs(Number(button.dataset.recipeQty) - qty) < 0.01));
        };
        input.addEventListener('input', update);
        $$('[data-recipe-qty]', sheet).forEach((button) => {
          button.addEventListener('click', () => {
            input.value = button.dataset.recipeQty;
            update();
          });
        });
        $('#recipeQtyMinus', sheet).addEventListener('click', () => {
          input.value = String(clamp((Number(input.value) || 1) - 0.5, 0.5, 4));
          update();
        });
        $('#recipeQtyPlus', sheet).addEventListener('click', () => {
          input.value = String(clamp((Number(input.value) || 1) + 0.5, 0.5, 4));
          update();
        });
        $$('[data-recipe-meal]', sheet).forEach((button) => {
          button.addEventListener('click', () => {
            selectedMeal = button.dataset.recipeMeal;
            $$('[data-recipe-meal]', sheet).forEach((item) => {
              const active = item === button;
              item.classList.toggle('is-active', active);
              item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
          });
        });
        $('#saveRecipeEntry', sheet).addEventListener('click', () => {
          const found = findFoodEntry(entry.id);
          if (!found) return;
          found.entry.qty = qty;
          found.entry.meal = selectedMeal;
          saveState();
          closeSheet(true);
          renderViews();
          showToast('分量已更新');
        });
        $('#deleteRecipeEntry', sheet).addEventListener('click', () => {
          const found = findFoodEntry(entry.id);
          if (!found) return;
          const removed = found.day.foods.find((item) => item.id === entry.id);
          found.day.foods = found.day.foods.filter((item) => item.id !== entry.id);
          saveState();
          closeSheet(true);
          renderViews();
          showToast('已删除这条记录', {
            actionLabel: '撤销',
            onAction: () => {
              const day = getDay(found.key, true);
              day.foods.push(removed);
              saveState();
              renderViews();
            }
          });
        });
      }
    });
  }

  function openQuickEntrySheet(meal = 'auto', editEntry = null) {
    let selectedMeal = editEntry ? editEntry.meal : normalizeMeal(meal);
    const initialKcal = editEntry ? editEntry.base.kcal : '';
    const initialName = editEntry ? editEntry.name : '';
    const initialProtein = editEntry ? editEntry.base.p : '';
    openSheet({
      kind: 'quick-entry',
      title: editEntry ? '编辑快速记录' : '快速记热量',
      subtitle: '外卖、聚餐或没称重时，先记一个总量',
      content: `<div class="form-block">
        <div class="field">
          <label for="quickName">吃了什么</label>
          <input class="input" id="quickName" type="text" maxlength="40" placeholder="例如：外卖麻辣烫" value="${esc(initialName)}" autocomplete="off">
        </div>
        <div class="field" style="margin-top:10px">
          <label for="quickKcal">总热量</label>
          <div class="input-wrap"><input class="input has-unit" id="quickKcal" type="number" inputmode="numeric" min="1" max="5000" placeholder="例如 650" value="${initialKcal ? Math.round(initialKcal) : ''}"><span class="input-unit">kcal</span></div>
        </div>
        <div class="duration-presets" style="margin-top:7px">
          ${[300, 500, 700, 900].map((value) => `<button class="preset-btn" type="button" data-quick-kcal="${value}">${value} kcal</button>`).join('')}
        </div>
        <div class="field" style="margin-top:10px">
          <label for="quickProtein">蛋白质（选填）</label>
          <div class="input-wrap"><input class="input has-unit" id="quickProtein" type="number" inputmode="decimal" min="0" max="300" step="0.1" placeholder="不知道可以留空" value="${initialProtein ? fmtNum(initialProtein) : ''}"><span class="input-unit">g</span></div>
        </div>
        <div class="form-block" style="margin-top:16px">
          <div class="form-block-title">记到哪一餐</div>
          <div class="meal-tabs" id="quickMealTabs">
            ${MEALS.map((item) => `<button class="meal-tab${item.id === selectedMeal ? ' is-active' : ''}" type="button" data-quick-meal="${item.id}" aria-pressed="${item.id === selectedMeal}">${item.name}</button>`).join('')}
          </div>
        </div>
        <div class="form-error" id="quickError" role="alert">${icon('alert')}<span></span></div>
        <div class="quick-entry-note">${icon('info')}快速记录只用于当天总热量，不会保存为常用食物。想下次复用，请用“自定义食物”。</div>
      </div>`,
      footer: `<div class="sheet-foot-actions">
        ${editEntry ? '<button class="btn btn-danger btn-sm" type="button" id="deleteQuickEntry" aria-label="删除这条记录">' + icon('trash') + '</button>' : ''}
        <button class="btn btn-primary" type="button" id="saveQuickEntry">${editEntry ? '保存修改' : '记入' + findMealName(selectedMeal)}</button>
      </div>`,
      onMount: (sheet) => {
        $$('[data-quick-kcal]', sheet).forEach((button) => {
          button.addEventListener('click', () => {
            $('#quickKcal', sheet).value = button.dataset.quickKcal;
          });
        });
        $$('[data-quick-meal]', sheet).forEach((button) => {
          button.addEventListener('click', () => {
            selectedMeal = button.dataset.quickMeal;
            $$('[data-quick-meal]', sheet).forEach((item) => {
              const active = item === button;
              item.classList.toggle('is-active', active);
              item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
          });
        });
        $('#saveQuickEntry', sheet).addEventListener('click', () => {
          const name = $('#quickName', sheet).value.trim() || '外食';
          const kcal = Number($('#quickKcal', sheet).value);
          const protein = Number($('#quickProtein', sheet).value) || 0;
          const error = $('#quickError', sheet);
          const fail = (message) => {
            error.classList.add('is-visible');
            error.querySelector('span').textContent = message;
            showToast(message);
            requestAnimationFrame(() => error.scrollIntoView({ block: 'center', behavior: 'smooth' }));
          };
          if (!Number.isFinite(kcal) || kcal <= 0 || kcal > 5000) {
            fail('请填写 1–5000 kcal 的总热量');
            return;
          }
          if (!Number.isFinite(protein) || protein < 0 || protein > 300) {
            fail('蛋白质请填写 0–300 g，或留空');
            return;
          }
          if (editEntry) {
            const found = findFoodEntry(editEntry.id);
            if (!found) return;
            found.entry.name = name;
            found.entry.meal = selectedMeal;
            found.entry.base = { kcal, p: protein, c: 0, f: 0 };
            found.entry.qty = 1;
            found.entry.unit = '份';
            saveState();
            closeSheet(true);
            renderViews();
            showToast('记录已更新');
          } else {
            const day = getDay(dateKey(), true);
            day.foods.push({
              id: uid('food'),
              name,
              emoji: '🍽️',
              source: 'quick',
              meal: selectedMeal,
              qty: 1,
              unit: '份',
              base: { kcal, p: protein, c: 0, f: 0 },
              foodId: null,
              recipeId: null,
              time: nowTime()
            });
            saveState();
            closeSheet(true);
            renderViews();
            showToast(`已记入${findMealName(selectedMeal)} · ${fmtInt(kcal)} kcal`);
          }
        });
        $('#deleteQuickEntry', sheet)?.addEventListener('click', () => {
          if (!editEntry) return;
          const found = findFoodEntry(editEntry.id);
          if (!found) return;
          found.day.foods = found.day.foods.filter((item) => item.id !== editEntry.id);
          saveState();
          closeSheet(true);
          renderViews();
          showToast('已删除这条记录');
        });
      }
    });
  }

  function openCustomFoodSheet(meal = 'auto') {
    const selectedMeal = normalizeMeal(meal);
    openSheet({
      kind: 'custom-food',
      title: '自定义食物',
      subtitle: '按每 100g 填写，保存后可重复使用',
      content: `<div class="field">
        <label for="customFoodName">食物名称</label>
        <input class="input" id="customFoodName" type="text" maxlength="30" placeholder="例如：妈妈做的番茄牛腩" autocomplete="off">
      </div>
      <div class="field-grid" style="margin-top:10px">
        <div class="field"><label for="customFoodKcal">热量 / 100g</label><div class="input-wrap"><input class="input has-unit" id="customFoodKcal" type="number" inputmode="numeric" min="0" max="900" placeholder="必填"><span class="input-unit">kcal</span></div></div>
        <div class="field"><label for="customFoodServing">一份大约</label><div class="input-wrap"><input class="input has-unit" id="customFoodServing" type="number" inputmode="numeric" min="1" max="2000" value="100"><span class="input-unit">g</span></div></div>
        <div class="field"><label for="customFoodProtein">蛋白质 / 100g（选填）</label><div class="input-wrap"><input class="input has-unit" id="customFoodProtein" type="number" inputmode="decimal" min="0" max="100" step="0.1" placeholder="0"><span class="input-unit">g</span></div></div>
        <div class="field"><label for="customFoodCarbs">碳水 / 100g（选填）</label><div class="input-wrap"><input class="input has-unit" id="customFoodCarbs" type="number" inputmode="decimal" min="0" max="100" step="0.1" placeholder="0"><span class="input-unit">g</span></div></div>
        <div class="field is-full"><label for="customFoodFat">脂肪 / 100g（选填）</label><div class="input-wrap"><input class="input has-unit" id="customFoodFat" type="number" inputmode="decimal" min="0" max="100" step="0.1" placeholder="0"><span class="input-unit">g</span></div></div>
      </div>
      <div class="form-error" id="customFoodError" role="alert">${icon('alert')}<span></span></div>
      <div class="quick-entry-note">${icon('info')}如果没有营养标签，可以参考同类食物的数据，或者先用“快速记热量”记录总量。自定义食物只保存在本机。</div>`,
      footer: `<div class="sheet-foot-actions"><button class="btn btn-primary btn-block" type="button" id="saveCustomFood">保存并添加</button></div>`,
      onMount: (sheet) => {
        $('#saveCustomFood', sheet).addEventListener('click', () => {
          const name = $('#customFoodName', sheet).value.trim();
          const kcal = Number($('#customFoodKcal', sheet).value);
          const p = Number($('#customFoodProtein', sheet).value) || 0;
          const c = Number($('#customFoodCarbs', sheet).value) || 0;
          const f = Number($('#customFoodFat', sheet).value) || 0;
          const serving = Number($('#customFoodServing', sheet).value) || 100;
          const error = $('#customFoodError', sheet);
          const fail = (message) => {
            error.classList.add('is-visible');
            error.querySelector('span').textContent = message;
            showToast(message);
            requestAnimationFrame(() => error.scrollIntoView({ block: 'center', behavior: 'smooth' }));
          };
          if (!name) {
            fail('请给食物起一个名字');
            return;
          }
          if (!Number.isFinite(kcal) || kcal < 0 || kcal > 900) {
            fail('热量请填写 0–900 kcal / 100g');
            return;
          }
          if (!Number.isFinite(serving) || serving < 1 || serving > 2000) {
            fail('一份克数请填写 1–2000 g');
            return;
          }
          const food = {
            id: uid('custom'),
            name,
            emoji: '🍽️',
            cat: '我的',
            kcal,
            p: Number.isFinite(p) ? clamp(p, 0, 100) : 0,
            c: Number.isFinite(c) ? clamp(c, 0, 100) : 0,
            f: Number.isFinite(f) ? clamp(f, 0, 100) : 0,
            serving,
            servingLabel: '一份',
            aliases: []
          };
          state.data.customFoods.push(food);
          saveState();
          showToast('已保存到“我的食物”');
          openFoodQuantity(food, selectedMeal);
        });
      }
    });
  }

  // ---------------- Exercise sheet ----------------

  function openExerciseSheet(options = {}) {
    const profile = state.data.profile;
    if (!profile) return;
    const editingId = options.entryId || null;
    const existing = editingId ? findExerciseEntry(editingId)?.entry : null;
    const ocr = options.ocr || null;
    const baseType = existing ? EXERCISE_MAP[existing.exerciseId] : (options.exerciseId && EXERCISE_MAP[options.exerciseId]) || EXERCISE_MAP.walk;
    let form = {
      exerciseId: baseType.id,
      env: existing ? existing.env : options.env || baseType.env,
      minutes: existing ? existing.minutes : Number(options.minutes) || 30,
      intensity: existing ? existing.intensity : 'medium',
      watchKcal: existing && existing.source === 'watch'
        ? existing.kcal
        : options.watchKcal != null && options.watchKcal !== '' ? Number(options.watchKcal) : '',
      category: options.category || (COMMON_EXERCISES.has(baseType.id) ? '常做' : '全部')
    };
    let category = form.category;
    const ocrSummary = ocr && ocr.parsed
      ? [
          ocr.parsed.typeMatched ? ocr.parsed.exerciseName : '运动项目未识别',
          ocr.parsed.minutes ? `${ocr.parsed.minutes} 分钟` : '',
          ocr.parsed.kcal ? `${fmtInt(ocr.parsed.kcal)} kcal` : ''
        ].filter(Boolean).join(' · ')
      : '';
    const ocrCard = ocr ? `<div class="ocr-prefill">
      <img src="${esc(ocr.previewDataUrl || '')}" alt="导入的运动截图缩略图">
      <div class="ocr-prefill-copy">
        <div class="ocr-prefill-title">${icon('scan')}来自截图识别</div>
        <p>${ocrSummary ? '已填入：' + esc(ocrSummary) + '。请核对后再保存。' : '已读取截图，请手动核对未识别的字段。'}</p>
        <details>
          <summary>查看识别原文</summary>
          <pre>${esc(ocr.rawText || '')}</pre>
        </details>
      </div>
    </div>` : '';

    openSheet({
      kind: 'exercise',
      title: existing ? '编辑运动' : ocr ? '确认截图运动' : '记录运动',
      subtitle: existing ? '修改项目、时长或热量' : ocr ? '识别结果已填入，请核对后保存' : '选项目 → 填时长 → 可选手表热量',
      content: `${ocrCard}<div class="form-block" style="margin-top:0">
        <div class="form-block-title">在哪儿动 <span>会分开统计</span></div>
        <div class="env-toggle" id="exerciseEnvToggle">
          <button type="button" data-ex-env="indoor" class="${form.env === 'indoor' ? 'is-active' : ''}" aria-pressed="${form.env === 'indoor'}">${icon('home')}室内</button>
          <button type="button" data-ex-env="outdoor" class="${form.env === 'outdoor' ? 'is-active' : ''}" aria-pressed="${form.env === 'outdoor'}">${icon('sun')}室外</button>
        </div>
      </div>
      <div class="form-block">
        <div class="form-block-title">做了什么 <span>常做 / 有氧 / 力量 / 球类</span></div>
        <div class="category-tabs" style="margin:0 0 8px;padding:0" id="exerciseCategoryTabs">
          ${EXERCISE_CATEGORIES.map((item) => `<button class="cat-chip${item.id === category ? ' is-active' : ''}" type="button" data-ex-category="${item.id}" aria-pressed="${item.id === category}">${item.label}</button>`).join('')}
        </div>
        <div class="exercise-type-grid" id="exerciseTypeGrid"></div>
      </div>
      <div class="form-block">
        <div class="form-block-title">多久 <span>分钟</span></div>
        <div class="quantity-control">
          <button class="step-button" type="button" id="exMinutesMinus" aria-label="减少 5 分钟">−</button>
          <div class="input-wrap"><input class="input" id="exerciseMinutes" type="number" inputmode="numeric" min="1" max="600" value="${form.minutes}" aria-label="运动时长（分钟）"><span class="input-unit">分钟</span></div>
          <button class="step-button" type="button" id="exMinutesPlus" aria-label="增加 5 分钟">${icon('plus')}</button>
        </div>
        <div class="duration-presets">
          ${[15, 30, 45, 60].map((value) => `<button class="preset-btn" type="button" data-ex-minutes="${value}">${value} 分钟</button>`).join('')}
        </div>
      </div>
      <div class="form-block">
        <div class="form-block-title">强度 <span>影响 MET 估算与周目标折算</span></div>
        <div class="intensity-tabs" id="intensityTabs">
          ${Object.entries(INTENSITY).map(([key, item]) => `<button class="intensity-tab${form.intensity === key ? ' is-active' : ''}" type="button" data-ex-intensity="${key}" aria-pressed="${form.intensity === key}">${item.label}<small>×${item.factor} 达标分钟</small></button>`).join('')}
        </div>
      </div>
      <div class="watch-field">
        <div class="watch-field-head">
          <label for="watchKcalInput">${icon('watch')}手表显示的热量（选填）</label>
          <span>优先使用</span>
        </div>
        <div class="input-wrap">
          <input class="input has-unit" id="watchKcalInput" type="number" inputmode="numeric" min="1" max="5000" placeholder="例如 286" value="${form.watchKcal || ''}">
          <span class="input-unit">kcal</span>
        </div>
      </div>
      <div class="estimate-line" id="exerciseEstimate"></div>
      <div class="form-error" id="exerciseError" role="alert">${icon('alert')}<span></span></div>
      <div class="quick-entry-note">${icon('info')}来源选“手表”时，热量以你填写的数值为准；留空则按 MET 公式估算。环境标记只影响室内外统计，不影响同样的热量计算。</div>`,
      footer: `<div class="sheet-foot-actions">
        ${existing ? '<button class="btn btn-danger btn-sm" type="button" id="deleteExercise" aria-label="删除这条运动">' + icon('trash') + '</button>' : ''}
        <button class="btn btn-primary" type="button" id="saveExercise">${existing ? '保存修改' : '保存运动'}</button>
      </div>`,
      onMount: (sheet) => {
        const typeGrid = $('#exerciseTypeGrid', sheet);
        const minutesInput = $('#exerciseMinutes', sheet);
        const watchInput = $('#watchKcalInput', sheet);
        const estimate = $('#exerciseEstimate', sheet);

        const filteredExercises = () => {
          if (category === '全部') return EXERCISES;
          if (category === '常做') return EXERCISES.filter((item) => COMMON_EXERCISES.has(item.id));
          return EXERCISES.filter((item) => item.cat === category);
        };
        const renderTypes = () => {
          const list = filteredExercises();
          typeGrid.innerHTML = list.map((item) => `<button class="exercise-type${form.exerciseId === item.id ? ' is-active' : ''}" type="button" data-ex-type="${item.id}" aria-pressed="${form.exerciseId === item.id}">
            <span class="exercise-type-emoji" aria-hidden="true">${item.emoji}</span>
            <span class="exercise-type-name">${item.name}</span>
            <span class="exercise-type-sub">${item.strength ? '力量' : item.env === 'outdoor' ? '室外' : '室内'}</span>
          </button>`).join('') || '<p class="tiny">这个分类里还没有项目。</p>';
          $$('[data-ex-type]', typeGrid).forEach((button) => {
            button.addEventListener('click', () => {
              form.exerciseId = button.dataset.exType;
              const ex = EXERCISE_MAP[form.exerciseId];
              form.env = ex.env;
              updateEnvButtons();
              renderTypes();
              updateEstimate();
            });
          });
        };
        const updateEnvButtons = () => {
          $$('[data-ex-env]', sheet).forEach((button) => {
            const active = button.dataset.exEnv === form.env;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
        };
        const currentKcal = () => {
          const ex = EXERCISE_MAP[form.exerciseId];
          return exerciseKcal(ex, form.minutes, form.intensity, profile.currentWeight);
        };
        const updateEstimate = () => {
          const minutes = Number(minutesInput.value) || 0;
          form.minutes = clamp(minutes, 1, 600);
          const watch = Number(watchInput.value);
          const estimateKcal = currentKcal();
          if (watchInput.value !== '' && Number.isFinite(watch) && watch > 0) {
            form.watchKcal = watch;
            estimate.innerHTML = `<span style="display:flex;align-items:center;gap:5px">${icon('watch')}将采用手表数据</span><strong>${fmtInt(watch)} kcal</strong>`;
          } else {
            form.watchKcal = '';
            const ex = EXERCISE_MAP[form.exerciseId];
            const met = ex.met[INTENSITY[form.intensity].metKey];
            estimate.innerHTML = `<span>按 MET ${met.toFixed(1)} · ${INTENSITY[form.intensity].label}估算</span><strong>约 ${fmtInt(estimateKcal)} kcal</strong>`;
          }
        };

        renderTypes();
        updateEstimate();

        $$('[data-ex-env]', sheet).forEach((button) => {
          button.addEventListener('click', () => {
            form.env = button.dataset.exEnv;
            updateEnvButtons();
          });
        });
        $$('[data-ex-category]', sheet).forEach((button) => {
          button.addEventListener('click', () => {
            category = button.dataset.exCategory;
            $$('[data-ex-category]', sheet).forEach((item) => {
              const active = item === button;
              item.classList.toggle('is-active', active);
              item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            renderTypes();
          });
        });
        minutesInput.addEventListener('input', updateEstimate);
        minutesInput.addEventListener('blur', () => {
          let value = Number(minutesInput.value);
          if (!Number.isFinite(value) || value <= 0) value = 30;
          minutesInput.value = String(clamp(value, 1, 600));
          updateEstimate();
        });
        $('#exMinutesMinus', sheet).addEventListener('click', () => {
          minutesInput.value = String(clamp((Number(minutesInput.value) || 30) - 5, 1, 600));
          updateEstimate();
        });
        $('#exMinutesPlus', sheet).addEventListener('click', () => {
          minutesInput.value = String(clamp((Number(minutesInput.value) || 30) + 5, 1, 600));
          updateEstimate();
        });
        $$('[data-ex-minutes]', sheet).forEach((button) => {
          button.addEventListener('click', () => {
            minutesInput.value = button.dataset.exMinutes;
            updateEstimate();
          });
        });
        $$('[data-ex-intensity]', sheet).forEach((button) => {
          button.addEventListener('click', () => {
            form.intensity = button.dataset.exIntensity;
            $$('[data-ex-intensity]', sheet).forEach((item) => {
              const active = item === button;
              item.classList.toggle('is-active', active);
              item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            updateEstimate();
          });
        });
        watchInput.addEventListener('input', updateEstimate);
        $('#saveExercise', sheet)?.addEventListener('click', () => {
          const minutes = Number(minutesInput.value);
          const watch = Number(watchInput.value);
          const error = $('#exerciseError', sheet);
          const fail = (message) => {
            error.classList.add('is-visible');
            error.querySelector('span').textContent = message;
            showToast(message);
            requestAnimationFrame(() => error.scrollIntoView({ block: 'center', behavior: 'smooth' }));
          };
          if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 600) {
            fail('运动时长请填写 1–600 分钟');
            minutesInput.focus();
            return;
          }
          const hasWatch = watchInput.value !== '';
          if (hasWatch && (!Number.isFinite(watch) || watch <= 0 || watch > 5000)) {
            fail('手表热量请填写 1–5000 kcal，或留空让轻衡估算');
            watchInput.focus();
            return;
          }
          const ex = EXERCISE_MAP[form.exerciseId];
          const kcal = hasWatch ? Math.round(watch) : currentKcal();
          const day = getDay(dateKey(), true);
          if (existing) {
            const found = findExerciseEntry(existing.id);
            if (!found) return;
            Object.assign(found.entry, {
              exerciseId: ex.id,
              name: ex.name,
              emoji: ex.emoji,
              env: form.env,
              minutes,
              intensity: form.intensity,
              kcal,
              source: hasWatch ? 'watch' : 'estimate',
              strength: Boolean(ex.strength)
            });
            saveState();
            closeSheet(true);
            renderViews();
            showToast('运动记录已更新');
          } else {
            day.exercises.push({
              id: uid('ex'),
              exerciseId: ex.id,
              name: ex.name,
              emoji: ex.emoji,
              env: form.env,
              minutes,
              intensity: form.intensity,
              kcal,
              source: hasWatch ? 'watch' : 'estimate',
              strength: Boolean(ex.strength),
              time: nowTime()
            });
            saveState();
            closeSheet(true);
            renderViews();
            showToast(`已记录 ${ex.name} ${minutes} 分钟 · ${fmtInt(kcal)} kcal`);
          }
        });
        $('#deleteExercise', sheet)?.addEventListener('click', () => {
          if (!existing) return;
          const found = findExerciseEntry(existing.id);
          if (!found) return;
          const index = found.day.exercises.findIndex((item) => item.id === existing.id);
          if (index < 0) return;
          const removed = found.day.exercises.splice(index, 1)[0];
          saveState();
          closeSheet(true);
          renderViews();
          showToast('已删除运动记录', {
            actionLabel: '撤销',
            onAction: () => {
              const day = getDay(found.key, true);
              day.exercises.push(removed);
              saveState();
              renderViews();
            }
          });
        });
        if (options.focusWatch) {
          setTimeout(() => {
            const watchField = $('.watch-field', sheet);
            if (watchField) watchField.scrollIntoView({ block: 'center', behavior: 'smooth' });
            setTimeout(() => {
              $('#watchKcalInput', sheet)?.focus({ preventScroll: true });
            }, 360);
          }, 180);
        }
      }
    });
  }

  // ---------------- Recipe detail ----------------

  function openRecipeSheet(recipeId, slot) {
    const recipe = RECIPE_MAP[recipeId];
    if (!recipe) return;
    const meal = normalizeMeal(slot);
    const nutrition = { kcal: recipe.kcal, p: recipe.protein, c: recipe.carbs, f: recipe.fat };
    openSheet({
      kind: 'recipe',
      title: '食谱做法',
      subtitle: `${findMealName(meal)}建议 · ${recipe.minutes} 分钟`,
      content: `<div class="recipe-detail">
        <div class="recipe-detail-hero">
          <span class="recipe-detail-emoji" aria-hidden="true">${recipe.emoji}</span>
          <div class="recipe-detail-main">
            <h3 class="recipe-detail-title">${esc(recipe.name)}</h3>
            <p class="recipe-detail-meta">${recipe.kcal} kcal · 蛋白 ${fmtNum(recipe.protein)} g · 约 ${recipe.minutes} 分钟</p>
            <div class="badge-row">${recipe.badges.map((badge) => `<span class="badge-soft">${esc(badge)}</span>`).join('')}</div>
          </div>
        </div>
        ${nutritionLine(nutrition)}
        <div class="detail-section">
          <div class="detail-section-title">食材 <span>1 份 · 约 ${fmtInt(recipe.grams)} g</span></div>
          <div class="ingredient-list">
            ${recipe.ingredients.map((item) => `<div class="ingredient-row">
              <span class="ingredient-emoji" aria-hidden="true">${item.emoji}</span>
              <span class="ingredient-name">${esc(item.name)}</span>
              <span class="ingredient-amount">${fmtAmount(item.amount)} g</span>
            </div>`).join('')}
          </div>
        </div>
        <div class="detail-section">
          <div class="detail-section-title">做法 <span>少油也能好吃</span></div>
          <ol class="step-list">${recipe.steps.map((step) => `<li class="step-item">${esc(step)}</li>`).join('')}</ol>
        </div>
        ${recipe.tip ? `<div class="recipe-tip">${icon('sparkle')}<span>${esc(recipe.tip)}</span></div>` : ''}
      </div>`,
      footer: `<div class="sheet-foot-actions">
        <button class="btn btn-primary btn-block" type="button" id="logRecipeButton">记录到${findMealName(meal)} · ${fmtInt(recipe.kcal)} kcal</button>
      </div>`,
      onMount: (sheet) => {
        $('#logRecipeButton', sheet).addEventListener('click', () => {
          addRecipeEntryToMeal(recipe, meal, 1);
          saveState();
          closeSheet(true);
          renderViews();
          showToast(`已记录到${findMealName(meal)} · ${recipe.name}`);
        });
      }
    });
  }

  // ---------------- Global actions ----------------

  function handleGlobalClick(event) {
    const closeTrigger = event.target.closest('[data-sheet-close]');
    if (closeTrigger) {
      event.preventDefault();
      closeSheet();
      return;
    }
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.dataset.action;
    switch (action) {
      case 'add-food':
        openFoodPicker(trigger.dataset.meal || 'auto');
        break;
      case 'quick-calorie':
        openQuickEntrySheet(trigger.dataset.meal || 'auto');
        break;
      case 'edit-food-entry':
        {
          const found = findFoodEntry(trigger.dataset.id);
          if (found) openEntryEditor(found.entry);
        }
        break;
      case 'record-exercise':
        openExerciseSheet();
        break;
      case 'record-watch':
        openExerciseSheet({ focusWatch: true });
        break;
      case 'edit-exercise':
        {
          const found = findExerciseEntry(trigger.dataset.id);
          if (found) openExerciseSheet({ entryId: found.entry.id });
        }
        break;
      case 'prefill-exercise':
        openExerciseSheet({
          exerciseId: trigger.dataset.exercise,
          minutes: Number(trigger.dataset.minutes),
          env: trigger.dataset.env
        });
        break;
      case 'open-profile':
        openProfileSheet();
        break;
      case 'open-portion-guide':
        openPortionGuideSheet();
        break;
      case 'screenshot-import':
        openScreenshotImportSheet();
        break;
      case 'open-install':
        openInstallSheet();
        break;
      case 'show-calc':
        openCalculationSheet();
        break;
      case 'swap-plan':
        incrementPlanVariant();
        break;
      case 'set-diet':
        setDiet(trigger.dataset.diet);
        break;
      case 'open-recipe':
        openRecipeSheet(trigger.dataset.recipe, trigger.dataset.slot);
        break;
      case 'log-snack-combo':
        logSnackCombo(String(trigger.dataset.ids || '').split(',').filter(Boolean));
        break;
      case 'scroll-recipes':
        closeSheet(true);
        setView('plan');
        requestAnimationFrame(() => {
          const section = $('#recipeSection');
          if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        break;
      default:
        break;
    }
  }

  function handleGlobalKeydown(event) {
    if (event.key === 'Escape' && state.sheetOpen) {
      event.preventDefault();
      closeSheet();
      return;
    }
    if (event.key === 'Tab' && state.sheetOpen) {
      trapSheetFocus(event);
    }
  }

  function updateDateIfNeeded() {
    if (!state.data.profile) return;
    if (!state.currentDayKey) {
      state.currentDayKey = dateKey();
      return;
    }
    if (state.currentDayKey !== dateKey()) {
      state.currentDayKey = dateKey();
      renderViews();
      showToast('新的一天开始了，昨天的记录已保存');
    }
  }

  function initNavigation() {
    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', (event) => {
        const view = tab.dataset.tab;
        if (view === state.view) {
          event.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
    window.addEventListener('hashchange', () => {
      syncViewFromHash({ scroll: true });
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(window.location.protocol)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // The app works without offline caching; don't interrupt the user.
      });
    });
  }

  function init() {
    state.data = loadState();
    state.currentDayKey = dateKey();
    initNavigation();
    $('#profileButton')?.addEventListener('click', openProfileSheet);
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      showToast('轻衡已添加到手机桌面');
      if (state.sheetOpen && state.activeSheet?.kind === 'install') closeSheet(true);
      if (state.data.profile) {
        renderViews();
        if (state.sheetOpen && state.activeSheet?.kind === 'profile') refreshProfileSheet();
      }
    });
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', handleGlobalKeydown);
    if (state.data.profile) {
      syncViewFromHash({ scroll: false });
    } else {
      syncViewFromHash({ scroll: false });
      openOnboarding();
      if (!state.storageAvailable) {
        showToast('浏览器存储不可用，关闭页面后记录会丢失');
      }
    }
    window.addEventListener('visibilitychange', () => {
      if (!document.hidden) updateDateIfNeeded();
    });
    setInterval(updateDateIfNeeded, 60000);
    registerServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
