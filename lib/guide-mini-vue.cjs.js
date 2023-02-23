'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function isObject(obj) {
    return typeof obj === 'object' && obj !== null;
}
const isSymbol = (val) => typeof val === 'symbol';
const isIntegerKey = (val) => {
    const res = Number(String(val)).toString() !== 'NaN';
    return res;
};
const assign = Object.assign;
const isMap = (map) => map instanceof Map;
const isSet = (set) => set instanceof Set;
const isWeakMap = (weakMap) => weakMap instanceof WeakMap;
const isWeakSet = (weakSet) => weakSet instanceof WeakSet;
const isImprimitive = (imp) => isMap(imp) || isSet(imp) || isWeakMap(imp) || isWeakSet(imp);
const hasChanged = (oldValue, newValue) => !Object.is(oldValue, newValue);
const isKeyNumber = (num) => {
    const intNum = parseInt(String(num));
    return typeof intNum === 'number' && !isNaN(intNum);
};
const objectToString = Object.prototype.toString;
const toTypeString = (value) => objectToString.call(value);
const toRawType = (value) => {
    return toTypeString(value).slice(8, -1);
};
const hasOwn = (val, key) => Object.prototype.hasOwnProperty.call(val, key);
const camelize = (str) => {
    return str.replace(/-(\w)/g, (_, c) => {
        return c ? c.toUpperCase() : "";
    });
};
const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};
const toHandlerKey = (str) => {
    return str ? "on" + capitalize(str) : "";
};
const EMPTY_OBJ = {};

const publicPropertiesMap = {
    $el: (i) => i.vnode.el,
    $slots: (i) => i.slots
};
const PublicInstanceProxyHandlers = {
    get({ _: instance }, key) {
        const { setupState, props } = instance;
        if (hasOwn(setupState, key)) {
            return setupState[key];
        }
        else if (hasOwn(props, key)) {
            return props[key];
        }
        const publicGetter = publicPropertiesMap[key];
        if (publicGetter) {
            return publicGetter(instance);
        }
    }
};

function initProps(instance, rawProps) {
    instance.props = rawProps || {};
}

// 定义唯一值
const ITERATEKEYS_KEY = Symbol();
// 获取元素的原型
const getPtoro = (v) => Reflect.getPrototypeOf(v);
// 设置为浅响应
const toShallow = (val) => val;
// get
const get$1 = createGetter$1(false, false);
// 浅响应get
const shallowGet = createGetter$1(false, true);
// 只读get
const readonlyGet$1 = createGetter$1(true, false);
// 浅响应只读get
const shallowReadonlyGet$1 = createGetter$1(true, true);
// 自定义事件
const mutableInstrumentations = {
    get(key) {
        // 获取原始值target
        const target = this["__raw" /* RAW */];
        // 获取初始值targer
        const rawTarget = toRaw(target);
        // 获取初始值key
        const rawKey = toRaw(key);
        // 获取值
        target.get(key);
        // 获取初始值中的has
        const { has } = getPtoro(rawTarget);
        // 是否浅响应
        const isShallow = this["__is_shallow" /* IS_SHALLOW */];
        // 是否只读
        const isReadonly = this["__is_readonly" /* IS_READONLY */];
        // 非只读时收集依赖
        if (!isReadonly) {
            track(target, key, "__get" /* GET */);
        }
        // 转换器
        const wrap = isShallow ? toShallow : isReadonly ? readonly : reactive;
        // 如果key在初始值中直接获取值
        if (has.call(rawTarget, key)) {
            return wrap(target.get(key));
        }
        else if (has.call(rawTarget, rawKey)) { // 如果初始key在初始值中获取初始key的值
            return wrap(target.get(rawKey));
        }
        else if (target !== rawTarget) { // 如果原始值和初始值不同的情况则直接返回值
            return target.get(key);
        }
    },
    set(key, value) {
        // 是否只读
        const isReadonly = this["__is_readonly" /* IS_READONLY */];
        // 获取原始值
        const target = this["__raw" /* RAW */];
        // 只读拦截
        if (isReadonly) {
            console.warn(`key :"${String(key)}" set 失败，因为 target 是 readonly 类型`, target);
            return true;
        }
        // 获取原始值的has
        const { has } = getPtoro(target);
        // 当一个对象的原始值和响应值都作为键时抛出错误
        if (has.call(target, key)) {
            console.warn('Reactive Map contains both the raw and reactive');
        }
        // 获取初始值
        const raw = toRaw(value);
        // 获取旧值
        const oldValue = target.get(key);
        // key是否在值中
        const hasKey = target.has(key);
        // 设置值
        target.set(key, raw);
        // key在值中为修改 否则为新增
        if (hasKey) {
            if (oldValue !== value && (oldValue === oldValue || value === value)) {
                trigger(target, key, "__set" /* SET */);
            }
        }
        else {
            trigger(target, key, "__add" /* ADD */);
        }
        return this;
    },
    has(key) {
        // 获取原始值
        const target = this["__raw" /* RAW */];
        // 获取初始key
        const rawKey = toRaw(key);
        // 当前key不等于初始key时也要收集初始key
        if (key !== rawKey) {
            track(target, rawKey, "__iterate" /* ITERATE */);
        }
        track(target, key, "__iterate" /* ITERATE */);
        // 当两个key相等时直接has 否则 先验证当前后验证原始key
        return key === rawKey
            ? target.has(key)
            : target.has(key) || target.has(rawKey);
    },
    add(value) {
        // 将value设置为初始类型
        value = toRaw(value);
        // 是否只读
        const isReadonly = this["__is_readonly" /* IS_READONLY */];
        // 获取初始值target
        const target = toRaw(this);
        // 只读拦截
        if (isReadonly) {
            console.warn(`key :"${String(value)}" set 失败，因为 target 是 readonly 类型`, target);
            return true;
        }
        // 值是否存在
        const has = target.has(value);
        // 因为set中只有新增操作
        if (!has) {
            target.add(value);
            trigger(target, value, "__add" /* ADD */);
        }
        return this;
    },
    delete(key) {
        // 获取原始值
        const target = this["__raw" /* RAW */];
        // 获取原始值的has
        const { has } = getPtoro(target);
        // 判断key是否存在原始值中
        let hasKey = has.call(target, key);
        // 不存在则获取key的初始值并重新验证
        if (!hasKey) {
            key = toRaw(key);
            hasKey = target.has(key);
        }
        else {
            console.warn('Reactive Map contains both the raw and reactive');
        }
        // 定义返回值
        let result = false;
        // 如果存在则触发依赖
        if (hasKey) {
            result = target.delete(key);
            trigger(target, key, "__delete" /* DELETE */);
        }
        return result;
    },
    clear() {
        // 获取原始值
        const target = this["__raw" /* RAW */];
        // 获取数量
        const size = target.size;
        // 清空
        target.clear();
        // 当有值的情况下触发依赖  理应触发所有target绑定的依赖
        if (size > 0) {
            trigger(target, null, "__clear" /* CLEAR */);
        }
    },
    [Symbol.iterator]: iteratorMethod(Symbol.iterator),
    entries: iteratorMethod('entries'),
    forEach(callback, thisArg) {
        // 获取原始值
        const target = this["__raw" /* RAW */];
        // 收集依赖
        track(target, ITERATE_KEY, "__iterate" /* ITERATE */);
        // 是否浅响应
        const isShallow = this["__is_shallow" /* IS_SHALLOW */];
        // 是否只读
        const isReadonly = this["__is_readonly" /* IS_READONLY */];
        // 类型转换
        const wrap = isShallow ? toShallow : isReadonly ? readonly : reactive;
        // 遍历返回值并将值转换为响应式
        target.forEach((key, value) => {
            callback.call(thisArg, wrap(key), wrap(value), this);
        });
    },
    values: valuesIteratorMethod(),
    keys: keysIteratorMethod()
};
function valuesIteratorMethod() {
    return function () {
        const target = this["__raw" /* RAW */];
        const itr = target.values();
        const isShallow = this["__is_shallow" /* IS_SHALLOW */];
        const isReadonly = this["__is_readonly" /* IS_READONLY */];
        track(target, ITERATE_KEY, "__iterate" /* ITERATE */);
        const wrap = isShallow ? toShallow : isReadonly ? readonly : reactive;
        return {
            next() {
                const { value, done } = itr.next();
                return {
                    value: wrap(value),
                    done
                };
            },
            [Symbol.iterator]() {
                return this;
            }
        };
    };
}
function keysIteratorMethod() {
    return function () {
        const target = this["__raw" /* RAW */];
        const itr = target.keys();
        const isShallow = this["__is_shallow" /* IS_SHALLOW */];
        const isReadonly = this["__is_readonly" /* IS_READONLY */];
        // 因set类型修改时也需要变化keys，所以增加特殊依赖绑定值ITERATEKEYS_KEY
        track(target, ITERATEKEYS_KEY, "__iterate" /* ITERATE */);
        const wrap = isShallow ? toShallow : isReadonly ? readonly : reactive;
        return {
            next() {
                const { value, done } = itr.next();
                return {
                    value: wrap(value),
                    done
                };
            },
            [Symbol.iterator]() {
                return this;
            }
        };
    };
}
function iteratorMethod(method) {
    return function () {
        // 获取原始值
        const target = this["__raw" /* RAW */];
        // 执行方法
        const itr = target[method]();
        // 收集依赖
        track(target, ITERATE_KEY, "__iterate" /* ITERATE */);
        // 是否浅响应
        const isShallow = this["__is_shallow" /* IS_SHALLOW */];
        // 是否只读
        const isReadonly = this["__is_readonly" /* IS_READONLY */];
        // 类型转换
        const wrap = isShallow ? toShallow : isReadonly ? readonly : reactive;
        return {
            next() {
                // 获取执行值
                const { value, done } = itr.next();
                return {
                    // 转换类型 -> 将值变为响应式
                    value: Array.isArray(value) ? [wrap(value[0]), wrap(value[1])] : wrap(value),
                    done
                };
            },
            [Symbol.iterator]() {
                return this;
            }
        };
    };
}
// 创建非原始对象获取内容 参数 是否只读 是否浅响应
function createGetter$1(readonly = false, shallow = false) {
    return function get(target, key, receiver) {
        // 返回原始值
        if (key === "__raw" /* RAW */)
            return target;
        // 获取数量并收集依赖
        if (key === 'size') {
            track(target, ITERATE_KEY, "__iterate" /* ITERATE */);
            return Reflect.get(target, key, target);
        }
        if (key === "__is_reactive" /* IS_REACTIVE */) {
            return !readonly;
        }
        else if (key === "__is_readonly" /* IS_READONLY */) {
            return readonly;
        }
        else if (key === "__is_shallow" /* IS_SHALLOW */) {
            return shallow;
        }
        // 判断key是否存在target原型中 存在返回原始方法
        if (Object.prototype.hasOwnProperty.call(target, key) && key in target) {
            return target[key];
        }
        // 返回自定义方法
        return mutableInstrumentations[key];
    };
}
const mutationImprimitiveHandler = {
    get: get$1
};
const shallowImprimitiveReactiveHandler = assign({}, mutationImprimitiveHandler, {
    get: shallowGet
});
const readonlyImprimitiveHandler = {
    get: readonlyGet$1
};
const shallowReadonlyImprimitiveHandler = assign({}, readonlyImprimitiveHandler, {
    get: shallowReadonlyGet$1
});

// 临时存储effect
let activeEffect;
// 临时存储effectScope
let activeEffectScope;
// 用于嵌套effect
const activeEffectBucket = [];
// 用于嵌套effectScope
const activeEffectScopeBucket = [];
// 是否收集依赖
let shoultTrack = false;
// 设置依赖 提供其他文件设置
function setShoultTrack(bl) {
    shoultTrack = bl;
}
// 依赖桶
let bucket = new Map();
// 收集依赖
// 收集依赖步骤 -> bucket => map(target, map -> map(key, set))
function track(target, key, type) {
    // 判断是否需要收集依赖
    if (!isTracning())
        return;
    let depsMap = bucket.get(target);
    if (!depsMap) {
        bucket.set(target, depsMap = new Map());
    }
    let dep = depsMap.get(key);
    if (!dep) {
        depsMap.set(key, dep = new Set());
    }
    trackEffect(dep, {
        target, type, key
    });
}
// 是否需要收集依赖
function isTracning() {
    return shoultTrack && activeEffect !== undefined;
}
// 将临时effect收集到依赖中
function trackEffect(dep, trackInfo) {
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
    // 当有onTrack时触发收集依赖方法
    if (activeEffect.onTrack) {
        activeEffect.onTrack(assign({}, {
            effect: activeEffect
        }, trackInfo));
    }
}
// 触发依赖
// 将桶中得依赖取出
function trigger(target, key, type, oldValue, newValue) {
    const depsMap = bucket.get(target);
    if (!depsMap)
        return;
    // 执行依赖桶
    const effectsToRun = new Set();
    // 通过key取出target依赖中的数据
    const dep = depsMap.get(key);
    dep && dep.forEach((effect) => {
        if (activeEffect !== effect) {
            // 将执行依赖存入桶中
            effectsToRun.add(effect);
        }
    });
    // 当type为新增或删除或非原始对象时执行
    if (type === "__add" /* ADD */ || type === "__delete" /* DELETE */ || isImprimitive(target)) {
        // 执行以ITERATE_KEY收集依赖的内容
        const iterateDep = depsMap.get(ITERATE_KEY);
        iterateDep && iterateDep.forEach((effect) => {
            if (activeEffect !== effect) {
                effectsToRun.add(effect);
            }
        });
        // 当非原始值不为map和WeakMap并且type为修改是执行以ITERATEKEYS_KEY收集的依赖
        if (!((isMap(target) || isWeakMap(target)) && type === "__set" /* SET */)) {
            const iterateDep = depsMap.get(ITERATEKEYS_KEY);
            iterateDep && iterateDep.forEach((effect) => {
                if (activeEffect !== effect) {
                    effectsToRun.add(effect);
                }
            });
        }
    }
    // 清空时执行所有依赖
    if (type === "__clear" /* CLEAR */) {
        depsMap.forEach((effects) => {
            effects && effects.forEach((effect) => {
                if (activeEffect !== effect) {
                    effectsToRun.add(effect);
                }
            });
        });
    }
    // 当target为数组并且type为新增并且key是数值类型时执行以length收集的依赖
    if (Array.isArray(target) && type === "__add" /* ADD */ && isKeyNumber(key)) {
        const lenDep = depsMap.get('length');
        lenDep && lenDep.forEach((effect) => {
            if (activeEffect !== effect) {
                effectsToRun.add(effect);
            }
        });
    }
    // 当target为数组并且key为length时执行
    if (Array.isArray(target) && key === 'length') {
        depsMap.forEach((effects, effectKey) => {
            if (effectKey >= newValue) {
                effects && effects.forEach((effect) => {
                    if (activeEffect !== effect) {
                        effectsToRun.add(effect);
                    }
                });
            }
        });
    }
    triggerEffect(effectsToRun, {
        target,
        type,
        key,
        oldValue,
        newValue
    });
}
// 触发依赖 参数 dep 触发者信息
function triggerEffect(dep, triggerInfo) {
    const depToRun = new Set(dep);
    for (const effect of depToRun) {
        if (effect.scheduler) {
            effect.scheduler();
        }
        else {
            effect.run();
        }
        if (effect.onTrigger) {
            effect.onTrigger(assign({}, {
                effect
            }, triggerInfo));
        }
    }
}
// effect控制器
class ReactiveEffect {
    constructor(fn, scheduler) {
        // dep组
        this.deps = [];
        this.fn = fn;
        this.scheduler = scheduler;
        // 添加当前到effectScope
        recordEffectScope(this, activeEffectScope);
    }
    run() {
        // 清除依赖绑定
        cleanUp(this);
        // lastShouldTrack 是否需要收集依赖
        // activeEffectBucket 用于嵌套effect
        // 当子级执行完弹出并重新将父级effect传递给activeEffect
        let lastShouldTrack = shoultTrack;
        activeEffect = this;
        activeEffectBucket.push(activeEffect);
        shoultTrack = true;
        const value = this.fn();
        shoultTrack = lastShouldTrack;
        activeEffectBucket.pop();
        activeEffect = activeEffectBucket[activeEffectBucket.length - 1];
        return value;
    }
    // 暂停依赖触发
    stop() {
        cleanUp(this);
        if (this.onStop) {
            this.onStop();
        }
    }
}
// 清楚依赖
function cleanUp(effect) {
    effect.deps && effect.deps.forEach((dep) => {
        dep.delete(effect);
    });
    effect.deps.length = 0;
}
// effect注册 更新触发函数 配置项-> lazy scheduler onStop onTrack onTrigger
function effect(fn, options = {}) {
    // 如果fn中存在effect 表示已经注册过effect则获取之前的注册器 如果没有重新注册
    const reactiveEffect = fn['effect'] ? fn.effect : new ReactiveEffect(fn, options.scheduler);
    // 绑定配置项到注册器中
    assign(reactiveEffect, options);
    // 不为懒执行时触发函数
    if (!options['lazy']) {
        reactiveEffect.run();
    }
    // 返回runner
    const runner = reactiveEffect.run.bind(reactiveEffect);
    // 在runner中绑定effect
    runner.effect = reactiveEffect;
    return runner;
}
// 停止effect更新
function stop(runner) {
    runner.effect && runner.effect.stop();
}
// 范围控制effect
class EffectScope {
    constructor(should) {
        // effect组
        this.effects = [];
        // 是否需要执行
        this.active = true;
        // 记录范围
        this.scopes = [];
        // 记录当前effectScope
        this.cleanups = [];
        if (!should) {
            if (activeEffectScope) {
                activeEffectScope.scopes.push(this);
                this.parent = activeEffectScope;
                this.index = activeEffectScope.scopes.length - 1;
            }
        }
    }
    run(fn) {
        // 原理和effect中的run同理
        // 停止后不可运行
        if (this.active) {
            activeEffectScope = this;
            activeEffectScopeBucket.push(this);
            const value = fn();
            activeEffectScopeBucket.pop();
            activeEffectScope = activeEffectScopeBucket[activeEffectScopeBucket.length - 1];
            return value;
        }
        else {
            console.warn('[Vue warn] cannot run an inactive effect scope.');
        }
    }
    // 停止范围内依赖更新
    stop() {
        if (this.active) {
            // 关闭所有收集的effect
            this.effects.forEach((effect) => {
                effect.stop();
            });
            // 执行所有的范围停止
            this.scopes.forEach((effect) => {
                effect.stop();
            });
            // 丢弃时执行onScopeDispose
            this.cleanups.forEach((fn) => {
                typeof fn === 'function' && fn();
            });
            // 如果存在父级 将父级中的自己删除
            if (this.parent) {
                this.parent.scopes.splice(this.index, 1);
            }
            // 关闭可执行
            this.active = false;
        }
    }
}
// 收集effect依赖
function recordEffectScope(effect, scope) {
    if (scope) {
        scope.effects.push(effect);
    }
}
// 丢弃依赖时执行
function onScopeDispose(fn) {
    if (activeEffectScope) {
        activeEffectScope.cleanups.push(fn);
    }
    else {
        console.warn('[Vue warn] onScopeDispose() is called when there is no active effect scope to be associated with.');
    }
}

class RefImpl {
    constructor(value, isShallow) {
        // 注册dep
        this.dep = new Set();
        // 为ref类型
        this.__v_isRef = true;
        // 是否浅响应
        this.__is_shallow = false;
        // 将值处理并存储
        this._value = convert(value, isShallow);
        // 改为浅响应状态
        this.__is_shallow = isShallow;
    }
    get value() {
        trackRefEffect(this);
        return this._value;
    }
    set value(newValue) {
        // 匹配新旧值
        if (hasChanged(this._value, newValue)) {
            this._value = convert(newValue, this.__is_shallow);
            triggerRefEffect(this);
        }
    }
}
function trackRefEffect(ref) {
    if (isTracning()) {
        trackEffect(ref.dep);
    }
}
function triggerRefEffect(ref) {
    triggerEffect(ref.dep);
}
// 转换为ref
class ObjectRefImpl {
    constructor(target, key, defaultValue) {
        this.__v_isRef = true;
        this.target = target;
        this.key = key;
        this.defaultValue = defaultValue;
    }
    get value() {
        const val = this.target[this.key];
        return val || this.defaultValue;
    }
    set value(newValue) {
        this.target[this.key] = newValue;
    }
}
// 嵌套ref值
function convert(value, isShallow) {
    return isObject(value) && !isShallow ? reactive(value) : value;
}
// 注册ref
function ref(raw) {
    if (isRef(raw)) {
        return raw;
    }
    return new RefImpl(raw);
}
// 验证ref
function isRef(r) {
    return isObject(r) && r['__v_isRef'] === true;
}
// 转换为ref
function toRef(target, key, defaultValue) {
    const val = target[key];
    return isRef(val) ? val : (new ObjectRefImpl(target, key, defaultValue));
}
// 将对象或数组转换为ref
function toRefs(rs) {
    if (!isProxy(rs)) {
        console.warn('toRefs() expects a reactive object but received a plain one.');
    }
    const ret = Array.isArray(rs) ? new Array(rs.length) : {};
    for (const key in rs) {
        ret[key] = toRef(rs, key);
    }
    return ret;
}
// 返回ref值
function unRef(r) {
    return isRef(r) ? r.value : r;
}
function proxyRefs(obj) {
    return new Proxy(obj, {
        get(target, key) {
            return unRef(Reflect.get(target, key));
        },
        set(target, key, value) {
            if (isRef(target[key]) && !isRef(value)) {
                return (target[key].value = value);
            }
            else {
                return Reflect.set(target, key, value);
            }
        }
    });
}

// 设置触发依赖唯一值
const ITERATE_KEY = Symbol();
// 判断值是否为Symbol
const builtInSymbols = new Set(Object.getOwnPropertyNames(Symbol)
    .map(key => Symbol[key])
    .filter(isSymbol));
// 自定义方法
const arrayInstrymentions = {};
['push', 'unshift', 'pop', 'shift'].forEach((key) => {
    arrayInstrymentions[key] = function (...args) {
        // 避免重复收集依赖
        setShoultTrack(false);
        const res = toRaw(this)[key].apply(this, args);
        setShoultTrack(true);
        return res;
    };
});
['indexOf', 'includes', 'lastIndexOf'].forEach((key) => {
    arrayInstrymentions[key] = function (...args) {
        // 从当前内容获取字段
        let res = toRaw(this)[key].apply(this, args);
        // 当没有时在从原型获取字段
        if (!res || res === -1) {
            res = toRaw(this)[key].apply(this["__raw" /* RAW */], args);
        }
        return res;
    };
});
const get = createGetter();
const set = createSetter();
const deleteProperty = createDeleteProperty();
const has = createHas();
const ownKeys = createOwnKeys();
const apply = createApply();
const shallowReactiveGet = createGetter(false, true);
const shallowReactiveSet = createSetter(true);
const readonlyGet = createGetter(true);
const shallowReadonlyGet = createGetter(true, true);
// 创建get方法 参数 是否只读 是否浅响应
function createGetter(isReadonly = false, isShallow = false) {
    return function get(target, key, receiver) {
        if (key === "__is_reactive" /* IS_REACTIVE */) {
            return !isReadonly; // 是否为reactive类型
        }
        else if (key === "__is_readonly" /* IS_READONLY */) {
            return isReadonly; // 是否为readonly类型
        }
        else if (key === "__is_shallow" /* IS_SHALLOW */) {
            return isShallow; // 是否为shallow类型
        }
        else if (
        // 当key=raw时获取注册时储存的proxy
        key === "__raw" /* RAW */ &&
            receiver === (isReadonly
                ? isShallow
                    ? shallowReadonlyMap
                    : readonlyMap
                : isShallow
                    ? shallowReactiveMap
                    : reactiveMap).get(target)) {
            return target;
        }
        // target为数组时判断key是否在自定义方法中 
        if (Array.isArray(target) && Object.hasOwnProperty.call(arrayInstrymentions, key)) {
            return Reflect.get(arrayInstrymentions, key, receiver);
        }
        const res = Reflect.get(target, key, receiver);
        // 判断key是否为symbol 是直接返回
        if (isSymbol(key) && builtInSymbols.has(key)) {
            return res;
        }
        // 不为只读时收集依赖
        if (!isReadonly) {
            track(target, key, "__get" /* GET */);
        }
        // 浅响应返回获取值
        if (isShallow) {
            return res;
        }
        // 获取值为ref时返回正常内容
        if (isRef(res)) {
            const unwrapShould = !Array.isArray(target) || !isKeyNumber(key);
            return unwrapShould ? res.value : res;
        }
        // 获取值为对象时深入响应
        if (isObject(res)) {
            return isReadonly ? readonly(res) : reactive(res);
        }
        return res;
    };
}
// 创建setter 参数 是否只读 是否浅响应
function createSetter(shallow = false) {
    return function set(target, key, newVal, receiver) {
        // 获取旧值
        let oldVal = target[key];
        // 如果为只读则输出警告并返回
        if ((isReadonly(oldVal) && isRef(oldVal) && !isRef(newVal))) {
            console.warn(`key :"${String(key)}" set 失败，因为 target 是 readonly 类型`, target);
            return false;
        }
        // 当不是浅响应并且新值不为只读时操作
        if (!shallow && !isReadonly(newVal)) {
            // 新值不为浅响应时获取新值和旧值得原始值
            if (!isShallow(newVal)) {
                newVal = toRaw(newVal);
                oldVal = toRaw(oldVal);
            }
            // 当旧值为ref时执行
            if (!Array.isArray(target) && isRef(oldVal) && !isRef(newVal)) {
                // 直接设置旧值实现修改值
                oldVal.value = newVal;
                return true;
            }
        }
        // 判断type为新增或修改
        const type = Array.isArray(target) && isIntegerKey(key)
            ? Number(key) < target.length ? "__set" /* SET */ : "__add" /* ADD */
            : target.hasOwnProperty(key) ? "__set" /* SET */ : "__add" /* ADD */;
        const res = Reflect.set(target, key, newVal, receiver);
        // 判断target是否为原始值
        if (target === toRaw(receiver)) {
            // 新值旧值不相等时触发依赖
            // oldVal === oldVal || newVal === newVal  为了防止都为null 因为 null永远都不等于null
            if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
                trigger(target, key, type, oldVal, newVal);
            }
        }
        return res;
    };
}
// 创建delete 参数 是否只读
function createDeleteProperty() {
    return function deleteProperty(target, key) {
        // 判断key是否在target内
        const hadKey = Object.prototype.hasOwnProperty.call(target, key);
        // 获取旧值
        const oldValue = target[key];
        // 删除值
        const res = Reflect.deleteProperty(target, key);
        // 当删除值为true并且key在target内触发依赖
        if (res && hadKey) {
            trigger(target, key, "__delete" /* DELETE */, oldValue);
        }
        return res;
    };
}
// 创建has
function createHas() {
    return function has(target, key) {
        // 判断key是否存在target中并触发依赖
        const res = Reflect.has(target, key);
        track(target, key, "__has" /* HAS */);
        return res;
    };
}
// 创建ownKeys
function createOwnKeys() {
    return function ownKeys(target) {
        // 拦截for...in等
        // 当target为数组 -> 当数组长度改变时在触发依赖
        // 当target为对象等 -> 通过原始symobl收集依赖
        const res = Reflect.ownKeys(target);
        track(target, Array.isArray(target) ? 'length' : ITERATE_KEY, "__iterate" /* ITERATE */);
        return res;
    };
}
// 创建apply
function createApply() {
    return function apply(target, thisArg, argArray) {
        const res = Reflect.apply(target, thisArg, argArray);
        return res;
    };
}
// reactive控制器
const mutationHandler = {
    get,
    set,
    deleteProperty,
    has,
    ownKeys,
    apply
};
// shallowReactive控制器
const shallowReactiveHandler = assign({}, mutationHandler, {
    get: shallowReactiveGet,
    set: shallowReactiveSet
});
// readonly控制器
const readonlyHandler = {
    get: readonlyGet,
    set(target, key) {
        console.warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target);
        return true;
    },
    deleteProperty(target, key) {
        console.warn(`key :"${String(key)}" delete 失败，因为 target 是 readonly 类型`, target);
        return true;
    },
    has,
    ownKeys,
    apply
};
// shallowReactive控制器
const shallowReadonlyHandler = assign({}, readonlyHandler, {
    get: shallowReadonlyGet
});

// target类型验证
function targetTypeMap(rawType) {
    switch (rawType) {
        case 'Object':
        case 'Array':
            return 1 /* COMMON */;
        case 'Map':
        case 'Set':
        case 'WeakMap':
        case 'WeakSet':
            return 2 /* COLLECTION */;
        default:
            return 0 /* INVALID */;
    }
}
// 获取target类型
function getTargetType(value) {
    return value["__markRaw" /* MARKRAW */] || !Object.isExtensible(value)
        ? 0 /* INVALID */
        : targetTypeMap(toRawType(value));
}
function createObjectProxy(target, isReadonly, baseHandle, collectionHandle, baseMap) {
    if (!isObject(target)) {
        console.warn(`value cannot be made reactive: ${String(target)}`);
        return target;
    }
    if (target["__raw" /* RAW */] && !(isReadonly && target["__is_reactive" /* IS_REACTIVE */])) {
        return target;
    }
    // 如果target为无效值则直接返回
    const targetType = getTargetType(target);
    if (targetType === 0 /* INVALID */) {
        return target;
    }
    // 判断类型是对象类型切换处理器
    let handle = baseHandle;
    if (isImprimitive(target)) {
        handle = collectionHandle;
    }
    // 获取当前target是否注册过监听
    const existionProxy = baseMap.get(target);
    if (existionProxy)
        return existionProxy;
    // 注册监听
    const proxy = new Proxy(target, handle);
    // 存储监听
    baseMap.set(target, proxy);
    return proxy;
}
const reactiveMap = new Map();
function reactive(raw) {
    return createObjectProxy(raw, false, mutationHandler, mutationImprimitiveHandler, reactiveMap);
}
const shallowReactiveMap = new Map();
function shallowReactive(raw) {
    return createObjectProxy(raw, false, shallowReactiveHandler, shallowImprimitiveReactiveHandler, shallowReactiveMap);
}
const readonlyMap = new Map();
function readonly(raw) {
    return createObjectProxy(raw, true, readonlyHandler, readonlyImprimitiveHandler, readonlyMap);
}
const shallowReadonlyMap = new Map();
function shallowReadonly(raw) {
    return createObjectProxy(raw, true, shallowReadonlyHandler, shallowReadonlyImprimitiveHandler, shallowReadonlyMap);
}
// 获取初始值
function toRaw(observed) {
    const raw = observed && observed["__raw" /* RAW */];
    return raw ? toRaw(raw) : observed;
}
function markRaw(observed) {
    Object.defineProperty(observed, "__markRaw" /* MARKRAW */, {
        configurable: true,
        enumerable: false,
        value: true
    });
    return observed;
}
function isReactive(observed) {
    if (isReadonly(observed)) {
        return isReactive(observed["__raw" /* RAW */]);
    }
    return !!observed["__is_reactive" /* IS_REACTIVE */];
}
function isReadonly(observable) {
    return !!(observable && observable["__is_readonly" /* IS_READONLY */]);
}
function isProxy(observable) {
    return isReactive(observable) || isReadonly(observable);
}
function isShallow(observable) {
    return !!(observable && observable["__is_shallow" /* IS_SHALLOW */]);
}

// 计算属性控制类
class ComputedImpl {
    // 参数 获取方法 设置方法 是否只读
    constructor(getter, setter, isReadonly) {
        // 是否缓存
        this.cache = false;
        // 定义dep
        this.dep = new Set();
        // 设置为ref类型
        this.__v_isRef = true;
        this.getter = getter;
        this.setter = setter;
        this["__is_readonly" /* IS_READONLY */] = isReadonly;
        // 注册effect操作类 并定义scheduler
        this.effect = new ReactiveEffect(this.getter, () => {
            // 当为缓存状态时将缓存状态改变为false并触发依赖
            if (this.cache) {
                this.cache = false;
                triggerEffect(this.dep);
            }
        });
    }
    get value() {
        // 获取原始this
        const self = toRaw(this);
        // 记录缓存
        if (!self.cache) {
            self._value = self.effect.run();
            self.cache = true;
        }
        // 收集依赖
        computedTrack(self.dep);
        return self._value;
    }
    set value(newValue) {
        this.setter(newValue);
    }
}
function computedTrack(dep) {
    if (isTracning()) {
        trackEffect(dep);
    }
}
// 参数 计算属性 配置方法 onTrack onTrigger
function computed(calculate, options = {}) {
    let getter;
    let setter;
    let isReadonly;
    // 当计算属性为函数时设置给getter并设置为只读
    if (typeof calculate === 'function') {
        getter = calculate;
        setter = () => {
            console.warn('Write operation failed: computed value is readonly');
        };
        isReadonly = true;
    }
    else if (isObject(calculate)) { // 当计算属性为对象时 取出get和set并设置为可修改
        const { get, set } = calculate;
        getter = get;
        setter = set;
        isReadonly = false;
    }
    // 注册计算属性工具类
    const rsf = new ComputedImpl(getter, setter, isReadonly);
    // 挂载onTrack和onTrigger到注册类中
    if (isObject(options)) {
        rsf.effect.onTrack = options.onTrack;
        rsf.effect.onTrigger = options.onTrigger;
    }
    return rsf;
}

// 微任务 start
const task = [];
const p = Promise.resolve();
let delay = false;
function scheduler(fn) {
    task.push(fn);
    if (!delay) {
        delay = true;
        p.then(flush);
    }
}
function flush() {
    for (let i = 0; i < task.length; i++) {
        task[i]();
    }
    task.length = 0;
    delay = false;
}
// 微任务 end
class DeferredComputedImpl {
    constructor(getter) {
        // 是否缓存
        this.cache = false;
        // 定义dep
        this.dep = new Set();
        // 任务拦截
        let scheduled = false;
        // 临时值
        let temporaryValue;
        // 是否使用临时值
        let temporaryVis = false;
        this.effect = new ReactiveEffect(getter, (loseEfficacy) => {
            if (this.cache) {
                // 当计算值失效时改为同步
                if (loseEfficacy) {
                    temporaryValue = this._value;
                    temporaryVis = true;
                }
                else if (!scheduled) {
                    // 设置拦截
                    scheduled = true;
                    // 获取当前值或临时值
                    const _value = temporaryVis ? temporaryValue : this._value;
                    // 将值设为关闭
                    temporaryVis = false;
                    // 执行微任务
                    scheduler(() => {
                        // 当前值不等于最新值时触发依赖
                        if (_value !== this._get()) {
                            triggerEffect(this.dep);
                        }
                        // 打开拦截
                        scheduled = false;
                    });
                }
                // 当计算值失效时同步执行scheduler
                for (const e of this.dep) {
                    if (e.computed instanceof DeferredComputedImpl) {
                        e.scheduler && e.scheduler(true);
                    }
                }
            }
            // 关闭缓存
            this.cache = false;
        });
        // 设置当前给effect
        this.effect.computed = this;
    }
    _get() {
        // 记录缓存
        if (!this.cache) {
            this._value = this.effect.run();
            this.cache = true;
        }
        return this._value;
    }
    get value() {
        // 触发依赖
        computedTrack(this.dep);
        return this._get();
    }
}
// 注册异步计算属性
function deferredComputed(getter) {
    return new DeferredComputedImpl(getter);
}

function emit(instance, event, ...args) {
    const { props } = instance;
    const handleName = toHandlerKey(camelize(event));
    const handle = props[handleName];
    handle && handle(...args);
}

function initSlots(instance, children) {
    const { vnode } = instance;
    if (vnode.shapeFlag & 16 /* SLOT_CHILDREN */) {
        normalizeObjectSlots(children, instance.slots);
    }
}
function normalizeObjectSlots(children, slots) {
    for (let key in children) {
        const value = children[key];
        slots[key] = (props) => normalizeSlotValue(value(props));
    }
}
function normalizeSlotValue(val) {
    return Array.isArray(val) ? val : [val];
}

function createComponentInstance(vnode, parent) {
    const component = {
        vnode,
        type: vnode.type,
        setupState: {},
        props: {},
        slots: {},
        provides: parent ? parent.provides : {},
        parent,
        isMounted: false,
        subTree: {},
        emit: () => { }
    };
    component.emit = emit.bind(null, component);
    return component;
}
function setupComponent(instance) {
    initProps(instance, instance.vnode.props);
    initSlots(instance, instance.vnode.children);
    setupStatefulComponent(instance);
}
function setupStatefulComponent(instance) {
    const component = instance.type;
    instance.proxy = new Proxy({ _: instance }, PublicInstanceProxyHandlers);
    const { setup } = component;
    if (setup) {
        setCurrentInstance(instance);
        const setupResult = setup(shallowReadonly(instance.props), {
            emit: instance.emit
        });
        setCurrentInstance(null);
        handleSetupResult(instance, setupResult);
    }
}
function handleSetupResult(instance, setupResult) {
    if (typeof setupResult === 'object') {
        instance.setupState = proxyRefs(setupResult);
    }
    finishComponentSetup(instance);
}
function finishComponentSetup(instance) {
    const component = instance.type;
    instance.render = component.render;
}
let currentInstance = null;
function getCurrentInstance() {
    return currentInstance;
}
function setCurrentInstance(instance) {
    currentInstance = instance;
}

const Fragment = Symbol("Fragment");
const Text = Symbol("Text");
function createVNode(type, props, children) {
    const vnode = {
        type,
        props,
        children,
        key: props && props.key,
        shapeFlag: getShapeFlag(type),
        el: null
    };
    if (typeof children === "string") {
        vnode.shapeFlag |= 4 /* TEXT_CHILDREN */;
    }
    else if (Array.isArray(children)) {
        vnode.shapeFlag |= 8 /* ARRAY_CHILDREN */;
    }
    if (vnode.shapeFlag & 2 /* STATEFUL_COMPONENT */) {
        if (typeof children === "object") {
            vnode.shapeFlag |= 16 /* SLOT_CHILDREN */;
        }
    }
    return vnode;
}
function createTextVNode(text) {
    return createVNode(Text, {}, text);
}
function getShapeFlag(type) {
    return typeof type === "string"
        ? 1 /* ELEMENT */
        : 2 /* STATEFUL_COMPONENT */;
}

// 功能入口
function createAppAPI(render) {
    return function createApp(rootCpmponent) {
        return {
            mount(rootContainer) {
                const vnode = createVNode(rootCpmponent);
                render(vnode, rootContainer);
            }
        };
    };
}

// 创建渲染器
function createRenderer(options) {
    const { 
    // 创建元素
    createElement: hostCreateElement, 
    // 添加属性
    patchProp: hostPatchProp, 
    // 添加元素
    insert: hostInsert, 
    // 删除元素
    remove: hostRemove, 
    // 创建文字元素
    setElementText: hostSetElementText } = options;
    function render(vonde, rootContainer) {
        patch(null, vonde, rootContainer, null, null);
    }
    // 生成dom
    function patch(n1, n2, container, parentComponent, anchor) {
        const { type, shapeFlag } = n2;
        switch (type) {
            case Fragment:
                processFragment(n1, n2, container, parentComponent, anchor);
                break;
            case Text:
                processText(n1, n2, container);
                break;
            default:
                if (shapeFlag & 1 /* ELEMENT */) {
                    processElement(n1, n2, container, parentComponent, anchor);
                }
                else if (shapeFlag & 2 /* STATEFUL_COMPONENT */) {
                    processComponent(n1, n2, container, parentComponent, anchor);
                }
        }
    }
    function processComponent(n1, n2, container, parentComponent, anchor) {
        mountComponent(n2, container, parentComponent, anchor);
    }
    function processElement(n1, n2, container, parentComponent, anchor) {
        if (n1) {
            patchElement(n1, n2, container, parentComponent, anchor);
        }
        else {
            mountElement(n2, container, parentComponent, anchor);
        }
    }
    function patchElement(n1, n2, container, parentComponent, anchor) {
        const oldProps = n1.props || EMPTY_OBJ;
        const newProps = n2.props || EMPTY_OBJ;
        const el = (n2.el = n1.el);
        patchChildren(n1, n2, el, parentComponent, anchor);
        patchProps(el, oldProps, newProps);
    }
    function patchChildren(n1, n2, container, parentComponent, anchor) {
        const { shapeFlag: oldShapeFlag } = n1;
        const c1 = n1.children;
        const { shapeFlag } = n2;
        const c2 = n2.children;
        if (shapeFlag & 4 /* TEXT_CHILDREN */) {
            if (oldShapeFlag & 8 /* ARRAY_CHILDREN */) {
                removeChildren(c1);
            }
            if (c1 !== c2) {
                hostSetElementText(container, n2.children);
            }
        }
        else {
            if (oldShapeFlag & 4 /* TEXT_CHILDREN */) {
                hostSetElementText(container, '');
                mountChildren(n2, container, parentComponent, anchor);
            }
            else {
                patchKeyedChildren(c1, c2, container, parentComponent, anchor);
            }
        }
    }
    function patchKeyedChildren(c1, c2, container, parentComponent, parentAnchor) {
        let i = 0;
        const l1 = c1.length;
        const l2 = c2.length;
        let e1 = l1 - 1;
        let e2 = l2 - 1;
        function isSomeVNodeType(n1, n2) {
            return n1.type === n2.type && n1.key === n2.key;
        }
        while (i <= e1 && i <= e2) {
            const n1 = c1[i];
            const n2 = c2[i];
            if (isSomeVNodeType(n1, n2)) {
                patch(n1, n2, container, parentComponent, parentAnchor);
            }
            else {
                break;
            }
            i++;
        }
        while (i <= e1 && i <= e2) {
            const n1 = c1[e1];
            const n2 = c2[e2];
            if (isSomeVNodeType(n1, n2)) {
                patch(n1, n2, container, parentComponent, parentAnchor);
            }
            else {
                break;
            }
            e1--;
            e2--;
        }
        if (i > e1) {
            if (i <= e2) {
                while (i <= e2) {
                    const nextPos = e2 + 1;
                    const anchor = nextPos < l2 ? c2[nextPos].el : null;
                    patch(null, c2[i], container, parentComponent, anchor);
                    i++;
                }
            }
        }
        else if (i > e2) {
            while (i <= e1) {
                hostRemove(c1[i].el);
                i++;
            }
        }
        else {
            // 初始化起始位置
            const s1 = i;
            const s2 = i;
            // 执行节点开始
            let patched = 0;
            // 之前节点数
            const toBePatched = e2 - s1 + 1;
            // 装新节点得key
            const keyToNewIndexMap = new Map();
            // 之前节点去新节点的位置
            const newIndexToOldIndexMap = new Array(toBePatched);
            for (let i = 0; i < toBePatched; i++) {
                newIndexToOldIndexMap[i] = 0;
            }
            for (let i = s2; i <= e2; i++) {
                keyToNewIndexMap.set(c2[i].key, i);
            }
            for (let i = s1; i <= e1; i++) {
                const oldChild = c1[i];
                if (patched >= toBePatched) {
                    hostRemove(c1[i].el);
                }
                let newIndex;
                if (oldChild.key != null) {
                    newIndex = keyToNewIndexMap.get(oldChild.key);
                }
                else {
                    for (let j = s2; j <= e2; j++) {
                        if (isSomeVNodeType(oldChild, c2[j])) {
                            newIndex = j;
                            break;
                        }
                    }
                }
                if (!newIndex) {
                    hostRemove(oldChild.el);
                }
                else {
                    newIndexToOldIndexMap[newIndex - s2] = i + 1;
                    patch(oldChild, c2[newIndex], container, parentAnchor, null);
                    patched++;
                }
            }
            console.log(newIndexToOldIndexMap);
            for (let i = toBePatched - 1; i >= 0; i--) {
                const index = s2 + i;
                const anchor = index + 1 < l2 ? c2[index + 1].el : null;
                if (newIndexToOldIndexMap[i] === 0) {
                    patch(null, c2[index], container, parentComponent, anchor);
                }
                else {
                    hostInsert(c2[index].el, container, anchor);
                }
            }
        }
    }
    function removeChildren(children) {
        for (let i = 0; i < children.length; i++) {
            hostRemove(children[i].el);
        }
    }
    function patchProps(el, oldProps, newProps) {
        if (oldProps !== newProps) {
            for (const key in newProps) {
                const oldProp = oldProps[key];
                const newProp = newProps[key];
                if (oldProp !== newProp) {
                    hostPatchProp(el, key, oldProp, newProp);
                }
            }
            if (oldProps !== EMPTY_OBJ) {
                for (const key in oldProps) {
                    if (!(key in newProps)) {
                        hostPatchProp(el, key, oldProps[key], null);
                    }
                }
            }
        }
    }
    function processFragment(n1, n2, container, parentComponent, anchor) {
        mountChildren(n2, container, parentComponent, anchor);
    }
    function processText(n1, n2, container) {
        const { children } = n2;
        const textVNode = (n2.el = document.createTextNode(children));
        container.append(textVNode);
    }
    function mountComponent(vnode, container, parentComponent, anchor) {
        const instance = createComponentInstance(vnode, parentComponent);
        setupComponent(instance);
        setupRenderEffect(instance, container, anchor);
    }
    function mountElement(vnode, container, parentComponent, anchor) {
        const el = (vnode.el = hostCreateElement(vnode.type));
        const { children, shapeFlag } = vnode;
        if (shapeFlag & 4 /* TEXT_CHILDREN */) {
            el.textContent = children;
        }
        else if (shapeFlag & 8 /* ARRAY_CHILDREN */) {
            mountChildren(vnode, el, parentComponent, anchor);
        }
        const { props } = vnode;
        if (props) {
            for (let key in props) {
                const val = Array.isArray(props[key]) ? props[key].join(' ') : props[key];
                hostPatchProp(el, key, null, val);
            }
        }
        hostInsert(el, container, anchor);
    }
    function mountChildren(vnode, container, parentComponent, anchor) {
        vnode.children.forEach((v) => {
            patch(null, v, container, parentComponent, anchor);
        });
    }
    function setupRenderEffect(instance, container, anchor) {
        effect(() => {
            const { proxy } = instance;
            const subTree = instance.render.call(proxy);
            if (!instance.isMounted) {
                patch(null, subTree, container, instance, anchor);
                instance.isMounted = true;
            }
            else {
                const prevSubTree = instance.subTree;
                patch(prevSubTree, subTree, container, instance, anchor);
            }
            instance.subTree = subTree;
        });
    }
    return {
        createApp: createAppAPI(render)
    };
}

function h(type, props, children) {
    return createVNode(type, props, children);
}

function renderSlots(slots, name, props) {
    const slot = slots[name];
    if (slot) {
        if (typeof slot === "function") {
            return createVNode(Fragment, {}, slot(props));
        }
    }
}

function provide(key, value) {
    const currentInstance = getCurrentInstance();
    if (currentInstance) {
        let { provides } = currentInstance;
        const parentProvides = currentInstance.parent.provides;
        if (provides === parentProvides) {
            provides = currentInstance.provides = Object.assign(parentProvides);
        }
        provides[key] = value;
    }
}
function inject(key, defaultValue) {
    const currentInstance = getCurrentInstance();
    if (currentInstance) {
        const parentProvides = currentInstance.parent.provides;
        if (parentProvides[key]) {
            return parentProvides[key];
        }
        else if (defaultValue) {
            if (typeof defaultValue === 'function') {
                return defaultValue();
            }
            else {
                return defaultValue;
            }
        }
    }
}

function createElement(type) {
    return document.createElement(type);
}
function patchProp(el, key, oldVal, newVal) {
    const isOn = (key) => /^on[A-Z]/.test(key);
    if (isOn(key)) {
        const event = key.slice(2).toLowerCase();
        el.addEventListener(event, newVal);
    }
    else {
        if (newVal === undefined || newVal === null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, newVal);
        }
    }
}
function insert(el, parent, anchor) {
    parent.insertBefore(el, anchor || null);
}
function remove(child) {
    const parent = child.parentNode;
    if (parent) {
        parent.removeChild(child);
    }
}
function setElementText(el, text) {
    el.textContent = text;
}
const renderer = createRenderer({
    createElement,
    patchProp,
    insert,
    remove,
    setElementText
});
function createApp(...args) {
    return renderer.createApp(...args);
}

exports.EffectScope = EffectScope;
exports.ITERATE_KEY = ITERATE_KEY;
exports.computed = computed;
exports.createApp = createApp;
exports.createRenderer = createRenderer;
exports.createTextVNode = createTextVNode;
exports.deferredComputed = deferredComputed;
exports.effect = effect;
exports.getCurrentInstance = getCurrentInstance;
exports.h = h;
exports.inject = inject;
exports.isProxy = isProxy;
exports.isReactive = isReactive;
exports.isReadonly = isReadonly;
exports.isRef = isRef;
exports.markRaw = markRaw;
exports.onScopeDispose = onScopeDispose;
exports.provide = provide;
exports.proxyRefs = proxyRefs;
exports.reactive = reactive;
exports.readonly = readonly;
exports.ref = ref;
exports.renderSlots = renderSlots;
exports.shallowReactive = shallowReactive;
exports.shallowReadonly = shallowReadonly;
exports.stop = stop;
exports.toRaw = toRaw;
exports.toRef = toRef;
exports.toRefs = toRefs;
